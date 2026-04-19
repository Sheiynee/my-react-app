import { auth } from './firebase'

const BASE = import.meta.env.VITE_API_URL || ''

async function req(method, path, body) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'

  // Attach Firebase auth token if the user is signed in
  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const getMe = () => req('GET', '/me')
export const updateMe = (data) => req('PUT', '/me', data)

export const getProjects = () => req('GET', '/projects')
export const createProject = (data) => req('POST', '/projects', data)
export const updateProject = (id, data) => req('PUT', `/projects/${id}`, data)
export const deleteProject = (id) => req('DELETE', `/projects/${id}`)

export const getTasks = (projectId) =>
  req('GET', `/tasks${projectId ? `?projectId=${projectId}` : ''}`)
export const createTask = (data) => req('POST', '/tasks', data)
export const updateTask = (id, data) => req('PUT', `/tasks/${id}`, data)
export const deleteTask = (id) => req('DELETE', `/tasks/${id}`)

export const getMembers = () => req('GET', '/members')
export const createMember = (data) => req('POST', '/members', data)
export const updateMember = (id, data) => req('PUT', `/members/${id}`, data)
export const deleteMember = (id) => req('DELETE', `/members/${id}`)

export const getNotes = (projectId) =>
  req('GET', `/notes${projectId ? `?projectId=${projectId}` : ''}`)
export const createNote = (data) => req('POST', '/notes', data)
export const updateNote = (id, data) => req('PUT', `/notes/${id}`, data)
export const deleteNote = (id) => req('DELETE', `/notes/${id}`)

export const getComments = (taskId) => req('GET', `/comments?taskId=${taskId}`)
export const createComment = (data) => req('POST', '/comments', data)
export const deleteComment = (id) => req('DELETE', `/comments/${id}`)

export const getUsers = () => req('GET', '/users')

export const getProject = (id) => req('GET', `/projects/${id}`)
export const getProjectMembers = (id) => req('GET', `/projects/${id}/members`)
export const addProjectMember = (id, data) => req('POST', `/projects/${id}/members`, data)
export const updateProjectMember = (id, uid, data) => req('PUT', `/projects/${id}/members/${uid}`, data)
export const removeProjectMember = (id, uid) => req('DELETE', `/projects/${id}/members/${uid}`)
