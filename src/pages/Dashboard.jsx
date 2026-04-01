import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Dashboard() {
  const { projects, tasks, members, notes } = useApp()
  const navigate = useNavigate()

  const openTasks = tasks.filter(t => t.status !== 'done' && !t.parentId)
  const doneTasks = tasks.filter(t => t.status === 'done' && !t.parentId)
  const inProgress = tasks.filter(t => t.status === 'in_progress' && !t.parentId)
  const overdue = tasks.filter(t =>
    t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()
  )
  const recentTasks = [...tasks]
    .filter(t => !t.parentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4)

  const projectName = (id) => projects.find(p => p.id === id)?.name ?? '—'

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p className="text-muted">Welcome back. Here's what's going on.</p>
      </div>

      <div className="stats-grid">
        <StatCard label="Projects" value={projects.length} color="var(--blue)" icon="📁" onClick={() => navigate('/projects')} />
        <StatCard label="Open Tasks" value={openTasks.length} color="var(--yellow)" icon="📋" />
        <StatCard label="In Progress" value={inProgress.length} color="var(--blue)" icon="🔄" />
        <StatCard label="Done" value={doneTasks.length} color="var(--green)" icon="✅" />
        {overdue.length > 0 && (
          <StatCard label="Overdue" value={overdue.length} color="var(--red)" icon="⚠️" />
        )}
        <StatCard label="Team" value={members.length} color="var(--purple)" icon="👥" onClick={() => navigate('/team')} />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h3>Recent Tasks</h3>
          </div>
          {recentTasks.length === 0
            ? <p className="text-muted empty-msg">No tasks yet. Create a project to get started.</p>
            : (
              <ul className="task-list">
                {recentTasks.map(t => (
                  <li key={t.id} className="task-list-item" onClick={() => navigate(`/projects/${t.projectId}`)}>
                    <span className={`status-dot status-${t.status}`} />
                    <span className="task-list-title">{t.title}</span>
                    <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                    <span className="text-muted task-project">{projectName(t.projectId)}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Recent Notes</h3>
            <button className="btn-ghost" onClick={() => navigate('/notes')}>View all</button>
          </div>
          {recentNotes.length === 0
            ? <p className="text-muted empty-msg">No notes yet.</p>
            : (
              <ul className="note-list">
                {recentNotes.map(n => (
                  <li key={n.id} className="note-list-item" onClick={() => navigate('/notes')}>
                    <p className="note-list-title">{n.title}</p>
                    <p className="note-list-preview">{n.content.slice(0, 80)}{n.content.length > 80 ? '…' : ''}</p>
                    {n.projectId && <span className="tag">{projectName(n.projectId)}</span>}
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon, onClick }) {
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <span className="stat-icon">{icon}</span>
      <div>
        <p className="stat-value" style={{ color }}>{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  )
}