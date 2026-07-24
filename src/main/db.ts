import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type {
  Item,
  Priority,
  RecurringRule,
  RecurringRuleInput,
  ScannedItem
} from '../shared/types'

let db: Database.Database

export function initDb(): void {
  const file = join(app.getPath('userData'), 'hisho.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  migrate()
}

function migrate(): void {
  // Fresh start: the old tasks/reminders/messages model is gone.
  db.exec(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS messages;

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      ext_id TEXT,
      deep_link TEXT,
      app_link TEXT,
      title TEXT NOT NULL,
      sender TEXT,
      snippet TEXT,
      suggested_priority TEXT,
      suggested_resolution TEXT,
      ignore_reason TEXT,
      priority TEXT,
      state TEXT NOT NULL DEFAULT 'new',
      remind_at INTEGER,
      recurring_rule_id INTEGER,
      created_at INTEGER NOT NULL,
      last_touched_at INTEGER NOT NULL,
      UNIQUE(source, ext_id)
    );

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      cron TEXT NOT NULL,
      lead_days INTEGER NOT NULL DEFAULT 5,
      default_priority TEXT NOT NULL DEFAULT 'med',
      last_spawned_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Idempotent column adds for DBs created before these fields existed.
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(items)`).all() as { name: string }[]).map((c) => c.name)
  )
  if (!cols.has('snippet')) db.exec(`ALTER TABLE items ADD COLUMN snippet TEXT`)
  if (!cols.has('ignore_reason')) db.exec(`ALTER TABLE items ADD COLUMN ignore_reason TEXT`)
  if (!cols.has('app_link')) db.exec(`ALTER TABLE items ADD COLUMN app_link TEXT`)
}

// ---------- items: reads ----------

/** Feed = new (pinned top) then open, high→med→low, oldest-untouched first. */
export function listFeed(): Item[] {
  return db
    .prepare(
      `SELECT * FROM items
       WHERE state IN ('new','open')
       ORDER BY
         CASE state WHEN 'new' THEN 0 ELSE 1 END,
         CASE priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
         last_touched_at ASC`
    )
    .all() as Item[]
}

/** Parked items with a live resurface timer, soonest first. */
export function listBackburner(): Item[] {
  return db
    .prepare(
      `SELECT * FROM items
       WHERE state = 'dismissed' AND remind_at IS NOT NULL
       ORDER BY remind_at ASC`
    )
    .all() as Item[]
}

/** Completed + ignored (dismissed with no timer), most recent first. */
export function listArchive(): Item[] {
  return db
    .prepare(
      `SELECT * FROM items
       WHERE state = 'done' OR (state = 'dismissed' AND remind_at IS NULL)
       ORDER BY last_touched_at DESC LIMIT 200`
    )
    .all() as Item[]
}

export function getItem(id: number): Item | undefined {
  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as Item | undefined
}

/** Count of untriaged items — drives the quiet tray badge. */
export function untriagedCount(): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE state = 'new'`).get() as {
    c: number
  }
  return row.c
}

/** Items whose resurface time has arrived. */
export function dueBackburner(now: number): Item[] {
  return db
    .prepare(
      `SELECT * FROM items
       WHERE state = 'dismissed' AND remind_at IS NOT NULL AND remind_at <= ?`
    )
    .all(now) as Item[]
}

// ---------- items: writes ----------

export function addManual(title: string): number {
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO items (source, title, state, created_at, last_touched_at)
       VALUES ('manual', ?, 'new', ?, ?)`
    )
    .run(title, now, now)
  return Number(info.lastInsertRowid)
}

/**
 * Stage 1 (fetch): insert a raw scanned item awaiting classification.
 * Dedupes on (source, ext_id) — anything already seen in ANY state is skipped,
 * so scans stay incremental. Returns the new row id, or null if it already existed.
 */
export function insertScanned(s: ScannedItem): number | null {
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO items
         (source, ext_id, deep_link, app_link, title, sender, snippet, state, created_at, last_touched_at)
       VALUES
         (@source, @ext_id, @deep_link, @app_link, @title, @sender, @snippet, 'scanned', @ts, @ts)
       ON CONFLICT(source, ext_id) DO NOTHING`
    )
    .run({
      source: s.source,
      ext_id: s.ext_id,
      deep_link: s.deep_link ?? null,
      app_link: s.app_link ?? null,
      title: s.title,
      sender: s.sender ?? null,
      snippet: s.snippet ?? null,
      ts: now
    })
  return info.changes > 0 ? Number(info.lastInsertRowid) : null
}

