import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware: Authentication & Authorization
 * Protects routes and validates tenant access
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
            domain: process.env.COOKIE_DOMAIN || '.local.test',
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
            domain: process.env.COOKIE_DOMAIN || '.local.test',
          })
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/auth']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // If user is not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (session && isPublicRoute && pathname !== '/auth/callback') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // Verify tenant access for protected routes
  if (session && pathname.startsWith('/dashboard')) {
    try {
      // Fetch user profile to validate tenant membership
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tenant_id, role, is_active')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        console.error('Profile fetch error:', error)
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set('error', 'profile_not_found')
        
        // Clear session
        await supabase.auth.signOut()
        return NextResponse.redirect(redirectUrl)
      }

      // Check if user account is active
      if (!profile.is_active) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set('error', 'account_inactive')
        
        // Clear session
        await supabase.auth.signOut()
        return NextResponse.redirect(redirectUrl)
      }

      // Verify tenant_id is present
      if (!profile.tenant_id) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set('error', 'no_tenant')
        
        // Clear session
        await supabase.auth.signOut()
        return NextResponse.redirect(redirectUrl)
      }

      // Add tenant info to headers for use in API routes
      response.headers.set('x-tenant-id', profile.tenant_id)
      response.headers.set('x-user-role', profile.role)
    } catch (error) {
      console.error('Middleware error:', error)
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
