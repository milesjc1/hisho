import type { Item, ItemSource, Priority } from '../shared/types'

export const SOURCE_LABELS: Record<ItemSource, string> = {
  slack: 'Slack',
  teams: 'Teams',
  outlook: 'Outlook',
  sharepoint: 'SharePoint',
  github: 'GitHub',
  linear: 'Linear',
  manual: 'Manual',
  recurring: 'Recurring'
}

export const PRIORITIES: Priority[] = ['high', 'med', 'low']
export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  med: 'Medium',
  low: 'Low'
}

/** Compact relative age, e.g. "6d", "3h", "just now". */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

/** Countdown to a resurface time, e.g. "back in 4 min", "back at 2:00 PM". */
export function backIn(remindAt: number): string {
  const ms = remindAt - Date.now()
  if (ms <= 0) return 'back now'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `back in ${mins} min`
  const t = new Date(remindAt)
  return `back at ${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

/** Is a resurface within the next N minutes (drives amber emphasis). */
export function isSoon(remindAt: number, withinMin = 5): boolean {
  const ms = remindAt - Date.now()
  return ms > 0 && ms <= withinMin * 60000
}

/** Does a resurface time fall before end of today (local)? */
export function isLaterToday(remindAt: number): boolean {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return remindAt <= end.getTime()
}

/** Meta line for a feed item. */
export function itemMeta(it: Item): string {
  const src = SOURCE_LABELS[it.source]
  if (it.source === 'recurring') return `Recurring · added ${timeAgo(it.created_at)}`
  if (it.source === 'manual') return `Manual · added ${timeAgo(it.created_at)}`
  const who = it.sender ? `${it.sender} · ` : ''
  return `${src} · ${who}${timeAgo(it.created_at)}`
}
