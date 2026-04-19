import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

export default function Login() {
  const { user, authLoading, loginWithEmail, registerWithEmail, loginWithDiscordToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle Discord OAuth callback token
  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError) setError('Discord sign-in failed. Please try again.')
  }, [searchParams])

  // Redirect already-logged-in users
  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true })
  }, [user, authLoading, navigate])

  // Handle the /auth/callback route passing the Discord custom token
  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) return
    setLoading(true)
    loginWithDiscordToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch(() => {
        setError('Discord sign-in failed. Please try again.')
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password)
      } else {
        if (!displayName.trim()) { setError('Display name is required'); setLoading(false); return }
        await registerWithEmail(email, password, displayName.trim())
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err.code))
      setLoading(false)
    }
  }

  function handleDiscordLogin() {
    window.location.href = `${BASE}/auth/discord`
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white text-xl font-bold mb-3">T</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">TaskFlow</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Sign in to continue</p>
        </div>

        {/* Discord button */}
        <button
          onClick={handleDiscordLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition-colors"
        >
          <DiscordIcon />
          Continue with Discord
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
          <span className="text-xs text-gray-400 dark:text-zinc-600">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-gray-100 dark:bg-zinc-900 p-1 mb-5">
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {tab === 'register' && (
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength={6}
          />

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
