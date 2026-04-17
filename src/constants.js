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
