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

/** Model choices surfaced in the UI. Values are passed straight to `claude --model`. */
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
  /** Resume a prior session (for multi-call reminder workflows). */
  resumeSessionId?: string
}

export interface RunResult {
  ok: boolean
  text: string
  sessionId?: string
  costUsd?: number
  error?: string
}

export interface TaskRow {
  id: number
  prompt: string
  model: string
  connections: string // json array
  result: string
  status: 'pending' | 'running' | 'done' | 'error'
  created_at: number
}

export interface ReminderRow {
  id: number
  title: string
  prompt: string
  model: string
  connections: string // json array
  cron: string // node-cron expression
  last_run: number | null
  next_due: number | null
  escalation_level: number
  done: number // 0 | 1
  last_suggestion: string | null
  session_id: string | null
  created_at: number
}

export interface ReminderInput {
  title: string
  prompt: string
  model: ModelAlias
  connections: Connection[]
  cron: string
}

/** Friendly frequency presets mapped to cron expressions. */
export interface FrequencyPreset {
  id: string
  label: string
  cron: string
}

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { id: 'minutely', label: 'Every minute (testing)', cron: '* * * * *' },
  { id: 'hourly', label: 'Hourly', cron: '0 * * * *' },
  { id: 'daily', label: 'Daily at 9am', cron: '0 9 * * *' },
  { id: 'weekdays', label: 'Weekdays at 9am', cron: '0 9 * * 1-5' },
  { id: 'weekly', label: 'Weekly (Mon 9am)', cron: '0 9 * * 1' },
  { id: 'monthly', label: 'Monthly (1st, 9am)', cron: '0 9 1 * *' },
  { id: 'quarterly', label: 'Quarterly (9am, 1st of Jan/Apr/Jul/Oct)', cron: '0 9 1 1,4,7,10 *' }
]

export interface MessageRow {
  id: number
  source: string
  ext_id: string
  sender: string
  snippet: string
  url: string | null
  seen: number
  responded: number
  ts: number
}
