import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import RichTextEditor from '../components/RichTextEditor'
import * as api from '../api'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'

const DEFAULT_COLUMNS = [
  { key: 'todo', label: 'Todo', color: '#8b949e' },
  { key: 'in_progress', label: 'In Progress', color: '#388bfd' },
  { key: 'done', label: 'Done', color: '#3fb950' },
]

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

const EMPTY_TASK = {
  title: '', description: '', status: 'todo', priority: 'medium',
  assigneeIds: [], dueDate: '', parentId: null, links: [],
}

function getAssigneeIds(task) {
  if (task.assigneeIds?.length) return task.assigneeIds
  if (task.assigneeId) return [task.assigneeId]
  return []
}

function DroppableColumn({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`kanban-cards${isOver ? ' drop-over' : ''}`}>
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (taskModal?.mode === 'edit' && taskModal.id) {
      api.getComments(taskModal.id).then(setComments).catch(console.error)
    } else {
      setComments([])
    }
  }, [taskModal?.id, taskModal?.mode])

  if (!project) return (
    <div className="page">
      <p className="text-muted">Project not found. <button className="btn-ghost" onClick={() => navigate('/projects')}>Go back</button></p>
    </div>
  )

  const subtasksOf = (taskId) => tasks.filter(t => t.parentId === taskId)
  const memberById = (mId) => members.find(m => m.id === mId)

  function openCreateTask(defaultStatus) {
    setTaskForm({ ...EMPTY_TASK, status: defaultStatus || columns[0]?.key || 'todo' })
    setTaskModal({ mode: 'create' })
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
    const data = { ...taskForm, projectId: id, dueDate: taskForm.dueDate || null }
    if (taskModal.mode === 'create') await addTask(data)
    else await editTask(taskModal.id, data)
    closeTaskModal()
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
    if (!linkInput.url.trim()) return
    const url = linkInput.url.trim()
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
      columns: [...f.columns, { key: `col_${Date.now()}`, label: 'New Column', color: '#8b949e' }],
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
    await editProject(id, projectForm)
    setEditProjectModal(false)
  }

  function handleDragStart({ active }) {
    setActiveTask(projectTasks.find(t => t.id === active.id) || null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over) return
    const task = projectTasks.find(t => t.id === active.id)
    if (!task || task.status === over.id) return
    await moveTask(task, over.id)
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
      <div className="task-card" onClick={() => openEditTask(task)}>
        <div className={`task-card-priority priority-bar-${task.priority}`} />
        <div className="task-card-body">
          <p className="task-card-title">{task.title}</p>
          <div className="task-card-meta">
            <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
            {subs.length > 0 && <span className="subtask-count">{doneSubs}/{subs.length}</span>}
            {task.links?.length > 0 && <span className="subtask-count">🔗 {task.links.length}</span>}
            {task.dueDate && (
              <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="task-card-footer">
            {assignees.length > 0 && (
              <div className="avatar-stack">
                {assignees.slice(0, 3).map(a => (
                  <span key={a.id} className="avatar-sm" style={{ background: a.color }} title={a.name}>
                    {a.name[0]?.toUpperCase()}
                  </span>
                ))}
                {assignees.length > 3 && (
                  <span className="avatar-sm" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
                    +{assignees.length - 3}
                  </span>
                )}
              </div>
            )}
            {col && (
              <div className="task-card-actions" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                {colIdx > 0 && <button className="btn-move" onClick={() => moveTask(task, columns[colIdx - 1].key)}>←</button>}
                {colIdx < columns.length - 1 && <button className="btn-move" onClick={() => moveTask(task, columns[colIdx + 1].key)}>→</button>}
                <button className="btn-icon danger sm" onClick={() => handleDeleteTask(task.id)}>✕</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="project-detail-title">
          <span className="project-color-bar" style={{ background: project.color }} />
          <div>
            <h2>{project.name}</h2>
            {project.description && <p className="text-muted">{project.description}</p>}
          </div>
        </div>
        <div className="row-gap">
          <span className="text-muted">{done}/{projectTasks.length} done · {progress}%</span>
          <button className="btn-ghost" onClick={openEditProject}>Edit</button>
          <button className="btn-ghost danger" onClick={handleDeleteProject}>Delete</button>
          <button className="btn-primary" onClick={() => openCreateTask()}>+ Add Task</button>
        </div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div className="progress-fill" style={{ width: `${progress}%`, background: project.color }} />
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` }}>
          {columns.map(col => {
            const colTasks = projectTasks.filter(t => t.status === col.key)
            return (
              <div key={col.key} className="kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-dot" style={{ background: col.color }} />
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="kanban-col-count">{colTasks.length}</span>
                  <button className="btn-icon" onClick={() => openCreateTask(col.key)} title="Add task">+</button>
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
        <DragOverlay>
          {activeTask && (
            <div style={{ opacity: 0.9, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
              <TaskCardContent task={activeTask} col={null} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task modal */}
      {taskModal && (
        <Modal title={taskModal.mode === 'create' ? 'New Task' : 'Edit Task'} onClose={closeTaskModal} width="720px">
          <form onSubmit={handleTaskSubmit} className="form">
            <label>Title *
              <input autoFocus value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" required />
            </label>

            <div className="form-row form-row-3">
              <label>Status
                <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                  {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <label>Priority
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </label>
              <label>Due Date
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
              </label>
            </div>

            {/* Assignees */}
            <div>
              <p className="form-section-label">Assignees</p>
              {members.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>No team members yet.</p>
              ) : (
                <div className="assignee-list">
                  {members.map(m => {
                    const selected = (taskForm.assigneeIds || []).includes(m.id)
                    return (
                      <button key={m.id} type="button" className={`assignee-chip${selected ? ' selected' : ''}`} onClick={() => toggleAssignee(m.id)}>
                        <span className="avatar-sm" style={{ background: m.color }}>{m.name[0]?.toUpperCase()}</span>
                        <span>{m.name}</span>
                        {selected && <span className="chip-check">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <p className="form-section-label">Description</p>
              <RichTextEditor content={taskForm.description} onChange={html => setTaskForm(f => ({ ...f, description: html }))} />
            </div>

            {/* Links */}
            <div>
              <p className="form-section-label">Links</p>
              {(taskForm.links || []).map((link, i) => (
                <div key={i} className="link-item">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">🔗 {link.label}</a>
                  <button type="button" className="btn-icon danger sm" onClick={() => removeLink(i)}>✕</button>
                </div>
              ))}
              <div className="link-add">
                <input placeholder="https://..." value={linkInput.url} onChange={e => setLinkInput(l => ({ ...l, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} />
                <input placeholder="Label (optional)" value={linkInput.label} onChange={e => setLinkInput(l => ({ ...l, label: e.target.value }))} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLink())} />
                <button type="button" className="btn-ghost" onClick={addLink}>Add</button>
              </div>
            </div>

            {/* Subtasks */}
            {taskModal.mode === 'edit' && (
              <div className="subtasks-section">
                <p className="form-section-label">Subtasks</p>
                {subtasksOf(taskModal.id).map(s => (
                  <div key={s.id} className="subtask-item">
                    <input type="checkbox" checked={s.status === 'done'} onChange={() => editTask(s.id, { status: s.status === 'done' ? 'todo' : 'done' })} />
                    <span className={s.status === 'done' ? 'line-through' : ''}>{s.title}</span>
                    <button type="button" className="btn-icon danger sm" onClick={() => removeTask(s.id)}>✕</button>
                  </div>
                ))}
                <div className="subtask-add">
                  <input value={subtaskInput} onChange={e => setSubtaskInput(e.target.value)} placeholder="Add subtask..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())} />
                  <button type="button" className="btn-ghost" onClick={addSubtask}>Add</button>
                </div>
              </div>
            )}

            {/* Comments */}
            {taskModal.mode === 'edit' && (
              <div className="comments-section">
                <p className="form-section-label">Comments ({comments.length})</p>
                <div className="comment-list">
                  {comments.map(c => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-header">
                        <span className="comment-author">{c.authorName}</span>
                        <span className="comment-time">{new Date(c.createdAt).toLocaleString()}</span>
                        <button type="button" className="btn-icon danger sm" onClick={() => handleDeleteComment(c.id)}>✕</button>
                      </div>
                      <p className="comment-content">{c.content}</p>
                    </div>
                  ))}
                </div>
                <div className="comment-add">
                  <input placeholder="Your name" value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} style={{ marginBottom: 6 }} />
                  <div className="comment-input-row">
                    <textarea placeholder="Write a comment... (Ctrl+Enter to post)" value={commentInput} onChange={e => setCommentInput(e.target.value)} rows={2} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddComment(e)} />
                    <button type="button" className="btn-ghost" onClick={handleAddComment}>Post</button>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={closeTaskModal}>Cancel</button>
              {taskModal.mode === 'edit' && (
                <button type="button" className="btn-ghost danger" onClick={() => handleDeleteTask(taskModal.id)}>Delete</button>
              )}
              <button type="submit" className="btn-primary">{taskModal.mode === 'create' ? 'Create Task' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit project modal */}
      {editProjectModal && (
        <Modal title="Edit Project" onClose={() => setEditProjectModal(false)} width="560px">
          <form onSubmit={handleProjectSave} className="form">
            <label>Name *
              <input autoFocus value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required />
            </label>
            <label>Description
              <textarea value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </label>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p className="form-section-label" style={{ margin: 0 }}>Columns</p>
                <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addColumn}>+ Add Column</button>
              </div>
              <div className="column-list">
                {(projectForm.columns || []).map((col, idx) => (
                  <div key={col.key} className="column-item">
                    <input type="color" value={col.color} onChange={e => updateColumn(idx, 'color', e.target.value)} className="column-color-input" title="Column color" />
                    <input value={col.label} onChange={e => updateColumn(idx, 'label', e.target.value)} placeholder="Column name" className="column-label-input" />
                    {(projectForm.columns || []).length > 1 && (
                      <button type="button" className="btn-icon danger sm" onClick={() => removeColumn(idx)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditProjectModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
