import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import RichTextEditor from '../components/RichTextEditor'
import * as api from '../api'
import { priorityBadge } from '../constants'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'

const DEFAULT_COLUMNS = [
  { key: 'todo', label: 'Todo', color: '#9ca3af' },
  { key: 'in_progress', label: 'In Progress', color: '#2563eb' },
  { key: 'done', label: 'Done', color: '#16a34a' },
]

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

const EMPTY_TASK = {
  title: '', description: '', status: 'todo', priority: 'medium',
  assigneeIds: [], dueDate: '', parentId: null, links: [],
}

const inputCls = "w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"

function getAssigneeIds(task) {
  if (task.assigneeIds?.length) return task.assigneeIds
  if (task.assigneeId) return [task.assigneeId]
  return []
}

function DroppableColumn({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-2 min-h-[80px] p-2 rounded-xl transition-colors ${isOver ? 'drop-over' : ''}`}>
      {children}
    </div>
  )
}

function DraggableCard({ task, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0 : 1, cursor: 'grab' }} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, tasks, members, editProject, removeProject, addTask, editTask, removeTask } = useApp()

  const project = projects.find(p => p.id === id)
  const columns = project?.columns?.length ? project.columns : DEFAULT_COLUMNS
  const projectTasks = tasks.filter(t => t.projectId === id && !t.parentId)

  const [taskModal, setTaskModal] = useState(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK)
  const [linkInput, setLinkInput] = useState({ url: '', label: '' })
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [activeTask, setActiveTask] = useState(null)
  const [editProjectModal, setEditProjectModal] = useState(false)
  const [projectForm, setProjectForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (taskModal?.mode === 'edit' && taskModal.id) {
      api.getComments(taskModal.id).then(setComments).catch(console.error)
    } else {
      setComments([])
    }
  }, [taskModal?.id, taskModal?.mode])

  if (!project) return (
    <div className="p-8">
      <p className="text-sm text-gray-500 dark:text-zinc-400">
        Project not found.{' '}
        <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => navigate('/projects')}>Go back</button>
      </p>
    </div>
  )

  const subtasksOf = (taskId) => tasks.filter(t => t.parentId === taskId)
  const memberById = (mId) => members.find(m => m.id === mId)

  function openCreateTask(defaultStatus) {
    setTaskForm({ ...EMPTY_TASK, status: defaultStatus || columns[0]?.key || 'todo' })
    setTaskModal({ mode: 'create' })
  }

  function openViewTask(task) {
    setTaskModal({ mode: 'view', id: task.id, task })
  }

  function openEditTask(task) {
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigneeIds: getAssigneeIds(task),
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      parentId: task.parentId,
      links: task.links || [],
    })
    setTaskModal({ mode: 'edit', id: task.id })
  }

  function closeTaskModal() {
    setTaskModal(null)
    setSubtaskInput('')
    setCommentInput('')
    setLinkInput({ url: '', label: '' })
  }

  async function handleTaskSubmit(e) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setSaving(true)
    try {
      const data = { ...taskForm, title: taskForm.title.trim(), projectId: id, dueDate: taskForm.dueDate || null }
      if (taskModal.mode === 'create') await addTask(data)
      else await editTask(taskModal.id, data)
      closeTaskModal()
    } finally {
      setSaving(false)
    }
  }

  async function addSubtask() {
    if (!subtaskInput.trim() || taskModal.mode !== 'edit') return
    await addTask({ title: subtaskInput.trim(), projectId: id, parentId: taskModal.id, status: 'todo', priority: 'medium' })
    setSubtaskInput('')
  }

  async function handleAddComment(e) {
    e?.preventDefault()
    if (!commentInput.trim()) return
    const comment = await api.createComment({
      taskId: taskModal.id,
      content: commentInput.trim(),
      authorName: commentAuthor.trim() || 'Anonymous',
    })
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

  async function moveTask(task, status) {
    await editTask(task.id, { status })
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task?')) return
    await removeTask(taskId)
    if (taskModal?.id === taskId) closeTaskModal()
  }

  async function handleDeleteProject() {
    if (!confirm('Delete this project and all its tasks?')) return
    await removeProject(id)
    navigate('/projects')
  }

  function openEditProject() {
    setProjectForm({
      name: project.name,
      description: project.description || '',
      color: project.color,
      columns: columns.map(c => ({ ...c })),
    })
    setEditProjectModal(true)
  }

  function addColumn() {
    setProjectForm(f => ({
      ...f,
      columns: [...f.columns, { key: `col_${Date.now()}`, label: 'New Column', color: '#9ca3af' }],
    }))
  }

  function updateColumn(idx, field, value) {
    setProjectForm(f => ({ ...f, columns: f.columns.map((c, i) => i === idx ? { ...c, [field]: value } : c) }))
  }

  async function removeColumn(idx) {
    const col = projectForm.columns[idx]
    const colTasks = projectTasks.filter(t => t.status === col.key)
    if (colTasks.length > 0) {
      const first = projectForm.columns.find((_, i) => i !== idx)
      if (!first) return
      if (!confirm(`Move ${colTasks.length} task(s) to "${first.label}" and delete this column?`)) return
      await Promise.all(colTasks.map(t => editTask(t.id, { status: first.key })))
    }
    setProjectForm(f => ({ ...f, columns: f.columns.filter((_, i) => i !== idx) }))
  }

  async function handleProjectSave(e) {
    e.preventDefault()
    setProjectSaving(true)
    try {
      await editProject(id, projectForm)
      setEditProjectModal(false)
    } finally {
      setProjectSaving(false)
    }
  }

  function handleDragStart({ active }) {
    setActiveTask(projectTasks.find(t => t.id === active.id) || null)
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over) return
    const task = projectTasks.find(t => t.id === active.id)
    if (!task || task.status === over.id) return
    moveTask(task, over.id)
  }

  const lastColKey = columns[columns.length - 1]?.key
  const done = projectTasks.filter(t => t.status === lastColKey || t.status === 'done').length
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0

  function TaskCardContent({ task, col }) {
    const assigneeIds = getAssigneeIds(task)
    const assignees = assigneeIds.map(memberById).filter(Boolean)
    const subs = subtasksOf(task.id)
    const doneSubs = subs.filter(s => s.status === 'done').length
    const isOverdue = task.dueDate && task.status !== lastColKey && task.status !== 'done' && new Date(task.dueDate) < new Date()
    const colIdx = col ? columns.findIndex(c => c.key === col.key) : -1

    return (
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-blue-200 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer flex group"
        onClick={() => openViewTask(task)}
      >
        <div className={`w-1 flex-shrink-0 priority-bar-${task.priority}`} />
        <div className="flex-1 p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2 leading-snug">{task.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${priorityBadge[task.priority]}`}>
              {task.priority}
            </span>
            {subs.length > 0 && (
              <span className="text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                {doneSubs}/{subs.length}
              </span>
            )}
            {task.links?.length > 0 && (
              <span className="text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                🔗 {task.links.length}
              </span>
            )}
            {task.dueDate && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${isOverdue ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800'}`}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            {assignees.length > 0 && (
              <div className="flex">
                {assignees.slice(0, 3).map((a, i) => (
                  <span
                    key={a.id}
                    className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: a.color, marginLeft: i > 0 ? -4 : 0 }}
                    title={a.name}
                  >
                    {a.name[0]?.toUpperCase()}
                  </span>
                ))}
                {assignees.length > 3 && (
                  <span className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] text-gray-500 dark:text-zinc-400" style={{ marginLeft: -4 }}>
                    +{assignees.length - 3}
                  </span>
                )}
              </div>
            )}
            {col && (
              <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                {colIdx > 0 && (
                  <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 transition-colors text-xs" onClick={() => moveTask(task, columns[colIdx - 1].key)}>←</button>
                )}
                {colIdx < columns.length - 1 && (
                  <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 transition-colors text-xs" onClick={() => moveTask(task, columns[colIdx + 1].key)}>→</button>
                )}
                <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors text-xs" onClick={() => handleDeleteTask(task.id)}>✕</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: project.color }} />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">{project.name}</h2>
            {project.description && <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{project.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-zinc-500">{done}/{projectTasks.length} done · {progress}%</span>
          <button className="text-sm font-medium px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={openEditProject}>Edit</button>
          <button className="text-sm font-medium px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors" onClick={handleDeleteProject}>Delete</button>
          <button className="text-sm font-medium px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors" onClick={() => openCreateTask()}>+ Add Task</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-7">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: project.color }} />
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto -mx-8 px-8 pb-2">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))`, minWidth: `${columns.length * 276}px` }}>
          {columns.map(col => {
            const colTasks = projectTasks.filter(t => t.status === col.key)
            return (
              <div key={col.key} className="bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-zinc-800/60 rounded-2xl flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800/60">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{col.label}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full ml-0.5">{colTasks.length}</span>
                  <button
                    className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors text-base leading-none"
                    onClick={() => openCreateTask(col.key)}
                    aria-label={`Add task to ${col.label}`}
                    title="Add task"
                  >+</button>
                </div>
                <DroppableColumn id={col.key}>
                  {colTasks.map(task => (
                    <DraggableCard key={task.id} task={task}>
                      <TaskCardContent task={task} col={col} />
                    </DraggableCard>
                  ))}
                </DroppableColumn>
              </div>
            )
          })}
        </div>
        </div>
        <DragOverlay>
          {activeTask && (
            <div style={{ transform: 'rotate(2deg)', pointerEvents: 'none', opacity: 0.9 }}>
              <TaskCardContent task={activeTask} col={null} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* View task modal */}
      {taskModal?.mode === 'view' && (() => {
        const t = taskModal.task
        const assigneeIds = getAssigneeIds(t)
        const assignees = assigneeIds.map(memberById).filter(Boolean)
        const subs = subtasksOf(t.id)
        const isOverdue = t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()
        return (
          <Modal title={t.title} onClose={closeTaskModal} width="600px">
            <div className="flex flex-col gap-4">
              {/* Meta row */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${priorityBadge[t.priority]}`}>{t.priority}</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 capitalize">{t.status.replace('_', ' ')}</span>
                {t.dueDate && (
                  <span className={`text-xs px-2.5 py-1 rounded-full ${isOverdue ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800'}`}>
                    Due {new Date(t.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              {(t.createdByName || t.createdAt) && (
                <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                  {t.createdByName && <>Created by <span className="font-medium">{t.createdByName}</span></>}
                  {t.createdByName && t.createdAt && ' · '}
                  {t.createdAt && new Date(t.createdAt).toLocaleDateString()}
                </p>
              )}

              {/* Assignees */}
              {assignees.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Assignees</p>
                  <div className="flex flex-wrap gap-2">
                    {assignees.map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: a.color }}>{a.name[0]?.toUpperCase()}</span>
                        <span className="text-sm text-gray-700 dark:text-zinc-300">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {t.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Description</p>
                  <div className="text-sm text-gray-700 dark:text-zinc-300 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: t.description }} />
                </div>
              )}

              {/* Links */}
              {t.links?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Links</p>
                  <div className="flex flex-col gap-1.5">
                    {t.links.map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">🔗 {link.label}</a>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks */}
              {subs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Subtasks ({subs.filter(s => s.status === 'done').length}/{subs.length})</p>
                  <div className="space-y-1">
                    {subs.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.status === 'done' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                        <span className={`text-sm ${s.status === 'done' ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-300'}`}>{s.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors" onClick={() => handleDeleteTask(t.id)}>Delete</button>
                <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors" onClick={() => openEditTask(t)}>Edit</button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Task modal */}
      {taskModal && taskModal.mode !== 'view' && (
        <Modal title={taskModal.mode === 'create' ? 'New Task' : 'Edit Task'} onClose={closeTaskModal} width="700px">
          <form onSubmit={handleTaskSubmit} className="flex flex-col gap-4">
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

            {/* Subtasks */}
            {taskModal.mode === 'edit' && (
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Subtasks</p>
                <div className="space-y-1 mb-2">
                  {subtasksOf(taskModal.id).map(s => (
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

            {/* Comments */}
            {taskModal.mode === 'edit' && (
              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Comments ({comments.length})</p>
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
                <input className={`${inputCls} mb-2`} placeholder="Your name" value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} />
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
              <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={closeTaskModal}>Cancel</button>
              {taskModal.mode === 'edit' && (
                <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 transition-colors" onClick={() => handleDeleteTask(taskModal.id)}>Delete</button>
              )}
              <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : taskModal.mode === 'create' ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit project modal */}
      {editProjectModal && (
        <Modal title="Edit Project" onClose={() => setEditProjectModal(false)} width="540px">
          <form onSubmit={handleProjectSave} className="flex flex-col gap-4">
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
                {(projectForm.columns || []).map((col, idx) => (
                  <div key={col.key} className="flex items-center gap-2">
                    <input type="color" value={col.color} onChange={e => updateColumn(idx, 'color', e.target.value)} aria-label={`Color for column ${col.label}`} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-700 cursor-pointer p-0.5 flex-shrink-0" />
                    <input className={inputCls} value={col.label} onChange={e => updateColumn(idx, 'label', e.target.value)} placeholder="Column name" />
                    {(projectForm.columns || []).length > 1 && (
                      <button type="button" className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs" onClick={() => removeColumn(idx)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={() => setEditProjectModal(false)}>Cancel</button>
              <button type="submit" disabled={projectSaving} className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {projectSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
