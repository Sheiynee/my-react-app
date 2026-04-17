import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { priorityBadge, statusDot, stripHtml } from '../constants'

export default function Dashboard() {
  const { projects, tasks, members, notes } = useApp()
  const navigate = useNavigate()

  const openTasks = tasks.filter(t => t.status !== 'done' && !t.parentId)
  const doneTasks = tasks.filter(t => t.status === 'done' && !t.parentId)
  const inProgress = tasks.filter(t => t.status === 'in_progress' && !t.parentId)
  const overdue = tasks.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date())
  const recentTasks = [...tasks]
    .filter(t => !t.parentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)

  const projectName = (id) => projects.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="p-8 max-w-6xl">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Welcome back. Here's what's going on.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Projects" value={projects.length} color="#2563eb" onClick={() => navigate('/projects')} />
        <StatCard label="Open" value={openTasks.length} color="#d97706" />
        <StatCard label="In Progress" value={inProgress.length} color="#2563eb" />
        <StatCard label="Done" value={doneTasks.length} color="#16a34a" />
        <StatCard label="Team" value={members.length} color="#7c3aed" onClick={() => navigate('/team')} />
        {overdue.length > 0 && (
          <StatCard label="Overdue" value={overdue.length} color="#dc2626" />
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Tasks */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Recent Tasks</h3>
          </div>
          {recentTasks.length === 0
            ? <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">No tasks yet. Create a project to get started.</p>
            : (
              <ul className="space-y-0.5">
                {recentTasks.map(t => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() => navigate(`/projects/${t.projectId}`)}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[t.status] || 'bg-gray-300'}`} />
                    <span className="flex-1 text-sm text-gray-900 dark:text-zinc-100 truncate">{t.title}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${priorityBadge[t.priority]}`}>{t.priority}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0">{projectName(t.projectId)}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </div>

        {/* Recent Notes */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Recent Notes</h3>
            <button
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              onClick={() => navigate('/notes')}
            >
              View all
            </button>
          </div>
          {recentNotes.length === 0
            ? <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">No notes yet.</p>
            : (
              <ul className="space-y-1">
                {recentNotes.map(n => (
                  <li
                    key={n.id}
                    className="px-2 py-2.5 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() => navigate('/notes')}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{n.title || 'Untitled'}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate">{stripHtml(n.content).slice(0, 80)}</p>
                    {n.projectId && (
                      <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-full">
                        {projectName(n.projectId)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 transition-colors' : ''}`}
      onClick={onClick}
    >
      <span className="text-3xl font-semibold tracking-tight" style={{ color }}>{value}</span>
      <span className="text-xs text-gray-500 dark:text-zinc-400">{label}</span>
    </div>
  )
}
