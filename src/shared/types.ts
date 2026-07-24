// Shared type contracts between main and renderer.

/** MCP connection identifiers the app can scope a Claude run to. */
export type Connection = 'microsoft365' | 'slack' | 'linear' | 'github'

export const ALL_CONNECTIONS: Connection[] = ['microsoft365', 'slack', 'linear', 'github']

export const CONNECTION_LABELS: Record<Connection, string> = {
  microsoft365: 'Microsoft 365',
  slack: 'Slack',
  linear: 'Linear',
  github: 'GitHub'
}

/** Model choices. Values are passed straight to `claude --model`. */
export type ModelAlias = 'opus' | 'sonnet' | 'haiku'

export const MODEL_LABELS: Record<ModelAlias, string> = {
  opus: 'Opus (most capable)',
  sonnet: 'Sonnet (balanced)',
  haiku: 'Haiku (fastest)'
}

export interface RunRequest {
  prompt: string
  model: ModelAlias
  connections: Connection[]
  /** Resume a prior session. */
  resumeSessionId?: string
}

export interface RunResult {
  ok: boolean
  text: string
  sessionId?: string
  costUsd?: number
  error?: string
}

// ---------- Focus App feed model ----------

export type Priority = 'high' | 'med' | 'low'

/** Where a feed item came from. */
export type ItemSource =
  | 'slack'
  | 'teams'
  | 'outlook'
  | 'sharepoint'
  | 'github'
  | 'linear'
  | 'manual'
  | 'recurring'

/**
 * Item lifecycle.
 *  scanned   = fetched from a source, awaiting classification (not in feed)
 *  ignored   = classified as not needing attention (browsable, promotable)
 *  new       = untriaged, pinned to top of feed
 *  open      = accepted, sorted into a priority tier
 *  done      = completed (archive)
 *  dismissed = user-dismissed; with remind_at → backburner, without → archive
 */
export type ItemState = 'scanned' | 'ignored' | 'new' | 'open' | 'done' | 'dismissed'

export interface Item {
  id: number
  source: ItemSource
  ext_id: string | null
  deep_link: string | null
  /** Native desktop-app URI (slack://, msteams:/l/…) when available; else null. */
  app_link: string | null
  title: string
  sender: string | null
  /** Short raw preview captured at fetch; feeds classification + display. */
  snippet: string | null
  /** Priority the sync suggested; pre-selects the accept default. */
  suggested_priority: Priority | null
  /** Read-only "next step" text from the sync (display only in v1). */
  suggested_resolution: string | null
  /** Why the classifier ignored it (shown in the Ignored view). */
  ignore_reason: string | null
  /** Final priority; NULL while new/untriaged. */
  priority: Priority | null
  state: ItemState
  /** Resurface timestamp (ms); set only while backburnered. */
  remind_at: number | null
  recurring_rule_id: number | null
  created_at: number
  /** Resets on user interaction; drives oldest-untouched sort within a tier. */
  last_touched_at: number
}

/** Raw item the fetch stage returns, before classification. */
export interface ScannedItem {
  source: ItemSource
  ext_id: string
  title: string
  sender?: string | null
  snippet?: string | null
  deep_link?: string | null
  app_link?: string | null
  last_from_me?: boolean
}

/** Per-source counts of what a scan looked at but did not surface. */
export interface SyncSummary {
  at: number
  found: number
  surfaced: number
  ignored: number
  perSource: Record<string, { surfaced: number; ignored: number }>
}

export interface RecurringRule {
  id: number
  title: string
  cron: string
  lead_days: number
  default_priority: Priority
  last_spawned_at: number | null
  created_at: number
}

export interface RecurringRuleInput {
  title: string
  cron: string
  lead_days: number
  default_priority: Priority
}

/** Friendly frequency presets mapped to cron expressions (recurring rules). */
export interface FrequencyPreset {
  id: string
  label: string
  cron: string
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { id: 'daily', label: 'Daily at 9am', cron: '0 9 * * *' },
  { id: 'weekly', label: 'Weekly (Mon 9am)', cron: '0 9 * * 1' },
  { id: 'monthly', label: 'Monthly (1st, 9am)', cron: '0 9 1 * *' },
  { id: 'quarterly', label: 'Quarterly (1st of Jan/Apr/Jul/Oct)', cron: '0 9 1 1,4,7,10 *' }
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  med: 'Medium',
  low: 'Low'
}
