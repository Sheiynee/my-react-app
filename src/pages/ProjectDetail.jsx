import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core'

const STATUSES = [
  { key: 'todo', label: 'Todo', color: 'var(--text-muted)' },
  { key: 'in_progress', label: 'In Progress', color: 'var(--blue)' },
  { key: 'done', label: 'Done', color: 'var(--green)' },
]

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

const EMPTY_TASK = {
  title: '', description: '', status: 'todo', priority: 'medium',
  assigneeId: '', dueDate: '', parentId: null,
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
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1, cursor: 'grab' }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, tasks, members, editProject, removeProject, addTask, editTask, removeTask } = useApp()

  const project = projects.find(p => p.id === id)
  const projectTasks = tasks.filter(t => t.projectId === id && !t.parentId)

  const [taskModal, setTaskModal] = useState(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK)
  const [editProjectModal, setEditProjectModal] = useState(false)
  const [projectForm, setProjectForm] = useState({})
  const [subtaskInput, setSubtaskInput] = useState('')
  const [activeTask, setActiveTask] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  if (!project) return (
    <div className="page">
      <p className="text-muted">Project not found. <button className="btn-ghost" onClick={() => navigate('/projects')}>Go back</button></p>
    </div>
  )

  const subtasksOf = (taskId) => tasks.filter(t => t.parentId === taskId)
  const memberById = (mId) => members.find(m => m.id === mId)

  function openCreateTask(defaultStatus = 'todo') {
    setTaskForm({ ...EMPTY_TASK, status: defaultStatus })
    setTaskModal({ mode: 'create' })
  }
  function openEditTask(task) {
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId || '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      parentId: task.parentId,
    })
    setTaskModal({ mode: 'edit', id: task.id })
  }
  function closeTaskModal() { setTaskModal(null); setSubtaskInput('') }

  async function handleTaskSubmit(e) {
    e.preventDefault()
    const data = {
      ...taskForm,
      projectId: id,
      assigneeId: taskForm.assigneeId || null,
      dueDate: taskForm.dueDate || null,
    }
    if (taskModal.mode === 'create') await addTask(data)
    else await editTask(taskModal.id, data)
    closeTaskModal()
  }

  async function addSubtask() {
    if (!subtaskInput.trim() || taskModal.mode !== 'edit') return
    await addTask({
      title: subtaskInput.trim(),
      projectId: id,
      parentId: taskModal.id,
      status: 'todo',
      priority: 'medium',
    })
    setSubtaskInput('')
  }

  async function moveTask(task, status) {
    await editTask(task.id, { status })
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task?')) return
    await removeTask(taskId)
  }

  async function handleDeleteProject() {
    if (!confirm('Delete this project and all its tasks?')) return
    await removeProject(id)
    navigate('/projects')
  }

  function openEditProject() {
    setProjectForm({ name: project.name, description: project.description, color: project.color })
    setEditProjectModal(true)
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

  const done = projectTasks.filter(t => t.status === 'done').length
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0

  function TaskCardContent({ task, col }) {
    const assignee = memberById(task.assigneeId)
    const subs = subtasksOf(task.id)
    const doneSubs = subs.filter(s => s.status === 'done').length
    const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date()

    return (
      <div className="task-card" onClick={() => openEditTask(task)}>
        <div className={`task-card-priority priority-bar-${task.priority}`} />
        <div className="task-card-body">
          <p className="task-card-title">{task.title}</p>
          <div className="task-card-meta">
            <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
            {subs.length > 0 && (
              <span className="subtask-count">{doneSubs}/{subs.length}</span>
            )}
            {task.dueDate && (
              <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="task-card-footer">
            {assignee && (
              <span className="avatar-sm" style={{ background: assignee.color }} title={assignee.name}>
                {assignee.name[0]?.toUpperCase()}
              </span>
            )}
            {col && (
              <div className="task-card-actions" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                {col.key !== 'todo' && (
                  <button
                    className="btn-move"
                    onClick={() => moveTask(task, STATUSES[STATUSES.findIndex(s => s.key === col.key) - 1].key)}
                  >←</button>
                )}
                {col.key !== 'done' && (
                  <button
                    className="btn-move"
                    onClick={() => moveTask(task, STATUSES[STATUSES.findIndex(s => s.key === col.key) + 1].key)}
                  >→</button>
                )}
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
      {/* Project header */}
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

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 24 }}>
        <div className="progress-fill" style={{ width: `${progress}%`, background: project.color }} />
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban">
          {STATUSES.map(col => {
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
        <Modal
          title={taskModal.mode === 'create' ? 'New Task' : 'Edit Task'}
          onClose={closeTaskModal}
          width="540px"
        >
          <form onSubmit={handleTaskSubmit} className="form">
            <label>Title *
              <input
                autoFocus
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                required
              />
            </label>
            <label>Description
              <textarea
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional details..."
                rows={3}
              />
            </label>
            <div className="form-row">
              <label>Status
                <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label>Priority
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>Assignee
                <select value={taskForm.assigneeId} onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label>Due Date
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </label>
            </div>

            {/* Subtasks (edit mode only) */}
            {taskModal.mode === 'edit' && (
              <div className="subtasks-section">
                <p className="form-section-label">Subtasks</p>
                {subtasksOf(taskModal.id).map(s => (
                  <div key={s.id} className="subtask-item">
                    <input
                      type="checkbox"
                      checked={s.status === 'done'}
                      onChange={() => editTask(s.id, { status: s.status === 'done' ? 'todo' : 'done' })}
                    />
                    <span className={s.status === 'done' ? 'line-through' : ''}>{s.title}</span>
                    <button type="button" className="btn-icon danger sm" onClick={() => removeTask(s.id)}>✕</button>
                  </div>
                ))}
                <div className="subtask-add">
                  <input
                    value={subtaskInput}
                    onChange={e => setSubtaskInput(e.target.value)}
                    placeholder="Add subtask..."
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  />
                  <button type="button" className="btn-ghost" onClick={addSubtask}>Add</button>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={closeTaskModal}>Cancel</button>
              <button type="submit" className="btn-primary">
                {taskModal.mode === 'create' ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit project modal */}
      {editProjectModal && (
        <Modal title="Edit Project" onClose={() => setEditProjectModal(false)}>
          <form onSubmit={handleProjectSave} className="form">
            <label>Name *
              <input
                autoFocus
                value={projectForm.name}
                onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label>Description
              <textarea
                value={projectForm.description}
                onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </label>
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