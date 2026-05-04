import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'

const NAV = [
  {
    to: '/', label: 'Dashboard', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/projects', label: 'Projects', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h2A2.5 2.5 0 0 1 9 4.5v.5H2v-.5ZM2 6h12v6.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5V6Z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/notes', label: 'Notes', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7.586a1 1 0 0 0 .707-.293l2.414-2.414A1 1 0 0 0 13 11V3a1 1 0 0 0-1-1H3Zm1 3h6v1H4V5Zm0 2.5h6v1H4v-1Zm0 2.5h4v1H4v-1Z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/team', label: 'Team', icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" fill="currentColor"/>
        <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4H1Z" fill="currentColor"/>
        <circle cx="12.5" cy="5.5" r="2" fill="currentColor" opacity=".5"/>
        <path d="M11 13c0-1.5.9-2.7 2.5-3H15c.6 0 1 .4 1 1v2h-5Z" fill="currentColor" opacity=".5"/>
      </svg>
    ),
  },
]

export default function Sidebar({ dark, onToggleDark, mobileOpen, onMobileClose }) {
  const { projects, currentUser } = useApp()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        ${mobileOpen ? 'flex' : 'hidden'} md:flex
        ${mobileOpen ? 'fixed inset-y-0 left-0 z-50' : ''}
        md:relative md:inset-auto md:z-auto
        ${collapsed ? 'w-[64px]' : 'w-[240px]'}
        flex-shrink-0 transition-[width] duration-300 ease-in-out flex-col
        bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl
        border-r border-gray-200/70 dark:border-zinc-800 overflow-hidden
      `}
    >
      {/* Header */}
      <div className={`flex items-center h-14 border-b border-gray-100 dark:border-zinc-800/60 flex-shrink-0 px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-zinc-100 select-none whitespace-nowrap">
            TaskFlow
          </span>
        )}
        {/* Close button — mobile only */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0 ml-auto"
            aria-label="Close navigation"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {collapsed
              ? <path d="M4 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M10 2L5 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto overflow-x-hidden" onClick={onMobileClose}>
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            title={collapsed ? n.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors whitespace-nowrap
              ${collapsed ? 'justify-center' : ''}
              ${isActive
                ? 'bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium'
                : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900/60 hover:text-gray-900 dark:hover:text-zinc-200'
              }`
            }
          >
            <span className="flex-shrink-0">{n.icon}</span>
            {!collapsed && <span>{n.label}</span>}
          </NavLink>
        ))}

        {/* Admin: Users link */}
        {currentUser?.role === 'admin' && (
          <NavLink
            to="/users"
            title={collapsed ? 'Users' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors whitespace-nowrap
              ${collapsed ? 'justify-center' : ''}
              ${isActive
                ? 'bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium'
                : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900/60 hover:text-gray-900 dark:hover:text-zinc-200'
              }`
            }
          >
            <span className="flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="4.5" r="2.5" fill="currentColor"/>
                <path d="M3 13c0-2.761 2.239-4 5-4s5 1.239 5 4H3Z" fill="currentColor"/>
                <circle cx="13" cy="5" r="1.5" fill="currentColor" opacity=".5"/>
                <path d="M12 9.5c1.1 0 2 .4 2.5 1H16v1.5h-4.5A3.5 3.5 0 0 0 12 9.5Z" fill="currentColor" opacity=".5"/>
              </svg>
            </span>
            {!collapsed && <span>Users</span>}
          </NavLink>
        )}

        {/* Projects section */}
        {!collapsed && projects.length > 0 && (
          <div className="mt-5">
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
              Projects
            </p>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900/60 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom — theme toggle */}
      <div className={`p-2 border-t border-gray-100 dark:border-zinc-800/60 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={onToggleDark}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          {dark
            ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="2.5" fill="currentColor"/>
                <path d="M7.5 1v1.5M7.5 12V13.5M1 7.5h1.5M12 7.5h1.5M3.22 3.22l1.06 1.06M10.72 10.72l1.06 1.06M3.22 11.78l1.06-1.06M10.72 4.28l1.06-1.06" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
            : <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12.5 9A6 6 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5Z" fill="currentColor"/>
              </svg>
          }
        </button>
      </div>
    </aside>
  )
}
