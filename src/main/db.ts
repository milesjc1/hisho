import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type {
  TaskRow,
  ReminderRow,
  ReminderInput,
  MessageRow,
  RunResult
} from '../shared/types'

let db: Database.Database

export function initDb(): void {
  const file = join(app.getPath('userData'), 'hisho.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  migrate()
}

function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      connections TEXT NOT NULL DEFAULT '[]',
      result TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      connections TEXT NOT NULL DEFAULT '[]',
      cron TEXT NOT NULL,
      last_run INTEGER,
      next_due INTEGER,
      escalation_level INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      last_suggestion TEXT,
      session_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      ext_id TEXT NOT NULL,
      sender TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      url TEXT,
      seen INTEGER NOT NULL DEFAULT 0,
      responded INTEGER NOT NULL DEFAULT 0,
      ts INTEGER NOT NULL,
      UNIQUE(source, ext_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

// ---------- tasks ----------

export function createTask(prompt: string, model: string, connections: string[]): number {
  const info = db
    .prepare(
      `INSERT INTO tasks (prompt, model, connections, status, created_at)
       VALUES (?, ?, ?, 'running', ?)`
    )
    .run(prompt, model, JSON.stringify(connections), Date.now())
  return Number(info.lastInsertRowid)
}

export function finishTask(id: number, result: RunResult): void {
  db.prepare(`UPDATE tasks SET result = ?, status = ? WHERE id = ?`).run(
    result.ok ? result.text : (result.error ?? 'error'),
    result.ok ? 'done' : 'error',
    id
  )
}

export function listTasks(limit = 50): TaskRow[] {
  return db
    .prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as TaskRow[]
}

// ---------- reminders ----------

export function createReminder(input: ReminderInput): number {
  const info = db
    .prepare(
      `INSERT INTO reminders (title, prompt, model, connections, cron, created_at)
       VALUES (@title, @prompt, @model, @connections, @cron, @created_at)`
    )
    .run({
      title: input.title,
      prompt: input.prompt,
      model: input.model,
      connections: JSON.stringify(input.connections),
      cron: input.cron,
      created_at: Date.now()
    })
  return Number(info.lastInsertRowid)
}

export function listReminders(): ReminderRow[] {
  return db.prepare(`SELECT * FROM reminders ORDER BY created_at DESC`).all() as ReminderRow[]
}

export function getReminder(id: number): ReminderRow | undefined {
  return db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(id) as ReminderRow | undefined
}

export function updateReminder(id: number, input: ReminderInput): void {
  db.prepare(
    `UPDATE reminders SET title=@title, prompt=@prompt, model=@model,
     connections=@connections, cron=@cron WHERE id=@id`
  ).run({
    id,
    title: input.title,
    prompt: input.prompt,
    model: input.model,
    connections: JSON.stringify(input.connections),
    cron: input.cron
  })
}

export function deleteReminder(id: number): void {
  db.prepare(`DELETE FROM reminders WHERE id = ?`).run(id)
}

/** Called after a scheduled run: store suggestion, bump escalation, set timing. */
export function recordReminderRun(
  id: number,
  suggestion: string,
  sessionId: string | undefined,
  nextDue: number | null
): number {
  db.prepare(
    `UPDATE reminders
     SET last_run = ?, last_suggestion = ?, session_id = ?,
         escalation_level = escalation_level + 1, next_due = ?
     WHERE id = ?`
  ).run(Date.now(), suggestion, sessionId ?? null, nextDue, id)
  return getReminder(id)!.escalation_level
}

export function setReminderNextDue(id: number, nextDue: number | null): void {
  db.prepare(`UPDATE reminders SET next_due = ? WHERE id = ?`).run(nextDue, id)
}

/** A new cron occurrence arrived: activate the reminder for action. */
export function armReminder(id: number, nextDue: number): void {
  db.prepare(
    `UPDATE reminders SET done = 0, escalation_level = 0, next_due = ? WHERE id = ?`
  ).run(nextDue, id)
}

/** Escalate an already-fired, still-unfinished reminder (no LLM re-run). */
export function escalateReminder(id: number, nextDue: number): number {
  db.prepare(
    `UPDATE reminders SET escalation_level = escalation_level + 1, next_due = ? WHERE id = ?`
  ).run(nextDue, id)
  return getReminder(id)!.escalation_level
}

/** User marked done → stop nagging, reset escalation. */
export function markReminderDone(id: number, done: boolean): void {
  db.prepare(`UPDATE reminders SET done = ?, escalation_level = 0 WHERE id = ?`).run(
    done ? 1 : 0,
    id
  )
}

export function dueReminders(now: number): ReminderRow[] {
  return db
    .prepare(
      `SELECT * FROM reminders WHERE done = 0 AND next_due IS NOT NULL AND next_due <= ?`
    )
    .all(now) as ReminderRow[]
}

// ---------- messages ----------

/** Upsert a polled message; returns true if it was newly inserted. */
export function upsertMessage(
  m: Omit<MessageRow, 'id' | 'seen' | 'responded'>
): boolean {
  const info = db
    .prepare(
      `INSERT INTO messages (source, ext_id, sender, snippet, url, ts)
       VALUES (@source, @ext_id, @sender, @snippet, @url, @ts)
       ON CONFLICT(source, ext_id) DO NOTHING`
    )
    .run({
      source: m.source,
      ext_id: m.ext_id,
      sender: m.sender,
      snippet: m.snippet,
      url: m.url ?? null,
      ts: m.ts
    })
  return info.changes > 0
}

export function getMessage(id: number): MessageRow | undefined {
  return db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as MessageRow | undefined
}

export function listMessages(includeResponded = false): MessageRow[] {
  const where = includeResponded ? '' : 'WHERE responded = 0'
  return db
    .prepare(`SELECT * FROM messages ${where} ORDER BY ts DESC LIMIT 200`)
    .all() as MessageRow[]
}

export function unreadMessageCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE seen = 0`).get() as {
    c: number
  }
  return row.c
}

export function markMessageSeen(id: number): void {
  db.prepare(`UPDATE messages SET seen = 1 WHERE id = ?`).run(id)
}

export function markMessageResponded(id: number): void {
  db.prepare(`UPDATE messages SET responded = 1, seen = 1 WHERE id = ?`).run(id)
}

// ---------- settings ----------

export function getSetting(key: string): string | undefined {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}
