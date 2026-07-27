import type { ItemSource } from '../shared/types'

export const SOURCE_BADGE: Record<string, string> = {
  slack: 'b-magenta',
  teams: 'b-blue',
  outlook: 'b-cyan',
  linear: 'b-yellow',
  github: 'b-white',
  manual: 'b-green',
  recurring: 'b-green',
  sharepoint: 'b-cyan'
}

export const SOURCE_LABELS: Record<ItemSource, string> = {
  slack: 'slack',
  teams: 'teams',
  outlook: 'outlook',
  sharepoint: 'sharepoint',
  github: 'github',
  linear: 'linear',
  manual: 'manual',
  recurring: 'recurring'
}

export function waitingDays(respondedAt: number | null): number | null {
  if (!respondedAt) return null
  return Math.floor((Date.now() - respondedAt) / 86_400_000)
}
