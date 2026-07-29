import type { ItemSource } from '../shared/types'

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