/** Rows fetched but not yet classified. */
export function listScanned(): Item[] {
  return db
    .prepare(`SELECT * FROM items WHERE state = 'scanned' ORDER BY created_at ASC`)
    .all() as Item[]
}

/**
 * Stage 2 (classify): resolve a scanned row to the feed (surface) or the
 * ignored shelf. Surface → new/untriaged with a suggested priority + next step.
 */
export function classifyItem(
  id: number,
  verdict: 'surface' | 'ignore',
  priority: Priority | null,
  resolution: string | null,
  reason: string | null
): void {
  if (verdict === 'surface') {
    db.prepare(
      `UPDATE items SET state = 'new', suggested_priority = ?, suggested_resolution = ?
       WHERE id = ? AND state = 'scanned'`
    ).run(priority, resolution, id)
  } else {
    db.prepare(
      `UPDATE items SET state = 'ignored', ignore_reason = ?
       WHERE id = ? AND state = 'scanned'`
    ).run(reason, id)
  }
}

/** Classified-out items, newest first. */
export function listIgnored(): Item[] {
  return db
    .prepare(`SELECT * FROM items WHERE state = 'ignored' ORDER BY created_at DESC LIMIT 300`)
    .all() as Item[]
}

export function ignoredCount(): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE state = 'ignored'`).get() as {
    c: number
  }
  return row.c
}

export function acceptItem(id: number, priority: Priority): void {
  db.prepare(
    `UPDATE items SET state = 'open', priority = ?, last_touched_at = ? WHERE id = ?`
  ).run(priority, Date.now(), id)
}

export function setPriority(id: number, priority: Priority): void {
  db.prepare(`UPDATE items SET priority = ?, last_touched_at = ? WHERE id = ?`).run(
    priority,
    Date.now(),
    id
  )
}

export function markDone(id: number): void {
  db.prepare(
    `UPDATE items SET state = 'done', remind_at = NULL, last_touched_at = ? WHERE id = ?`
  ).run(Date.now(), id)
}

/** Dismiss: with a timer → backburner; null → ignore (recoverable from archive). */
export function dismissItem(id: number, remindAt: number | null): void {
  db.prepare(
    `UPDATE items SET state = 'dismissed', remind_at = ?, last_touched_at = ? WHERE id = ?`
  ).run(remindAt, Date.now(), id)
}

/**
 * Return an item to the feed. If it never had a priority it comes back as new
 * (re-triage); if it was accepted before, it returns to its prior tier.
 * Used by both the backburner timer and manual restore from archive.
 */
export function resurface(id: number): void {
  const it = getItem(id)
  if (!it) return
  const state = it.priority ? 'open' : 'new'
  db.prepare(`UPDATE items SET state = ?, remind_at = NULL WHERE id = ?`).run(state, id)
}

// ---------- recurring rules ----------

export function listRules(): RecurringRule[] {
  return db
    .prepare(`SELECT * FROM recurring_rules ORDER BY created_at DESC`)
    .all() as RecurringRule[]
}

export function createRule(input: RecurringRuleInput): number {
  const info = db
    .prepare(
      `INSERT INTO recurring_rules (title, cron, lead_days, default_priority, created_at)
       VALUES (@title, @cron, @lead_days, @default_priority, @created_at)`
    )
    .run({ ...input, created_at: Date.now() })
  return Number(info.lastInsertRowid)
}

export function updateRule(id: number, input: RecurringRuleInput): void {
  db.prepare(
    `UPDATE recurring_rules
     SET title=@title, cron=@cron, lead_days=@lead_days, default_priority=@default_priority
     WHERE id=@id`
  ).run({ ...input, id })
}

export function deleteRule(id: number): void {
  db.prepare(`DELETE FROM recurring_rules WHERE id = ?`).run(id)
}

export function markRuleSpawned(id: number, at: number): void {
  db.prepare(`UPDATE recurring_rules SET last_spawned_at = ? WHERE id = ?`).run(at, id)
}

/**
 * Spawn a feed item for a recurring occurrence. `dueTs` makes the ext_id unique
 * per occurrence, so restarts never double-spawn the same one.
 */
export function spawnRecurringItem(rule: RecurringRule, dueTs: number): boolean {
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO items
         (source, ext_id, title, suggested_priority, state, recurring_rule_id,
          created_at, last_touched_at)
       VALUES ('recurring', @ext_id, @title, @priority, 'new', @rule_id, @ts, @ts)
       ON CONFLICT(source, ext_id) DO NOTHING`
    )
    .run({
      ext_id: `rule-${rule.id}-${dueTs}`,
      title: rule.title,
      priority: rule.default_priority,
      rule_id: rule.id,
      ts: now
    })
  return info.changes > 0
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
