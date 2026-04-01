import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const COLORS = ['#388bfd', '#3fb950', '#d29922', '#f0883e', '#bc8cff', '#f85149', '#58a6ff', '#e85d9a']

const EMPTY_FORM = { name: '', description: '', color: '#388bfd' }

export default function Projects() {
  const { projects, tasks, members, addProject, editProject, removeProject } = useApp()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null) // null | { mode: 'create' | 'edit', data }
  const [form, setForm] = useState(EMPTY_FORM)

  function openCreate() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'create' })
  }
  function openEdit(p) {
    setForm({ name: p.name, description: p.description, color: p.color })
    setModal({ mode: 'edit', id: p.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (modal.mode === 'create') await addProject(form)
    else await editProject(modal.id, form)
    closeModal()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project and all its tasks?')) return
    await removeProject(id)
  }

  function taskStats(projectId) {
    const t = tasks.filter(x => x.projectId === projectId && !x.parentId)
    return { total: t.length, done: t.filter(x => x.status === 'done').length }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Projects</h2>
          <p className="text-muted">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Project</button>
      </div>

      {projects.length === 0
        ? (
          <div className="empty-page">
            <p className="empty-icon">📁</p>
            <p>No projects yet.</p>
            <button className="btn-primary" onClick={openCreate}>Create your first project</button>
          </div>
        )
        : (
          <div className="project-grid">
            {projects.map(p => {
              const stats = taskStats(p.id)
              const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0
              const projectMembers = members.filter(m => p.memberIds?.includes(m.id))

              return (
                <div key={p.id} className="project-card" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="project-card-accent" style={{ background: p.color }} />
                  <div className="project-card-body">
                    <div className="project-card-header">
                      <h3>{p.name}</h3>
                      <div className="row-gap" onClick={e => e.stopPropagation()}>
                        <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✎</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(p.id)} title="Delete">✕</button>
                      </div>
                    </div>
                    <p className="text-muted desc">{p.description || 'No description'}</p>

                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: p.color }} />
                    </div>
                    <div className="project-footer">
                      <span className="text-muted">{stats.done}/{stats.total} tasks</span>
                      <div className="avatar-stack">
                        {projectMembers.slice(0, 4).map(m => (
                          <span key={m.id} className="avatar-sm" style={{ background: m.color }} title={m.name}>
                            {m.name[0]?.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Project' : 'Edit Project'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="form">
            <label>Name *
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Project name"
                required
              />
            </label>
            <label>Description
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What's this project about?"
                rows={3}
              />
            </label>
            <label>Color
              <div className="color-picker">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-primary">
                {modal.mode === 'create' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}