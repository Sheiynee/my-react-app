import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import * as api from '../api'

const APP_ROLES = ['admin', 'manager', 'employee']
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', employee: 'Employee' }
const ROLE_COLORS = {
  admin: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  manager: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  employee: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
}

export default function Users() {
  const { currentUser } = useApp()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(uid, role) {
    setSaving(uid)
    try {
      await api.updateUserRole(uid, role)
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u))
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 text-2xl">🔒</div>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Access restricted</p>
        <p className="text-sm text-gray-400 dark:text-zinc-500">Only app admins can manage user roles.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Users</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Manage app-level roles for all registered accounts.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">No users found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(u => {
            const isSelf = u.uid === currentUser?.uid
            const role = u.role || 'employee'
            return (
              <div
                key={u.uid}
                className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                  {u.photoURL
                    ? <img src={u.photoURL} className="w-full h-full object-cover" alt="" />
                    : (u.displayName || u.uid)[0]?.toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                    {u.displayName || u.uid}
                    {isSelf && <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">(you)</span>}
                  </p>
                  {u.email && <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{u.email}</p>}
                </div>
                {isSelf ? (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[role] || ROLE_COLORS.employee}`}>
                    {ROLE_LABELS[role] || role}
                  </span>
                ) : (
                  <select
                    value={role}
                    disabled={saving === u.uid}
                    onChange={e => handleRoleChange(u.uid, e.target.value)}
                    className="text-sm border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    {APP_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
