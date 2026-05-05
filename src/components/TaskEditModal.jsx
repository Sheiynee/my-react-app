import { useState, useEffect } from 'react'
import Modal from './Modal'
import RichTextEditor from './RichTextEditor'
import * as api from '../api'
import { useApp } from '../context/app-context'
import { canDo } from '../roles'
import { inputCls } from '../constants'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export default function TaskEditModal({
  mode,
  task,
  defaultStatus,
  projectId,
  columns,
  myRole,
  currentUid,
  onClose,
  onDelete,
}) {
  const { tasks, members, addTask, editTask, removeTask } = useApp()

  const [taskForm, setTaskForm] = useState(() => {
    if (mode === 'edit' && task) {
      return {
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assigneeIds: task.assigneeIds || [],
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
        parentId: task.parentId,
        links: task.links || [],
      }
    }
    return {
      title: '', description: '', status: defaultStatus || columns[0]?.key || 'todo',
      priority: 'medium', assigneeIds: [], dueDate: '', parentId: null, links: [],
    }
  })
  const [linkInput, setLinkInput] = useState({ url: '', label: '' })
  const [commentInput, setCommentInput] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [comments, setComments] = useState([])
  const [commentsError, setCommentsError] = useState(false)
  const [saving, setSaving] = useState(false)

  const subtasks = tasks.filter(t => t.parentId === task?.id)

  useEffect(() => {
    if (mode !== 'edit' || !task?.id) return
    setCommentsError(false)
    const ctrl = new AbortController()
    api.getComments(task.id, { signal: ctrl.signal })
      .then(setComments)
      .catch(err => { if (!err?.aborted) setCommentsError(true) })
    return () => ctrl.abort()
  }, [task?.id, mode])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setSaving(true)
    try {
      const data = { ...taskForm, title: taskForm.title.trim(), projectId, dueDate: taskForm.dueDate || null }
      if (mode === 'create') await addTask(data)
      else await editTask(task.id, data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleAddComment(e) {
    e?.preventDefault()
    if (!commentInput.trim()) return
    const comment = await api.createComment({ taskId: task.id, content: commentInput.trim() })
    setComments(prev => [...prev, comment])
    setCommentInput('')
  }

  async function handleDeleteComment(commentId) {
    await api.deleteComment(commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  function toggleAssignee(memberId) {
    setTaskForm(f => {
      const ids = f.assigneeIds || []
      return { ...f, assigneeIds: ids.includes(memberId) ? ids.filter(i => i !== memberId) : [...ids, memberId] }
    })
  }

  function addLink() {
    const url = linkInput.url.trim()
    if (!url) return
    try { new URL(url) } catch { alert('Please enter a valid URL (e.g. https://example.com)'); return }
    setTaskForm(f => ({ ...f, links: [...(f.links || []), { url, label: linkInput.label.trim() || url }] }))
    setLinkInput({ url: '', label: '' })
  }

  function removeLink(idx) {
    setTaskForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }))
  }

  async function addSubtask() {
    if (!subtaskInput.trim()) return
    await addTask({ title: subtaskInput.trim(), projectId, parentId: task.id, status: 'todo', priority: 'medium' })
    setSubtaskInput('')
  }

  return (
    <Modal title={mode === 'create' ? 'New Task' : 'Edit Task'} onClose={onClose} width="700px">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Title</span>
          <input autoFocus className={inputCls} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" required />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Status</span>
            <select className={inputCls} value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
              {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Priority</span>
            <select className={inputCls} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Due Date</span>
            <input type="date" className={inputCls} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </label>
        </div>

        {/* Assignees */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Assignees</p>
          {members.length === 0
            ? <p className="text-xs text-gray-400 dark:text-zinc-500">No team members yet.</p>
            : (
              <div className="flex flex-wrap gap-2">
                {members.map(m => {
                  const selected = (taskForm.assigneeIds || []).includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                      }`}
                      onClick={() => toggleAssignee(m.id)}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.color }}>
                        {m.name[0]?.toUpperCase()}
                      </span>
                      <span>{m.name}</span>
                      {selected && <span className="text-blue-500 text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Description</p>
          <RichTextEditor content={taskForm.description} onChange={html => setTaskForm(f => ({ ...f, description: html }))} />
        </div>

        {/* Links */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Links</p>
          {(taskForm.links || []).map((link, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-zinc-950 rounded-xl mb-2 border border-gray-100 dark:border-zinc-800">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-blue-600 dark:text-blue-400 truncate hover:underline">
                🔗 {link.label}
              </a>
              <button type="button" className="w-5 h-5 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs" onClick={() => removeLink(i)}>✕</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className={inputCls} placeholder="https://..." value={linkInput.url} onChange={e => setLinkInput(l => ({ ...l, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} />
            <input className={inputCls} placeholder="Label (optional)" value={linkInput.label} onChange={e => setLinkInput(l => ({ ...l, label: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} />
            <button type="button" className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={addLink}>Add</button>
          </div>
        </div>

        {/* Subtasks — edit mode only */}
        {mode === 'edit' && (
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Subtasks</p>
            <div className="space-y-1 mb-2">
              {subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={s.status === 'done'}
                    onChange={() => editTask(s.id, { status: s.status === 'done' ? 'todo' : 'done' })}
                    aria-label={`Mark "${s.title}" as ${s.status === 'done' ? 'incomplete' : 'complete'}`}
                    className="accent-emerald-500 w-4 h-4 flex-shrink-0"
                  />
                  <span className={`flex-1 text-sm ${s.status === 'done' ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-800 dark:text-zinc-200'}`}>{s.title}</span>
                  <button type="button" className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs" onClick={() => removeTask(s.id)}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} placeholder="Add subtask..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())} />
              <button type="button" className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={addSubtask}>Add</button>
            </div>
          </div>
        )}

        {/* Comments — edit mode only */}
        {mode === 'edit' && (
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Comments ({comments.length})</p>
            {commentsError && (
              <p className="text-xs text-red-500 mb-2">Failed to load comments. Please try again.</p>
            )}
            <div className="space-y-2 mb-3">
              {comments.map(c => (
                <div key={c.id} className="bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{c.authorName}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 flex-1">{new Date(c.createdAt).toLocaleString()}</span>
                    <button type="button" className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 transition-colors text-xs" onClick={() => handleDeleteComment(c.id)}>✕</button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-start">
              <textarea
                className={inputCls}
                placeholder="Write a comment... (Ctrl+Enter to post)"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                rows={2}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddComment(e)}
              />
              <button type="button" className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={handleAddComment}>Post</button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
          <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={onClose}>Cancel</button>
          {mode === 'edit' && (canDo(myRole, 'manager') || task?.createdBy === currentUid) && (
            <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 transition-colors" onClick={() => onDelete(task.id)}>Delete</button>
          )}
          <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : mode === 'create' ? 'Create Task' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
