import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777']

const inputCls = "w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"

const EMPTY_FORM = { name: '', description: '', color: '#2563eb' }

export default function Projects() {
  const { projects, tasks, members, addProject, editProject, removeProject } = useApp()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function openCreate() { setForm(EMPTY_FORM); setModal({ mode: 'create' }) }
  function openEdit(p) {
    setForm({ name: p.name, description: p.description || '', color: p.color })
    setModal({ mode: 'edit', id: p.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (modal.mode === 'create') await addProject(form)
      else await editProject(modal.id, form)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this project and all its tasks?')) return
    await removeProject(id)
  }

  function taskStats(projectId) {
    const t = tasks.filter(x => x.projectId === projectId && !x.parentId)
    return { total: t.length, done: t.filter(x => x.status === 'done').length }
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Projects</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          onClick={openCreate}
        >
          New Project
        </button>
      </div>

      {projects.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-2xl">📁</div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">No projects yet</p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mb-5">Create your first project to get started.</p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              onClick={openCreate}
            >
              Create project
            </button>
          </div>
        )
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => {
              const stats = taskStats(p.id)
              const progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0
              const projectMembers = members.filter(m => p.memberIds?.includes(m.id))

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:border-blue-200 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  {/* Color accent top bar */}
                  <div className="h-1" style={{ background: p.color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 leading-snug">{p.name}</h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                          onClick={() => openEdit(p)}
                          title="Edit"
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9.5 1.5a1.414 1.414 0 0 1 2 2L4 11H1.5V8.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          onClick={(e) => handleDelete(e, p.id)}
                          title="Delete"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 truncate">{p.description || 'No description'}</p>

                    {/* Progress bar */}
                    <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: p.color }} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-zinc-500">{stats.done}/{stats.total} tasks</span>
                      <div className="flex">
                        {projectMembers.slice(0, 4).map((m, i) => (
                          <span
                            key={m.id}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: m.color, marginLeft: i > 0 ? -6 : 0 }}
                            title={m.name}
                          >
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
        )
      }

      {modal && (
        <Modal title={modal.mode === 'create' ? 'New Project' : 'Edit Project'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Name</span>
              <input autoFocus className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Project name" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Description</span>
              <textarea className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this project about?" rows={3} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Color</span>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select color ${c}`}
                    aria-pressed={form.color === c}
                    className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-300 dark:ring-zinc-600' : 'hover:scale-110'}`}
                    style={{ background: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors" onClick={closeModal}>Cancel</button>
              <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
