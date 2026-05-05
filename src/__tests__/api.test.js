import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, getMe, updateMe, getProjects } from '../api'

// Prevent real Firebase auth from initialising during tests
vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}))

// ── ApiError class ────────────────────────────────────────────

describe('ApiError', () => {
  it('has the correct name, message, and default properties', () => {
    const err = new ApiError('Something failed', { status: 404 })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ApiError')
    expect(err.message).toBe('Something failed')
    expect(err.status).toBe(404)
    expect(err.aborted).toBe(false)
  })

  it('marks aborted errors correctly', () => {
    const err = new ApiError('Cancelled', { status: 0, aborted: true })
    expect(err.aborted).toBe(true)
    expect(err.status).toBe(0)
  })

  it('defaults status to 0 and aborted to false when options are omitted', () => {
    const err = new ApiError('Oops')
    expect(err.status).toBe(0)
    expect(err.aborted).toBe(false)
  })
})

// ── HTTP request behaviour ────────────────────────────────────

describe('API requests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON on a 200 response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'u1', displayName: 'Alice' }),
    })
    const result = await getMe()
    expect(result).toEqual({ id: 'u1', displayName: 'Alice' })
  })

  it('returns null on a 204 No Content response', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })
    const result = await updateMe({ displayName: 'Alice' })
    expect(result).toBeNull()
  })

  it('throws ApiError with the server error message on a non-ok response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'Forbidden' }),
    })
    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Forbidden',
      aborted: false,
    })
  })

  it('falls back to a generic message when the error body is HTML', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '<html><body>Internal Server Error</body></html>',
    })
    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Request failed (500)',
    })
  })

  it('falls back to a generic message when the error body is empty', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '',
    })
    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Request failed (502)',
    })
  })

  it('throws an aborted ApiError on AbortError (timeout)', async () => {
    const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    fetch.mockRejectedValue(abortErr)
    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      aborted: true,
      message: 'Request timed out',
    })
  })

  it('wraps unexpected network errors in ApiError', async () => {
    fetch.mockRejectedValue(new Error('ERR_CONNECTION_REFUSED'))
    await expect(getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      aborted: false,
      message: 'ERR_CONNECTION_REFUSED',
    })
  })

  it('includes Authorization header when a user is signed in', async () => {
    // Temporarily patch auth.currentUser for this test only
    const { auth } = await import('../firebase')
    auth.currentUser = { getIdToken: async () => 'test-token-123' }

    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([]),
    })

    await getProjects()

    const [, options] = fetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('Bearer test-token-123')

    auth.currentUser = null
  })

  it('omits Authorization header when no user is signed in', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([]),
    })

    await getProjects()

    const [, options] = fetch.mock.calls[0]
    expect(options.headers['Authorization']).toBeUndefined()
  })
})
