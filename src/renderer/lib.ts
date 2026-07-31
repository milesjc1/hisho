import type { Item, ItemSource } from '../shared/types'

/** Case-insensitive substring search over an item's text fields. Empty query
 * matches everything. Used to filter the Board / Done / Dismissed views. */
export function matchesQuery(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [item.title, item.sender, item.snippet, item.body, item.kind, item.status_reason]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export interface SourceStyle {
  color: string
  bg: string
}

/** Per-source badge color + translucent background (claude.ai/design palette). */
export const SOURCE_STYLE: Record<string, SourceStyle> = {
  slack: { color: '#b279a7', bg: 'rgba(178,121,167,0.12)' },
  teams: { color: '#6099c0', bg: 'rgba(96,153,192,0.12)' },
  outlook: { color: '#66a5ad', bg: 'rgba(102,165,173,0.12)' },
  sharepoint: { color: '#66a5ad', bg: 'rgba(102,165,173,0.12)' },
  github: { color: '#8e8e8e', bg: 'rgba(142,142,142,0.12)' },
  linear: { color: '#61abda', bg: 'rgba(97,171,218,0.12)' },
  manual: { color: '#8bae68', bg: 'rgba(139,174,104,0.12)' },
  recurring: { color: '#65b8c1', bg: 'rgba(101,184,193,0.12)' }
}

const DEFAULT_STYLE: SourceStyle = { color: '#8e8e8e', bg: 'rgba(142,142,142,0.12)' }

export function sourceStyle(source: string): SourceStyle {
  return SOURCE_STYLE[source] ?? DEFAULT_STYLE
}

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

export function waitingDays(respondedAt: number | null): number | null {
  if (!respondedAt) return null
  return Math.floor((Date.now() - respondedAt) / 86_400_000)
}

/** Full local date-time (incl. seconds) for the "since last pull" label, e.g.
 * "07/30/26, 2:14:07 PM". Null-safe — returns null for null/invalid input. */
export function formatStamp(ms: number | null | undefined): string | null {
  if (ms == null) return null
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit'
  })
}

/** Decide what description text to show and whether a "See more" toggle is
 * needed. `snippet` is the short preview; `body` is the full text (may be
 * longer). Collapsed shows the snippet; expanded shows the body. A toggle is
 * offered only when the body is genuinely longer than the snippet. */
export function expandableText(
  snippet: string | null | undefined,
  body: string | null | undefined,
  expanded: boolean
): { text: string; hasMore: boolean } {
  const full = (body ?? '').trim() || (snippet ?? '').trim()
  const short = (snippet ?? '').trim() || full
  const hasMore = full.length > short.length
  return { text: expanded ? full : short, hasMore }
}

/** Format a source timestamp (ISO-8601) as a short local "Jul 29, 2:14 PM".
 * Returns null for missing/unparseable input so callers can render nothing. */
export function formatItemTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}
