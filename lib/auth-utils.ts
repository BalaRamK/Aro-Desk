import { jwtVerify } from 'jose'

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'local-dev-secret-change-in-production'
)

/**
 * Verify JWT token in middleware (edge-compatible)
 */
export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, SESSION_SECRET)
    return verified.payload as { sub: string; email: string }
  } catch (error) {
    return null
  }
}
