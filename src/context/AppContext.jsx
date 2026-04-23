import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../firebase'
import * as api from '../api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Abort in-flight bootstrap requests when the provider unmounts (or re-mounts
    // in StrictMode) so we don't setState on unmounted component.
    const ctrl = new AbortController()
    const opts = { signal: ctrl.signal }

    // Promise.allSettled so one slow/failed endpoint doesn't block everything else.
    Promise.allSettled([
      api.getMe(opts),
      api.getProjects(opts),
      api.getTasks(undefined, opts),
      api.getMembers(opts),
      api.getNotes(undefined, opts),
    ]).then((results) => {
      if (ctrl.signal.aborted) return
      const [me, p, t, m, n] = results
      if (me.status === 'fulfilled') setCurrentUser(me.value)
      if (p.status === 'fulfilled') setProjects(p.value)
      if (t.status === 'fulfilled') setTasks(t.value)
      if (m.status === 'fulfilled') setMembers(m.value)
      if (n.status === 'fulfilled') setNotes(n.value)
      // Surface the first real (non-abort) failure so UI can show a banner —
      // but data that did load is still rendered.
      const firstFail = results.find(r => r.status === 'rejected' && !r.reason?.aborted)
      if (firstFail) setError(firstFail.reason?.message || 'Failed to load data')
      setLoading(false)
    })

    return () => ctrl.abort()
  }, [])

  // Returns the current user's role string in the given project,
  // or null if they have no access. Legacy projects (no roles map)
  // fall back to: creator = admin, everyone else = member.
  function getProjectRole(projectId) {
    // Read uid from loaded user state first (avoids a stale auth.currentUser race
    // right after sign-in) and fall back to the firebase SDK if state hasn't loaded yet.
    const uid = currentUser?.uid || auth.currentUser?.uid
    if (!uid) return null
    // App admins have full access to every project
    if (currentUser?.role === 'admin') return 'admin'
    const project = projects.find(p => p.id === projectId)
    if (!project) return null
    const { roles, createdBy } = project
    if (!roles || Object.keys(roles).length === 0) {
      return createdBy === uid ? 'admin' : null
    }
    return roles[uid] || null
  }

  // Projects
  async function addProject(data) {
    const p = await api.createProject(data)
    setProjects(prev => [...prev, p])
    return p
  }
  async function editProject(id, data) {
    const p = await api.updateProject(id, data)
    setProjects(prev => prev.map(x => x.id === id ? p : x))
    return p
  }
  async function removeProject(id) {
    await api.deleteProject(id)
    setProjects(prev => prev.filter(x => x.id !== id))
    setTasks(prev => prev.filter(x => x.projectId !== id))
    setNotes(prev => prev.filter(x => x.projectId !== id))
  }
  async function refreshProject(id) {
    const p = await api.getProject(id)
    setProjects(prev => prev.map(x => x.id === id ? p : x))
    return p
  }

  // Tasks
  async function addTask(data) {
    const t = await api.createTask(data)
    setTasks(prev => [...prev, t])
    return t
  }
  async function editTask(id, data) {
    // Snapshot only the fields we're about to change so rollback-on-error
    // doesn't wipe other edits the user made in parallel.
    const original = tasks.find(x => x.id === id)
    const changedKeys = Object.keys(data)
    const rollbackPatch = changedKeys.reduce((acc, k) => {
      acc[k] = original ? original[k] : undefined
      return acc
    }, {})
    setTasks(prev => prev.map(x => x.id === id ? { ...x, ...data } : x))
    try {
      const t = await api.updateTask(id, data)
      // Merge server response into current state (don't overwrite concurrent edits).
      setTasks(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
      return t
    } catch (err) {
      // Revert only the fields we changed in this call.
      setTasks(prev => prev.map(x => x.id === id ? { ...x, ...rollbackPatch } : x))
      throw err
    }
  }
  async function removeTask(id) {
    await api.deleteTask(id)
    setTasks(prev => prev.filter(x => x.id !== id && x.parentId !== id))
  }

  // Members
  async function addMember(data) {
    const m = await api.createMember(data)
    setMembers(prev => [...prev, m])
    return m
  }
  async function editMember(id, data) {
    const m = await api.updateMember(id, data)
    setMembers(prev => prev.map(x => x.id === id ? m : x))
    return m
  }
  async function removeMember(id) {
    await api.deleteMember(id)
    setMembers(prev => prev.filter(x => x.id !== id))
    setTasks(prev => prev.map(t => ({
      ...t,
      assigneeIds: (t.assigneeIds || []).filter(aId => aId !== id),
      assigneeId: t.assigneeId === id ? null : t.assigneeId,
    })))
  }

  // Notes
  async function addNote(data) {
    const n = await api.createNote(data)
    setNotes(prev => [...prev, n])
    return n
  }
  async function editNote(id, data) {
    const n = await api.updateNote(id, data)
    setNotes(prev => prev.map(x => x.id === id ? n : x))
    return n
  }
  async function removeNote(id) {
    await api.deleteNote(id)
    setNotes(prev => prev.filter(x => x.id !== id))
  }

  return (
    <AppContext.Provider value={{
      currentUser,
      projects, tasks, members, notes, loading, error,
      getProjectRole,
      addProject, editProject, removeProject, refreshProject,
      addTask, editTask, removeTask,
      addMember, editMember, removeMember,
      addNote, editNote, removeNote,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
