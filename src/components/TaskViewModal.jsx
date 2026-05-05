import DOMPurify from 'dompurify'
import Modal from './Modal'
import { priorityBadge } from '../constants'
import { canDo } from '../roles'

export default function TaskViewModal({
  task,
  myRole,
  currentUid,
  subtasks,
  assignees,
  lastColKey,
  onClose,
  onDelete,
  onEdit,
}) {
  const isOverdue = task.dueDate
    && task.status !== 'done'
    && task.status !== lastColKey
    && new Date(task.dueDate) < new Date()

  return (
    <Modal title={task.title} onClose={onClose} width="600px">
      <div className="flex flex-col gap-4">
        {/* Meta row */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${priorityBadge[task.priority]}`}>{task.priority}</span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 capitalize">{task.status.replace('_', ' ')}</span>
          {task.dueDate && (
            <span className={`text-xs px-2.5 py-1 rounded-full ${isOverdue ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800'}`}>
              Due {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {(task.createdByName || task.createdAt) && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            {task.createdByName && <>Created by <span className="font-medium">{task.createdByName}</span></>}
            {task.createdByName && task.createdAt && ' · '}
            {task.createdAt && new Date(task.createdAt).toLocaleDateString()}
          </p>
        )}
        {task.updatedByName && task.updatedAt && task.updatedAt !== task.createdAt && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Last updated by <span className="font-medium">{task.updatedByName}</span> · {new Date(task.updatedAt).toLocaleDateString()}
          </p>
        )}

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

        {task.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Description</p>
            <div className="text-sm text-gray-700 dark:text-zinc-300 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.description) }} />
          </div>
        )}

        {task.links?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Links</p>
            <div className="flex flex-col gap-1.5">
              {task.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">🔗 {link.label}</a>
              ))}
            </div>
          </div>
        )}

        {subtasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Subtasks ({subtasks.filter(s => s.status === 'done').length}/{subtasks.length})</p>
            <div className="space-y-1">
              {subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.status === 'done' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                  <span className={`text-sm ${s.status === 'done' ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-300'}`}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
          {(canDo(myRole, 'manager') || task.createdBy === currentUid) && (
            <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors" onClick={() => onDelete(task.id)}>Delete</button>
          )}
          {(canDo(myRole, 'member') || task.createdBy === currentUid) && (
            <button type="button" className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors" onClick={() => onEdit(task)}>Edit</button>
          )}
        </div>
      </div>
    </Modal>
  )
}
