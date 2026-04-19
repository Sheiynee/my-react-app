import { useState, useEffect } from 'react'
import Modal from './Modal'
import * as api from '../api'
import { ALL_ROLES, ROLE_LABELS, ROLE_COLORS, canDo } from '../roles'

export default function ProjectMembersModal({ projectId, myRole, onClose }) {
  const [members, setMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addUid, setAddUid] = useState('')
  const [addRole, setAddRole] = useState('member')
  const [adding, setAdding] = useState(false)

  const isAdmin = myRole === 'admin'
  const canAdd = canDo(myRole, 'manager')

  useEffect(() => {
    Promise.all([api.getProjectMembers(projectId), api.getUsers()])
      .then(([m, u]) => { setMembers(m); setAllUsers(u) })
      .finally(() => setLoading(false))
  }, [projectId])

  const existingUids = new Set(members.map(m => m.uid))
  const availableUsers = allUsers.filter(u => !existingUids.has(u.uid))

  async function handleAdd() {
    if (!addUid) return
    setAdding(true)
    try {
      await api.addProjectMember(projectId, { uid: addUid, role: addRole })
      const user = allUsers.find(u => u.uid === addUid)
      setMembers(prev => [...prev, {
        uid: addUid, role: addRole,
        displayName: user?.displayName || addUid,
        email: user?.email || null,
        photoURL: user?.photoURL || null,
      }])
      setAddUid('')
    } catch (err) {
      alert(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleChangeRole(uid, role) {
    try {
      await api.updateProjectMember(projectId, uid, { role })
      setMembers(prev => prev.map(m => m.uid === uid ? { ...m, role } : m))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleRemove(uid) {
    if (!confirm('Remove this member from the project?')) return
    try {
      await api.removeProjectMember(projectId, uid)
      setMembers(prev => prev.filter(m => m.uid !== uid))
    } catch (err) {
      alert(err.message)
    }
  }

  const assignableRoles = isAdmin ? ALL_ROLES : ALL_ROLES.filter(r => !canDo(r, 'manager'))

  return (
    <Modal title="Project Members" onClose={onClose} width="480px">
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {members.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">No members assigned yet.</p>
          )}
          {members.map(m => (
            <div key={m.uid} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                {m.photoURL
                  ? <img src={m.photoURL} className="w-full h-full object-cover" alt="" />
                  : (m.displayName || m.uid)[0]?.toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{m.displayName || m.uid}</p>
                {m.email && <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{m.email}</p>}
              </div>
              {isAdmin ? (
                <select
                  value={m.role}
                  onChange={e => handleChangeRole(m.uid, e.target.value)}
                  className="text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 outline-none"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              ) : (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[m.role]}`}>
                  {ROLE_LABELS[m.role]}
                </span>
              )}
              {isAdmin && (
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                  onClick={() => handleRemove(m.uid)}
                  title="Remove"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
          ))}

          {canAdd && availableUsers.length > 0 && (
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3 mt-1">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Add Member</p>
              <div className="flex gap-2">
                <select
                  value={addUid}
                  onChange={e => setAddUid(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 bg-gray-50 dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-500"
                >
                  <option value="">Select user…</option>
                  {availableUsers.map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName || u.email || u.uid}</option>
                  ))}
                </select>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-2 bg-gray-50 dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-500"
                >
                  {assignableRoles.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={handleAdd}
                  disabled={!addUid || adding}
                  className="px-3 py-2 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
