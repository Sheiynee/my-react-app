import { auth } from './firebase'

const BASE = import.meta.env.VITE_API_URL || ''
const DEFAULT_TIMEOUT_MS = 15000

/**
 * Error thrown by api calls. Exposes parsed server error message (.message),
 * HTTP status (.status), and a flag (.aborted) so UI code can ignore cancellations.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, aborted = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.aborted = aborted
  }
}

async function parseError(res) {
  // Server always returns JSON { error: "..." } now; fall back gracefully if not.
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text)
    if (json && typeof json.error === 'string') return json.error
  } catch {
    // fall through
  }
  // Never surface raw HTML error pages to users.
  if (text.startsWith('<')) return `Request failed (${res.status})`
  return text || `Request failed (${res.status})`
}

async function req(method, path, body, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'

  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`
  }

  // Combine caller's signal with our own timeout so we can cancel on either.
  const timeoutCtrl = new AbortController()
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), timeoutMs)
  const onExternalAbort = () => timeoutCtrl.abort()
  if (signal) {
    if (signal.aborted) timeoutCtrl.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutCtrl.signal,
    })
    if (!res.ok) {
      throw new ApiError(await parseError(res), { status: res.status })
    }
    // 204 No Content → return null instead of blowing up on res.json()
    if (res.status === 204) return null
    return res.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      // Distinguish caller-cancelled from our timeout.
      const userAborted = signal?.aborted
      throw new ApiError(
        userAborted ? 'Request cancelled' : 'Request timed out',
        { status: 0, aborted: true },
      )
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(err.message || 'Network error', { status: 0 })
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onExternalAbort)
  }
}

export const getMe = (opts) => req('GET', '/me', undefined, opts)
export const updateMe = (data, opts) => req('PUT', '/me', data, opts)

export const getProjects = (opts) => req('GET', '/projects', undefined, opts)
export const createProject = (data, opts) => req('POST', '/projects', data, opts)
export const updateProject = (id, data, opts) => req('PUT', `/projects/${id}`, data, opts)
export const deleteProject = (id, opts) => req('DELETE', `/projects/${id}`, undefined, opts)

export const getTasks = (projectId, opts) =>
  req('GET', `/tasks${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, undefined, opts)
export const createTask = (data, opts) => req('POST', '/tasks', data, opts)
export const updateTask = (id, data, opts) => req('PUT', `/tasks/${id}`, data, opts)
export const deleteTask = (id, opts) => req('DELETE', `/tasks/${id}`, undefined, opts)

export const getMembers = (opts) => req('GET', '/members', undefined, opts)
export const createMember = (data, opts) => req('POST', '/members', data, opts)
export const updateMember = (id, data, opts) => req('PUT', `/members/${id}`, data, opts)
export const deleteMember = (id, opts) => req('DELETE', `/members/${id}`, undefined, opts)

export const getNotes = (projectId, opts) =>
  req('GET', `/notes${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, undefined, opts)
export const createNote = (data, opts) => req('POST', '/notes', data, opts)
export const updateNote = (id, data, opts) => req('PUT', `/notes/${id}`, data, opts)
export const deleteNote = (id, opts) => req('DELETE', `/notes/${id}`, undefined, opts)

export const getComments = (taskId, opts) =>
  req('GET', `/comments?taskId=${encodeURIComponent(taskId)}`, undefined, opts)
export const createComment = (data, opts) => req('POST', '/comments', data, opts)
export const deleteComment = (id, opts) => req('DELETE', `/comments/${id}`, undefined, opts)

export const getUsers = (opts) => req('GET', '/users', undefined, opts)
export const updateUserRole = (uid, role, opts) => req('PUT', `/users/${uid}/role`, { role }, opts)

export const getProject = (id, opts) => req('GET', `/projects/${id}`, undefined, opts)
export const getProjectMembers = (id, opts) => req('GET', `/projects/${id}/members`, undefined, opts)
export const addProjectMember = (id, data, opts) => req('POST', `/projects/${id}/members`, data, opts)
export const updateProjectMember = (id, uid, data, opts) => req('PUT', `/projects/${id}/members/${uid}`, data, opts)
export const removeProjectMember = (id, uid, opts) => req('DELETE', `/projects/${id}/members/${uid}`, undefined, opts)
