import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

/**
 * Execute a query against the local PostgreSQL database
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return pool.connect()
}

/**
 * Set the current user context for RLS
 */
export async function setUserContext(userId: string, client?: any) {
  const sql = `SET LOCAL app.current_user_id = '${userId}'`
  if (client) {
    await client.query(sql)
  } else {
    await query(sql)
  }
}

export default pool
