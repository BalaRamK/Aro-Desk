'use server'

import { query, getClient } from '@/lib/db'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'local-dev-secret-change-in-production'
)

/**
 * Create a JWT session token
 */
async function createSessionToken(userId: string, email: string) {
  return await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SESSION_SECRET)
}

/**
 * Verify and decode JWT session token
 */
export async function verifySessionToken(token: string) {
  try {
    const verified = await jwtVerify(token, SESSION_SECRET)
    return verified.payload as { sub: string; email: string }
  } catch (error) {
    return null
  }
}

/**
 * Get current session from cookies
 */
export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  const payload = await verifySessionToken(token)
  if (!payload) return null

  // Fetch full user data
  const client = await getClient()
  try {
    // Set user context for RLS
    await client.query(`SET LOCAL app.current_user_id = '${payload.sub}'`)
    
    const result = await client.query(
      `SELECT u.id, u.email, p.tenant_id, p.role, p.full_name, p.is_active
       FROM users u
       JOIN profiles p ON u.id = p.id
       WHERE u.id = $1`,
      [payload.sub]
    )

    if (result.rows.length === 0) return null

    return {
      user: result.rows[0],
      userId: payload.sub,
      email: payload.email,
    }
  } finally {
    client.release()
  }
}

/**
 * Server Action: Sign Up
 */
export async function signUpAction(formData: {
  email: string
  password: string
  fullName: string
  organizationName: string
  inviteToken?: string
}) {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [formData.email]
    )

    if (existingUser.rows.length > 0) {
      return { error: 'User with this email already exists' }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(formData.password, 10)

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, encrypted_password, email_confirmed_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [formData.email, hashedPassword]
    )

    const userId = userResult.rows[0].id

    // Check if joining via invite
    let tenantId: string | null = null
    let userRole: 'Tenant Admin' | 'Viewer' = 'Tenant Admin'

    if (formData.inviteToken) {
      // TODO: Implement invite token validation
      // For now, this is a placeholder
      return { error: 'Invite functionality not yet implemented' }
    }

    // Create new tenant
    const slug = formData.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [`${formData.organizationName}`, `${slug}-${Date.now()}`]
    )

    tenantId = tenantResult.rows[0].id

    // Create profile
    await client.query(
      `INSERT INTO profiles (id, tenant_id, role, full_name, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [userId, tenantId, userRole, formData.fullName]
    )

    await client.query('COMMIT')

    // Create session
    const token = await createSessionToken(userId, formData.email)
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Signup error:', error)
    return { error: error.message || 'An unexpected error occurred during signup' }
  } finally {
    client.release()
  }
}

/**
 * Server Action: Sign In
 */
export async function signInAction(formData: {
  email: string
  password: string
}) {
  const client = await getClient()

  try {
    // Fetch user with password
    const result = await client.query(
      `SELECT u.id, u.email, u.encrypted_password, p.tenant_id, p.role, p.is_active
       FROM users u
       JOIN profiles p ON u.id = p.id
       WHERE u.email = $1`,
      [formData.email]
    )

    if (result.rows.length === 0) {
      return { error: 'Invalid email or password' }
    }

    const user = result.rows[0]

    // Verify password
    const passwordMatch = await bcrypt.compare(
      formData.password,
      user.encrypted_password
    )

    if (!passwordMatch) {
      return { error: 'Invalid email or password' }
    }

    // Check if user is active
    if (!user.is_active) {
      return { error: 'Your account has been deactivated. Please contact your administrator.' }
    }

    // Create session
    const token = await createSessionToken(user.id, user.email)
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    console.error('Signin error:', error)
    return { error: 'An unexpected error occurred during signin' }
  } finally {
    client.release()
  }
}

/**
 * Server Action: Sign Out
 */
export async function signOutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Get current user profile
 */
export async function getUserProfile() {
  const session = await getSession()
  if (!session) return null

  const client = await getClient()
  try {
    await client.query(`SET LOCAL app.current_user_id = '${session.userId}'`)
    
    const result = await client.query(
      `SELECT p.*, t.name as tenant_name, t.slug as tenant_slug
       FROM profiles p
       JOIN tenants t ON p.tenant_id = t.id
       WHERE p.id = $1`,
      [session.userId]
    )

    if (result.rows.length === 0) return null

    return {
      ...result.rows[0],
      tenant: {
        id: result.rows[0].tenant_id,
        name: result.rows[0].tenant_name,
        slug: result.rows[0].tenant_slug,
      },
    }
  } finally {
    client.release()
  }
}
