import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'

export default function NotificationBell() {
  const { tasks, projects } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const now = new Date()
  const overdue = tasks.filter(
    t => !t.parentId && t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now
  ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))

  const projectName = id => projects.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        aria-label={overdue.length ? `${overdue.length} overdue task${overdue.length !== 1 ? 's' : ''}` : 'Notifications'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.25L2 9.75v.75h12v-.75L12.5 8.25V6A4.5 4.5 0 0 0 8 1.5ZM6.5 12a1.5 1.5 0 0 0 3 0" fill="currentColor"/>
        </svg>
        {overdue.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {overdue.length > 9 ? '9+' : overdue.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-76 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50" style={{ width: 300 }}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {overdue.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">All caught up!</p>
            ) : (
              <div className="p-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-600 px-2 mb-1">
                  Overdue · {overdue.length} task{overdue.length !== 1 ? 's' : ''}
                </p>
                {overdue.map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => { navigate(`/projects/${t.projectId}`); setOpen(false) }}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{t.title}</p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5">
                      <span className="text-red-500 font-medium">
                        {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-gray-300 dark:text-zinc-700">·</span>
                      <span className="text-gray-400 dark:text-zinc-500 truncate">{projectName(t.projectId)}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
