'use client'

import { useState } from 'react'
import { updateUserRole, toggleUserActive, deleteUser } from '@/app/actions/admin'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  is_super_admin: boolean
  tenant_name: string
  tenant_id: string
  user_created_at: string
}

interface AdminUserListProps {
  users: User[]
  tenants: Array<{
    id: string
    name: string
  }>
}

export function AdminUserList({ users, tenants }: AdminUserListProps) {
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setLoading(userId)
    setError('')

    const result = await toggleUserActive(userId, !isActive)

    if (result.error) {
      setError(result.error)
    }

    setLoading(null)
  }

  const handleUpdateRole = async (
    userId: string,
    role: 'Viewer' | 'Contributor' | 'Practitioner' | 'Tenant Admin',
    isSuperAdmin: boolean
  ) => {
    setLoading(userId)
    setError('')

    const result = await updateUserRole(userId, role, isSuperAdmin)

    if (result.error) {
      setError(result.error)
    } else {
      setEditingUser(null)
    }

    setLoading(null)
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return
    }

    setLoading(userId)
    setError('')

    const result = await deleteUser(userId)

    if (result.error) {
      setError(result.error)
    }

    setLoading(null)
  }

  return (
    <div>
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.tenant_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingUser === user.id ? (
                    <UserRoleEditor
                      user={user}
                      onSave={handleUpdateRole}
                      onCancel={() => setEditingUser(null)}
                      loading={loading === user.id}
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                      {user.is_super_admin && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Super Admin
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.user_created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  {editingUser !== user.id && (
                    <>
                      <button
                        onClick={() => setEditingUser(user.id)}
                        disabled={loading === user.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        disabled={loading === user.id}
                        className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.email)}
                        disabled={loading === user.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No users found
        </div>
      )}
    </div>
  )
}

function UserRoleEditor({
  user,
  onSave,
  onCancel,
  loading,
}: {
  user: User
  onSave: (userId: string, role: any, isSuperAdmin: boolean) => Promise<void>
  onCancel: () => void
  loading: boolean
}) {
  const [role, setRole] = useState(user.role)
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.is_super_admin)

  return (
    <div className="flex items-center space-x-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="Viewer">Viewer</option>
        <option value="Contributor">Contributor</option>
        <option value="Practitioner">Practitioner</option>
        <option value="Tenant Admin">Tenant Admin</option>
      </select>
      <label className="flex items-center space-x-1">
        <input
          type="checkbox"
          checked={isSuperAdmin}
          onChange={(e) => setIsSuperAdmin(e.target.checked)}
          className="w-3 h-3"
        />
        <span className="text-xs">SA</span>
      </label>
      <button
        onClick={() => onSave(user.id, role as any, isSuperAdmin)}
        disabled={loading}
        className="text-green-600 hover:text-green-900 text-xs disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        disabled={loading}
        className="text-gray-600 hover:text-gray-900 text-xs disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
