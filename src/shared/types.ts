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

export type ItemState = 'new' | 'active' | 'backburner' | 'responded' | 'done' | 'dismissed'

export interface Item {
  id: number
  source: ItemSource
  ext_id: string | null
  kind: string | null
  deep_link: string | null
  app_link: string | null
  title: string
  sender: string | null
  snippet: string | null
  /** Full untruncated text for the "see more" expansion (snippet is the preview). */
  body: string | null
  state: ItemState
  status_reason: string | null
  responded_at: number | null
  /** ISO-8601 timestamp of the underlying message/activity (Slack DM time, etc). */
  source_ts: string | null
  /** Claude Code session id (UUID) once a session has been started for this item. */
  session_id: string | null
  /** Working directory the session runs/resumes in. */
  session_dir: string | null
  created_at: number
  last_touched_at: number
}

/** Item the scanner/CLI ingests (pre-insert). */
export interface IngestItem {
  source: ItemSource
  external_id: string
  kind?: string | null
  title: string
  sender?: string | null
  snippet?: string | null
  /** Full untruncated text; snippet is a short preview of it. */
  body?: string | null
  deep_link?: string | null
  app_link?: string | null
  /** ISO-8601 timestamp of the underlying message/activity. */
  source_ts?: string | null
}

/** {source, external_id, reason} — skill triage dismiss payload. */
export interface DismissEntry { source: ItemSource; external_id: string; reason: string }

/** Streamed pull output events (main → renderer, raw JSONL feed). */
export type PullEvent =
  | { type: 'start' }
  | { type: 'line'; text: string }
  | { type: 'end'; code: number; error?: string }

/** UI zoom levels (renderer webFrame.setZoomFactor). */
export type FontScale = 's' | 'm' | 'l'

export const ZOOM_FACTORS: Record<FontScale, number> = { s: 1.0, m: 1.15, l: 1.3 }

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

// ---------- Auto-update status (main → renderer) ----------

/** Where the app is in the update lifecycle. `dev` = unpackaged run, updates disabled. */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dev'

/** Snapshot of the electron-updater state, surfaced in Settings. */
export interface UpdateStatus {
  currentVersion: string
  state: UpdateState
  /** Version offered by the newest release, when one is available. */
  availableVersion: string | null
  /** 0-100 while `downloading`, else null. */
  progressPercent: number | null
  /** Epoch ms of the last manual/automatic check, or null if never checked. */
  lastChecked: number | null
  error: string | null
}

/** Events the updater feeds into the status reducer (mirror autoUpdater events). */
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
