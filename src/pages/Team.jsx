import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const COLORS = ['#388bfd', '#3fb950', '#d29922', '#f0883e', '#bc8cff', '#f85149', '#58a6ff', '#e85d9a']
const EMPTY = { name: '', role: '', discordId: '', color: '#388bfd' }

export default function Team() {
  const { members, tasks, addMember, editMember, removeMember } = useApp()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)

  function openCreate() { setForm(EMPTY); setModal({ mode: 'create' }) }
  function openEdit(m) {
    setForm({ name: m.name, role: m.role || '', discordId: m.discordId || '', color: m.color })
    setModal({ mode: 'edit', id: m.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (modal.mode === 'create') await addMember(form)
    else await editMember(modal.id, form)
    closeModal()
  }

  const taskCount = (id) => tasks.filter(t => t.assigneeId === id && !t.parentId).length
  const openCount = (id) => tasks.filter(t => t.assigneeId === id && t.status !== 'done' && !t.parentId).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Team</h2>
          <p className="text-muted">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Add Member</button>
      </div>

      {members.length === 0
        ? (
          <div className="empty-page">
            <p className="empty-icon">👥</p>
            <p>No team members yet.</p>
            <button className="btn-primary" onClick={openCreate}>Add your first member</button>
          </div>
        )
        : (
          <div className="team-grid">
            {members.map(m => (
              <div key={m.id} className="member-card">
                <div className="member-avatar" style={{ background: m.color }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div className="member-info">
                  <h3>{m.name}</h3>
                  {m.role && <p className="text-muted">{m.role}</p>}
                  {m.discordId && <p className="text-muted text-xs">Discord: {m.discordId}</p>}
                  <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                    {openCount(m.id)} open · {taskCount(m.id)} total tasks
                  </p>
                </div>
                <div className="member-actions">
                  <button className="btn-icon" onClick={() => openEdit(m)} title="Edit">✎</button>
                  <button className="btn-icon danger" onClick={() => removeMember(m.id)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Member' : 'Edit Member'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="form">
            <label>Name *
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                required
              />
            </label>
            <label>Role
              <input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Developer, Designer"
              />
            </label>
            <label>Discord Username
              <input
                value={form.discordId}
                onChange={e => setForm(f => ({ ...f, discordId: e.target.value }))}
                placeholder="e.g. username#0000"
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
                {modal.mode === 'create' ? 'Add Member' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}