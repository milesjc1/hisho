import cron, { ScheduledTask } from 'node-cron'
import { runClaude } from './claude-runner'
import { notifyReminder } from './notify'
import { emitToRenderer } from './window'
import {
  listReminders,
  getReminder,
  dueReminders,
  armReminder,
  escalateReminder,
  recordReminderRun,
  getSetting
} from './db'
import type { Connection, ModelAlias, ReminderRow } from '../shared/types'

const jobs = new Map<number, ScheduledTask>()
const inFlight = new Set<number>()
let tickTimer: ReturnType<typeof setInterval> | null = null

const DEFAULT_NAG_MINUTES = 10
const TICK_MS = Number(process.env.HISHO_TICK_MS) || 60_000

function nagMs(): number {
  const raw = Number(getSetting('nagIntervalMinutes'))
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_NAG_MINUTES
  return minutes * 60_000
}

/** Guardrail appended to every reminder run: analyse + suggest, never act. */
const REMINDER_GUARD =
  '\n\n---\nContext: this is a recurring personal reminder. Produce a concise summary of what needs attention and a suggested action or draft. Do NOT send messages, create tickets, or change anything — suggestion only.'

function buildRun(r: ReminderRow): {
  prompt: string
  model: ModelAlias
  connections: Connection[]
} {
  let connections: Connection[] = []
  try {
    connections = JSON.parse(r.connections)
  } catch {
    connections = []
  }
  return { prompt: r.prompt + REMINDER_GUARD, model: r.model as ModelAlias, connections }
}

// ---------- lifecycle ----------

export function startScheduler(): void {
  reloadJobs()
  if (!tickTimer) tickTimer = setInterval(() => void tick(), TICK_MS)
  void tick()
}

export function stopScheduler(): void {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = null
  for (const job of jobs.values()) job.stop()
  jobs.clear()
}

/** Rebuild the per-reminder cron jobs from the DB. Call after any CRUD. */
export function reloadJobs(): void {
  for (const job of jobs.values()) job.stop()
  jobs.clear()
  for (const r of listReminders()) {
    if (r.done) continue // recurrence re-arms via cron; done rows just wait
    scheduleJob(r)
  }
}

function scheduleJob(r: ReminderRow): void {
  if (!cron.validate(r.cron)) return
  const task = cron.schedule(r.cron, () => onCronFire(r.id))
  jobs.set(r.id, task)
}

/** A cron occurrence arrived → activate the reminder and process now. */
function onCronFire(id: number): void {
  armReminder(id, Date.now())
  void processReminder(id)
}

// ---------- tick + processing ----------

async function tick(): Promise<void> {
  for (const r of dueReminders(Date.now())) {
    void processReminder(r.id)
  }
}

async function processReminder(id: number): Promise<void> {
  if (inFlight.has(id)) return
  const r = getReminder(id)
  if (!r || r.done) return

  inFlight.add(id)
  try {
    if (r.escalation_level === 0) {
      // First fire this occurrence: run the workflow once, store the suggestion.
      const req = buildRun(r)
      const result = await runClaude(req)
      const suggestion = result.ok ? result.text : `Run failed: ${result.error ?? 'unknown'}`
      recordReminderRun(id, suggestion, result.sessionId, Date.now() + nagMs())
      const updated = getReminder(id)
      if (updated) notifyReminder(updated, updated.escalation_level)
    } else {
      // Already fired, still not done → escalate the nag (no LLM re-run).
      const level = escalateReminder(id, Date.now() + nagMs())
      const updated = getReminder(id)
      if (updated) notifyReminder(updated, level)
    }
    emitToRenderer('reminder:changed')
  } finally {
    inFlight.delete(id)
  }
}

/** Fire a reminder immediately on demand (the "Run now" button). */
export function runReminderNow(id: number): void {
  armReminder(id, Date.now())
  void processReminder(id)
}
