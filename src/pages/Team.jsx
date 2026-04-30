import { useState } from 'react'
import { useApp } from '../context/app-context'
import Modal from '../components/Modal'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777']
const EMPTY = { name: '', role: '', discordId: '', color: '#2563eb' }

const inputCls = "w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"

export default function Team() {
  const { members, tasks, addMember, editMember, removeMember } = useApp()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function openCreate() { setForm(EMPTY); setModal({ mode: 'create' }) }
  function openEdit(m) {
    setForm({ name: m.name, role: m.role || '', discordId: m.discordId || '', color: m.color })
    setModal({ mode: 'edit', id: m.id })
  }
  function closeModal() { setModal(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (modal.mode === 'create') await addMember(form)
      else await editMember(modal.id, form)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const taskCount = (id) => tasks.filter(t => t.assigneeIds?.includes(id) && !t.parentId).length
  const openCount = (id) => tasks.filter(t => t.assigneeIds?.includes(id) && t.status !== 'done' && !t.parentId).length

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">Team</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          onClick={openCreate}
        >
          Add Member
        </button>
      </div>

      {members.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-2xl">👥</div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">No team members yet</p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mb-5">Add your team to assign tasks and track work.</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors" onClick={openCreate}>
              Add your first member
            </button>
          </div>
        )
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(m => (
              <div key={m.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-start gap-4 group hover:border-gray-200 dark:hover:border-zinc-700 transition-colors">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                  style={{ background: m.color }}
                >
                  {m.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{m.name}</h3>
                  {m.role && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{m.role}</p>}
                  {m.discordId && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Discord: {m.discordId}</p>}
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                    {openCount(m.id)} open · {taskCount(m.id)} total tasks
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                    onClick={() => openEdit(m)}
                    aria-label={`Edit ${m.name}`}
                    title="Edit"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9.5 1.5a1.414 1.414 0 0 1 2 2L4 11H1.5V8.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    onClick={() => { if (confirm(`Remove ${m.name} from the team?`)) removeMember(m.id) }}
                    aria-label={`Remove ${m.name}`}
                    title="Remove"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add Member' : 'Edit Member'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Name</span>
              <input autoFocus className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Role</span>
              <input className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Developer, Designer" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Discord Username</span>
              <input className={inputCls} value={form.discordId} onChange={e => setForm(f => ({ ...f, discordId: e.target.value }))} placeholder="e.g. username#0000" />
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
              <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={closeModal}>Cancel</button>
              <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Add Member' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
