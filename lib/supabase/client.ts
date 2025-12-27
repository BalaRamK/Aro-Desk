import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

/**
 * Creates a Supabase client for Client Components
 * Automatically handles cookie-based session management
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
