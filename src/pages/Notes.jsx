import { useState } from 'react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const EMPTY = { title: '', content: '', projectId: '' }

export default function Notes() {
  const { notes, projects, addNote, editNote, removeNote } = useApp()
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const filtered = [...notes]
    .filter(n => !filter || n.projectId === filter)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  function openCreate() {
    setForm(EMPTY)
    setModal({ mode: 'create' })
  }
  function openEdit(n) {
    setForm({ title: n.title, content: n.content, projectId: n.projectId || '' })
    setModal({ mode: 'edit', id: n.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    const data = { ...form, projectId: form.projectId || null }
    if (modal.mode === 'create') await addNote(data)
    else await editNote(modal.id, data)
    closeModal()
  }

  const projectName = (id) => projects.find(p => p.id === id)?.name

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Notes</h2>
          <p className="text-muted">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Note</button>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? (
          <div className="empty-page">
            <p className="empty-icon">📝</p>
            <p>No notes yet.</p>
            <button className="btn-primary" onClick={openCreate}>Add your first note</button>
          </div>
        )
        : (
          <div className="notes-grid">
            {filtered.map(n => (
              <div key={n.id} className="note-card" onClick={() => openEdit(n)}>
                <div className="note-card-header">
                  <h3>{n.title || 'Untitled'}</h3>
                  <button
                    className="btn-icon danger"
                    onClick={e => { e.stopPropagation(); removeNote(n.id) }}
                    title="Delete"
                  >✕</button>
                </div>
                <p className="note-content">{n.content.slice(0, 120)}{n.content.length > 120 ? '…' : ''}</p>
                <div className="note-card-footer">
                  {n.projectId && <span className="tag">{projectName(n.projectId)}</span>}
                  <span className="text-muted text-xs">{new Date(n.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Note' : 'Edit Note'} onClose={closeModal} width="560px">
          <form onSubmit={handleSubmit} className="form">
            <label>Title
              <input
                autoFocus
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Note title"
              />
            </label>
            <label>Content *
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write your note..."
                rows={8}
                required
              />
            </label>
            <label>Project
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn-primary">
                {modal.mode === 'create' ? 'Save Note' : 'Update Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}