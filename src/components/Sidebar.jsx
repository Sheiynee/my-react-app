import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/projects', label: 'Projects', icon: '📁' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/team', label: 'Team', icon: '👥' },
]

export default function Sidebar() {
  const { projects } = useApp()
  const navigate = useNavigate()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-dot" />
        <span className="brand-name">TaskFlow</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      {projects.length > 0 && (
        <div className="sidebar-section">
          <p className="sidebar-label">Projects</p>
          {projects.map(p => (
            <button
              key={p.id}
              className="sidebar-project"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <span className="project-dot" style={{ background: p.color }} />
              <span className="project-name">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}