export const ROLE_RANK = { viewer: 0, member: 1, manager: 2, admin: 3 }

export const ROLE_LABELS = { viewer: 'Viewer', member: 'Member', manager: 'Manager', admin: 'Admin' }

export const ROLE_COLORS = {
  viewer: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  member: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  manager: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  admin: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

export const ALL_ROLES = ['viewer', 'member', 'manager', 'admin']

// Returns true if userRole meets the minRole threshold.
export function canDo(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[minRole] ?? 999)
}
