import { useState } from 'react'
import { useApp } from '../context/app-context'
import Modal from '../components/Modal'
import { stripHtml } from '../constants'
import { canDo } from '../roles'
import { auth } from '../firebase'

const inputCls = "w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"

const EMPTY = { title: '', content: '', projectId: '' }

export default function Notes() {
  const { notes, projects, addNote, editNote, removeNote, getProjectRole } = useApp()
  const currentUid = auth.currentUser?.uid
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const filtered = [...notes]
    .filter(n => !filter || n.projectId === filter)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

  function openCreate() { setForm(EMPTY); setModal({ mode: 'create' }) }
  function openEdit(n) {
    setForm({ title: n.title, content: n.content, projectId: n.projectId || '' })
    setModal({ mode: 'edit', id: n.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    const data = { ...form, projectId: form.projectId || null }
    setSaving(true)
    try {
      if (modal.mode === 'create') await addNote(data)
      else await editNote(modal.id, data)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const projectName = (id) => projects.find(p => p.id === id)?.name

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Notes</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          onClick={openCreate}
        >
          New Note
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          aria-label="Filter by project"
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors max-w-[200px]"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-2xl">📝</div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">No notes yet</p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mb-5">Capture ideas, meeting notes, and more.</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors" onClick={openCreate}>
              Add your first note
            </button>
          </div>
        )
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(n => (
              <div
                key={n.id}
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:border-blue-200 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => openEdit(n)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 leading-snug">{n.title || 'Untitled'}</h3>
                  {(canDo(getProjectRole(n.projectId), 'manager') || n.createdBy === currentUid || !n.projectId) && (
                    <button
                      className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-lg text-gray-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                      onClick={e => { e.stopPropagation(); if (confirm('Delete this note?')) removeNote(n.id) }}
                      title="Delete"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed mb-4 line-clamp-3">
                  {stripHtml(n.content)}
                </p>
                <div className="flex items-center justify-between">
                  {n.projectId
                    ? <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-full">{projectName(n.projectId)}</span>
                    : <span />
                  }
                  <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                    {n.createdByName && <>{n.createdByName} · </>}
                    {n.updatedAt && new Date(n.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Note' : 'Edit Note'} onClose={closeModal} width="560px">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Title</span>
              <input autoFocus className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Note title" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Content</span>
              <textarea className={inputCls} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your note..." rows={8} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Project</span>
              <select className={inputCls} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                <option value="">None</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={closeModal}>Cancel</button>
              <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Save Note' : 'Update Note'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
