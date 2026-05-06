export const inputCls = "w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-zinc-500"

export const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
}

export const priorityBadge = {
  low: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
}

export const statusDot = {
  todo: 'bg-gray-300 dark:bg-zinc-600',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
}

export function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, '')
}
