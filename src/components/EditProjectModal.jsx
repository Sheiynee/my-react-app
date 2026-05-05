import { useState } from 'react'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'
import { useApp } from '../context/app-context'
import { inputCls } from '../constants'

export default function EditProjectModal({ project, columns, projectTasks, onClose }) {
  const { editProject, editTask } = useApp()

  const [projectForm, setProjectForm] = useState({
    name: project.name,
    description: project.description || '',
    color: project.color,
    columns: columns.map(c => ({ ...c })),
  })
  const [saving, setSaving] = useState(false)
  const [confirmCol, setConfirmCol] = useState(null) // { idx, count, moveTo }

  function addColumn() {
    setProjectForm(f => ({
      ...f,
      columns: [...f.columns, { key: `col_${Date.now()}`, label: 'New Column', color: '#9ca3af' }],
    }))
  }

  function updateColumn(idx, field, value) {
    setProjectForm(f => ({ ...f, columns: f.columns.map((c, i) => i === idx ? { ...c, [field]: value } : c) }))
  }

  function moveColumn(idx, dir) {
    setProjectForm(f => {
      const cols = [...f.columns]
      const target = idx + dir
      if (target < 0 || target >= cols.length) return f
      ;[cols[idx], cols[target]] = [cols[target], cols[idx]]
      return { ...f, columns: cols }
    })
  }

  function requestRemoveColumn(idx) {
    const col = projectForm.columns[idx]
    const colTasks = projectTasks.filter(t => t.status === col.key)
    if (colTasks.length > 0) {
      const first = projectForm.columns.find((_, i) => i !== idx)
      if (!first) return
      setConfirmCol({ idx, count: colTasks.length, moveTo: first.label, firstKey: first.key })
    } else {
      setProjectForm(f => ({ ...f, columns: f.columns.filter((_, i) => i !== idx) }))
    }
  }

  async function confirmRemoveColumn() {
    const { idx, firstKey } = confirmCol
    const col = projectForm.columns[idx]
    const colTasks = projectTasks.filter(t => t.status === col.key)
    await Promise.all(colTasks.map(t => editTask(t.id, { status: firstKey })))
    setProjectForm(f => ({ ...f, columns: f.columns.filter((_, i) => i !== idx) }))
    setConfirmCol(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await editProject(project.id, projectForm)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal title="Edit Project" onClose={onClose} width="540px">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Name</span>
            <input autoFocus className={inputCls} value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Description</span>
            <textarea className={inputCls} value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Columns</p>
              <button type="button" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors" onClick={addColumn}>+ Add Column</button>
            </div>
            <div className="space-y-2">
              {(projectForm.columns || []).map((col, idx, arr) => (
                <div key={col.key} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button type="button" disabled={idx === 0} onClick={() => moveColumn(idx, -1)} className="w-5 h-4 flex items-center justify-center rounded text-gray-300 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]">▲</button>
                    <button type="button" disabled={idx === arr.length - 1} onClick={() => moveColumn(idx, 1)} className="w-5 h-4 flex items-center justify-center rounded text-gray-300 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]">▼</button>
                  </div>
                  <input type="color" value={col.color} onChange={e => updateColumn(idx, 'color', e.target.value)} aria-label={`Color for column ${col.label}`} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-700 cursor-pointer p-0.5 flex-shrink-0" />
                  <input className={inputCls} value={col.label} onChange={e => updateColumn(idx, 'label', e.target.value)} placeholder="Column name" />
                  {arr.length > 1 && (
                    <button type="button" className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs" onClick={() => requestRemoveColumn(idx)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {confirmCol && (
        <ConfirmModal
          title="Remove column"
          message={`Move ${confirmCol.count} task(s) to "${confirmCol.moveTo}" and delete this column?`}
          confirmLabel="Move & Delete"
          dangerous
          onConfirm={confirmRemoveColumn}
          onClose={() => setConfirmCol(null)}
        />
      )}
    </>
  )
}
