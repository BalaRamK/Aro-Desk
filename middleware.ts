import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-utils'

/**
 * Middleware: Authentication & Authorization for Local Development
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/forgot-password']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Get session token from cookies
  const token = request.cookies.get('session')?.value
  let sessionPayload = null

  if (token) {
    sessionPayload = await verifyToken(token)
  }

  // If user is not authenticated and trying to access protected route
  if (!sessionPayload && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is authenticated and trying to access auth pages
  if (sessionPayload && isPublicRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // For protected routes, add user info to headers
  if (sessionPayload && pathname.startsWith('/dashboard')) {
    const response = NextResponse.next()
    response.headers.set('x-user-id', sessionPayload.sub)
    response.headers.set('x-user-email', sessionPayload.email)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
