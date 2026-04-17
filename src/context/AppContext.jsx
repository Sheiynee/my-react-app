import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.getProjects(), api.getTasks(), api.getMembers(), api.getNotes()])
      .then(([p, t, m, n]) => {
        setProjects(p)
        setTasks(t)
        setMembers(m)
        setNotes(n)
      })
      .catch(err => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

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

  // Tasks
  async function addTask(data) {
    const t = await api.createTask(data)
    setTasks(prev => [...prev, t])
    return t
  }
  async function editTask(id, data) {
    const t = await api.updateTask(id, data)
    setTasks(prev => prev.map(x => x.id === id ? t : x))
    return t
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
      projects, tasks, members, notes, loading, error,
      addProject, editProject, removeProject,
      addTask, editTask, removeTask,
      addMember, editMember, removeMember,
      addNote, editNote, removeNote,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)