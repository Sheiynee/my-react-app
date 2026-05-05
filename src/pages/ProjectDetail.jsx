import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/app-context'
import ProjectMembersModal from '../components/ProjectMembersModal'
import ConfirmModal from '../components/ConfirmModal'
import TaskViewModal from '../components/TaskViewModal'
import TaskEditModal from '../components/TaskEditModal'
import EditProjectModal from '../components/EditProjectModal'
import { auth } from '../firebase'
import { canDo } from '../roles'
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

/**
 * Task card — hoisted to module scope so it has a stable identity across renders.
 * Defining it inside ProjectDetail caused React to treat it as a new component on
 * every render, resetting any local state (and triggering react-hooks/static-components).
 * All state/handlers it needs are passed explicitly as props.
 */
function TaskCardContent({
  task, col, columns, subs, assignees, isOverdue,
  canManage, isCreator, onView, onMove, onDelete,
}) {
  const doneSubs = subs.filter(s => s.status === 'done').length
  const colIdx = columns.findIndex(c => c.key === col?.key)
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 shadow-sm transition-colors cursor-pointer select-none ${
        isOverdue ? 'border-red-200 dark:border-red-900/60' : 'border-gray-100 dark:border-zinc-800'
      }`}
      onClick={() => onView(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 leading-snug">{task.title}</span>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${priorityBadge[task.priority]}`}>{task.priority}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {task.dueDate && (
          <span className={`text-[11px] ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>
            {isOverdue ? '⚠ ' : ''}Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {subs.length > 0 && (
          <span className="text-[11px] text-gray-400 dark:text-zinc-500">{doneSubs}/{subs.length} subtasks</span>
        )}
        {assignees.length > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {assignees.slice(0, 3).map(a => (
              <span key={a.id} title={a.name} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-white dark:ring-zinc-900" style={{ background: a.color }}>
                {a.name[0]?.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      {(canManage || isCreator) && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50 dark:border-zinc-800/60" onClick={e => e.stopPropagation()}>
          {colIdx > 0 && (
            <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 transition-colors text-xs" onClick={() => onMove(task, columns[colIdx - 1].key)}>←</button>
          )}
          {colIdx < columns.length - 1 && (
            <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 transition-colors text-xs" onClick={() => onMove(task, columns[colIdx + 1].key)}>→</button>
          )}
          {(canManage || isCreator) && (
            <button className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors text-xs" onClick={() => onDelete(task.id)}>✕</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    projects, tasks, members,
    removeProject, removeTask, editTask, getProjectRole, refreshProject, refreshProjectTasks,
  } = useApp()

  const project = projects.find(p => p.id === id)
  const columns = project?.columns?.length ? project.columns : DEFAULT_COLUMNS
  const projectTasks = tasks.filter(t => t.projectId === id && !t.parentId)
  const myRole = getProjectRole(id)
  const currentUid = auth.currentUser?.uid
  const canEdit = canDo(myRole, 'manager')
  const canDelete = canDo(myRole, 'admin')
  const canAddTask = canDo(myRole, 'member')

  const [search, setSearch] = useState('')
  const [taskModal, setTaskModal] = useState(null) // { mode, task?, defaultStatus? }
  const [editProjectModal, setEditProjectModal] = useState(false)
  const [membersModal, setMembersModal] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null) // { title, message, onConfirm }
  const [activeTask, setActiveTask] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => { refreshProjectTasks(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return (
    <div className="p-8">
      <p className="text-sm text-gray-500 dark:text-zinc-400">
        Project not found.{' '}
        <button className="text-blue-600 hover:underline" onClick={() => navigate('/projects')}>Go back</button>
      </p>
    </div>
  )

  const subtasksOf = (taskId) => tasks.filter(t => t.parentId === taskId)
  const memberById = (mId) => members.find(m => m.id === mId)

  function openCreateTask(defaultStatus) {
    setTaskModal({ mode: 'create', defaultStatus: defaultStatus || columns[0]?.key || 'todo' })
  }

  function openViewTask(task) {
    setTaskModal({ mode: 'view', task })
  }

  function openEditTask(task) {
    setTaskModal({ mode: 'edit', task })
  }

  function handleDeleteTask(taskId) {
    setConfirmDialog({
      title: 'Delete task',
      message: 'Delete this task and all its subtasks? This cannot be undone.',
      onConfirm: async () => {
        await removeTask(taskId)
        setTaskModal(null)
        setConfirmDialog(null)
      },
    })
  }

  function handleDeleteProject() {
    setConfirmDialog({
      title: 'Delete project',
      message: 'Delete this project and all its tasks? This cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null)
        await removeProject(id)
        navigate('/projects')
      },
    })
  }

  function handleDragStart({ active }) {
    setActiveTask(projectTasks.find(t => t.id === active.id) || null)
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over) return
    const task = projectTasks.find(t => t.id === active.id)
    if (!task || task.status === over.id) return
    editTask(task.id, { status: over.id })
  }

  const lastColKey = columns[columns.length - 1]?.key
  const done = projectTasks.filter(t => t.status === lastColKey || t.status === 'done').length
  const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0

  const searchTerm = search.trim().toLowerCase()
  const visibleTasks = searchTerm
    ? projectTasks.filter(t => t.title.toLowerCase().includes(searchTerm))
    : projectTasks

  function taskCardProps(task, col) {
    const assignees = (task.assigneeIds || []).map(memberById).filter(Boolean)
    const subs = subtasksOf(task.id)
    const isOverdue = !!task.dueDate
      && task.status !== lastColKey
      && task.status !== 'done'
      && new Date(task.dueDate) < new Date()
    return {
      task, col, columns, subs, assignees, isOverdue,
      canManage: canDo(myRole, 'manager'),
      isCreator: task.createdBy === currentUid,
      onView: openViewTask,
      onMove: (t, status) => editTask(t.id, { status }),
      onDelete: handleDeleteTask,
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 w-full">
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
          <button className="text-sm font-medium px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={() => setMembersModal(true)}>Members</button>
          {canEdit && (
            <button className="text-sm font-medium px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors" onClick={() => setEditProjectModal(true)}>Edit</button>
          )}
          {canDelete && (
            <button className="text-sm font-medium px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors" onClick={handleDeleteProject}>Delete</button>
          )}
          {canAddTask && (
            <button className="text-sm font-medium px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors" onClick={() => openCreateTask()}>+ Add Task</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-7">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: project.color }} />
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"
        />
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-2">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))`, minWidth: `${columns.length * 276}px` }}>
            {columns.map(col => {
              const colTasks = visibleTasks.filter(t => t.status === col.key)
              return (
                <div key={col.key} className="bg-gray-50 dark:bg-zinc-950/60 border border-gray-100 dark:border-zinc-800/60 rounded-2xl flex flex-col">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800/60">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{col.label}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full ml-0.5">{colTasks.length}</span>
                    {canAddTask && (
                      <button
                        className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 dark:text-zinc-600 hover:bg-gray-200 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors text-base leading-none"
                        onClick={() => openCreateTask(col.key)}
                        aria-label={`Add task to ${col.label}`}
                        title="Add task"
                      >+</button>
                    )}
                  </div>
                  <DroppableColumn id={col.key}>
                    {colTasks.map(task => (
                      <DraggableCard key={task.id} task={task}>
                        <TaskCardContent {...taskCardProps(task, col)} />
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
              <TaskCardContent {...taskCardProps(activeTask, null)} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task view modal */}
      {taskModal?.mode === 'view' && (
        <TaskViewModal
          task={taskModal.task}
          myRole={myRole}
          currentUid={currentUid}
          subtasks={subtasksOf(taskModal.task.id)}
          assignees={(taskModal.task.assigneeIds || []).map(memberById).filter(Boolean)}
          lastColKey={lastColKey}
          onClose={() => setTaskModal(null)}
          onDelete={handleDeleteTask}
          onEdit={openEditTask}
        />
      )}

      {/* Task create / edit modal */}
      {taskModal && taskModal.mode !== 'view' && (
        <TaskEditModal
          mode={taskModal.mode}
          task={taskModal.task}
          defaultStatus={taskModal.defaultStatus}
          projectId={id}
          columns={columns}
          myRole={myRole}
          currentUid={currentUid}
          onClose={() => setTaskModal(null)}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Project members modal */}
      {membersModal && (
        <ProjectMembersModal
          projectId={id}
          myRole={myRole}
          onClose={() => { setMembersModal(false); refreshProject(id) }}
        />
      )}

      {/* Edit project modal */}
      {editProjectModal && (
        <EditProjectModal
          project={project}
          columns={columns}
          projectTasks={projectTasks}
          onClose={() => setEditProjectModal(false)}
        />
      )}

      {/* Confirm dialog (delete task / delete project) */}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Delete"
          dangerous
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}
