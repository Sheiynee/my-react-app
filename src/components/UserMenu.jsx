import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'

export default function UserMenu({ dark, onToggleDark }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const photoURL = user?.photoURL
  const displayName = user?.displayName || user?.email || 'User'
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-blue-500 transition-all focus:outline-none focus:ring-blue-500"
        aria-label="User menu"
      >
        {photoURL ? (
          <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xs font-semibold">
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{user?.email || 'Discord user'}</p>
          </div>

          <div className="p-1">
            {/* Profile */}
            <button
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60">
                <circle cx="7.5" cy="5" r="2.5" fill="currentColor"/>
                <path d="M2 13c0-3.038 2.462-5 5.5-5s5.5 1.962 5.5 5H2Z" fill="currentColor"/>
              </svg>
              Profile & Settings
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => { onToggleDark(); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {dark ? (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-60">
                  <circle cx="7.5" cy="7.5" r="2.5" fill="currentColor"/>
                  <path d="M7.5 1v1.5M7.5 12V13.5M1 7.5h1.5M12 7.5h1.5M3.22 3.22l1.06 1.06M10.72 10.72l1.06 1.06M3.22 11.78l1.06-1.06M10.72 4.28l1.06-1.06" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-60">
                  <path d="M12.5 9A6 6 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5Z" fill="currentColor"/>
                </svg>
              )}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>

            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
                <path d="M5 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2M10 10l3-3-3-3M13 7.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
