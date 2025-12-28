import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth-local'
import { getAllUsers, getAllTenants, isSuperAdmin } from '@/app/actions/admin'
import { AdminUserList } from './user-list'
import { AddUserForm } from './add-user-form'

export const metadata = {
  title: 'Super Admin Dashboard',
  description: 'Manage users and tenants across the platform',
}

export default async function AdminPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login?redirect=/admin')
  }

  const isAdmin = await isSuperAdmin()

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access the admin dashboard.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  const [usersResult, tenantsResult] = await Promise.all([
    getAllUsers(),
    getAllTenants(),
  ])

  if (usersResult.error || tenantsResult.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-600">
              {usersResult.error || tenantsResult.error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Manage users and tenants across the platform
              </p>
            </div>
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Total Users</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {usersResult.users?.length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Total Tenants</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {tenantsResult.tenants?.length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Super Admins</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {usersResult.users?.filter(u => u.is_super_admin).length || 0}
            </div>
          </div>
        </div>

        {/* Add User Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New User</h2>
          <AddUserForm tenants={tenantsResult.tenants || []} />
        </div>

        {/* User List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">All Users</h2>
          </div>
          <AdminUserList 
            users={usersResult.users || []} 
            tenants={tenantsResult.tenants || []}
          />
        </div>
      </div>
    </div>
  )
}
