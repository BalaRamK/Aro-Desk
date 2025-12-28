import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth-local'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { signOutAction } from '@/app/actions/auth-local'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login?redirect=/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/admin" className="text-xl font-bold text-gray-900">
            Super Admin
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{session.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
