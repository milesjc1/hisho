import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type {
  Item, ItemState, IngestItem, DismissEntry, RecurringRule, RecurringRuleInput
} from '../shared/types'

let db: Database.Database

function dbPath(): string {
  if (process.env.PLATE_DB) return process.env.PLATE_DB
  return join(app.getPath('userData'), 'hisho.db')
}

export function initDb(): void { initDbAt(dbPath()) }
export function closeDb(): void { if (db) { try { db.close() } catch { /* already closed */ } } }

/** Test-friendly opener (also used by initDb and the CLI). */
export function initDbAt(file: string): void {
  if (db) { try { db.close() } catch { /* already closed */ } }
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL, ext_id TEXT, kind TEXT,
      deep_link TEXT, app_link TEXT, title TEXT NOT NULL, sender TEXT, snippet TEXT,
      state TEXT NOT NULL DEFAULT 'new', status_reason TEXT, responded_at INTEGER,
      created_at INTEGER NOT NULL, last_touched_at INTEGER NOT NULL,
      UNIQUE(source, ext_id)
    );
    CREATE TABLE IF NOT EXISTS recurring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, cron TEXT NOT NULL,
      lead_days INTEGER NOT NULL DEFAULT 5, default_priority TEXT NOT NULL DEFAULT 'med',
      last_spawned_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
  `)
  migrate()
}

function migrate(): void {
  const cols = new Set((db.prepare(`PRAGMA table_info(items)`).all() as { name: string }[]).map(c => c.name))
  if (!cols.has('kind')) db.exec(`ALTER TABLE items ADD COLUMN kind TEXT`)
  if (!cols.has('status_reason')) db.exec(`ALTER TABLE items ADD COLUMN status_reason TEXT`)
  if (!cols.has('responded_at')) db.exec(`ALTER TABLE items ADD COLUMN responded_at INTEGER`)
  db.exec(`UPDATE items SET state='active' WHERE state='open';`)
  db.exec(`UPDATE items SET state='new' WHERE state='scanned';`)
  if (cols.has('ignore_reason')) {
    db.exec(`UPDATE items SET state='dismissed',
               status_reason=COALESCE(status_reason, ignore_reason, '(legacy ignored)')
             WHERE state='ignored';`)
  } else {
    db.exec(`UPDATE items SET state='dismissed', status_reason=COALESCE(status_reason,'(legacy ignored)')
             WHERE state='ignored';`)
  }
}

const now = (): number => Date.now()

// ---- reads ----
export function listCenter(): Item[] {
  return db.prepare(`SELECT * FROM items WHERE state IN ('new','active')
    ORDER BY CASE state WHEN 'new' THEN 0 ELSE 1 END, last_touched_at ASC`).all() as Item[]
}
export function listBackburner(): Item[] {
  return db.prepare(`SELECT * FROM items WHERE state='backburner' ORDER BY last_touched_at ASC`).all() as Item[]
}
export function listResponded(): Item[] {
  return db.prepare(`SELECT * FROM items WHERE state='responded' ORDER BY responded_at ASC`).all() as Item[]
}
export function listDone(): Item[] {
  return db.prepare(`SELECT * FROM items WHERE state='done' ORDER BY last_touched_at DESC LIMIT 300`).all() as Item[]
}
export function listDismissed(): Item[] {
  return db.prepare(`SELECT * FROM items WHERE state='dismissed' ORDER BY last_touched_at DESC LIMIT 300`).all() as Item[]
}
export function newCount(): number {
  return (db.prepare(`SELECT COUNT(*) c FROM items WHERE state='new'`).get() as { c: number }).c
}
export function countState(state: ItemState): number {
  return (db.prepare(`SELECT COUNT(*) c FROM items WHERE state=?`).get(state) as { c: number }).c
}
export function staleResponded(staleDays: number): Item[] {
  const cutoff = now() - staleDays * 86_400_000
  return db.prepare(`SELECT * FROM items WHERE state='responded' AND responded_at IS NOT NULL AND responded_at <= ?`).all(cutoff) as Item[]
}

// ---- writes ----
export function ingest(items: IngestItem[]): number {
  const stmt = db.prepare(`INSERT INTO items
    (source, ext_id, kind, deep_link, app_link, title, sender, snippet, state, created_at, last_touched_at)
    VALUES (@source,@ext_id,@kind,@deep_link,@app_link,@title,@sender,@snippet,'new',@ts,@ts)
    ON CONFLICT(source, ext_id) DO NOTHING`)
  let inserted = 0
  const tx = db.transaction((rows: IngestItem[]) => {
    for (const r of rows) {
      if (!r || typeof r.source !== 'string' || typeof r.external_id !== 'string' || !r.title?.trim()) continue
      const info = stmt.run({
        source: r.source, ext_id: r.external_id, kind: r.kind ?? null,
        deep_link: r.deep_link ?? null, app_link: r.app_link ?? null,
        title: r.title, sender: r.sender ?? null, snippet: r.snippet ?? null, ts: now()
      })
      if (info.changes > 0) inserted++
    }
  })
  tx(items)
  return inserted
}

export function dismissEntries(entries: DismissEntry[]): number {
  const stmt = db.prepare(`UPDATE items SET state='dismissed', status_reason=@reason, last_touched_at=@ts
    WHERE source=@source AND ext_id=@ext_id AND state IN ('new','active','backburner','responded')`)
  let changed = 0
  const tx = db.transaction((rows: DismissEntry[]) => {
    for (const e of rows) changed += stmt.run({ source: e.source, ext_id: e.external_id, reason: e.reason, ts: now() }).changes
  })
  tx(entries)
  return changed
}

export function setState(id: number, state: ItemState): void {
  const respondedAt = state === 'responded' ? now() : null
  db.prepare(`UPDATE items SET state=?, last_touched_at=?,
    responded_at = CASE WHEN ?='responded' THEN ? ELSE NULL END WHERE id=?`)
    .run(state, now(), state, respondedAt, id)
}
export function addManual(title: string): number {
  const t = now()
  return Number(db.prepare(`INSERT INTO items (source, title, state, created_at, last_touched_at)
    VALUES ('manual', ?, 'active', ?, ?)`).run(title, t, t).lastInsertRowid)
}
export function restore(id: number): void { setState(id, 'active') }

// ---- settings ----
export function getSetting(key: string): string | undefined {
  return (db.prepare(`SELECT value FROM settings WHERE key=?`).get(key) as { value: string } | undefined)?.value
}
export function setSetting(key: string, value: string): void {
  db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value)
}

// ---- recurring rules (unchanged behavior; spawns into state 'new') ----
export function listRules(): RecurringRule[] {
  return db.prepare(`SELECT * FROM recurring_rules ORDER BY created_at DESC`).all() as RecurringRule[]
}
export function createRule(input: RecurringRuleInput): number {
  return Number(db.prepare(`INSERT INTO recurring_rules (title,cron,lead_days,default_priority,created_at)
    VALUES (@title,@cron,@lead_days,@default_priority,@created_at)`).run({ ...input, created_at: now() }).lastInsertRowid)
}
export function updateRule(id: number, input: RecurringRuleInput): void {
  db.prepare(`UPDATE recurring_rules SET title=@title,cron=@cron,lead_days=@lead_days,default_priority=@default_priority WHERE id=@id`).run({ ...input, id })
}
export function deleteRule(id: number): void { db.prepare(`DELETE FROM recurring_rules WHERE id=?`).run(id) }
export function markRuleSpawned(id: number, at: number): void { db.prepare(`UPDATE recurring_rules SET last_spawned_at=? WHERE id=?`).run(at, id) }
export function spawnRecurringItem(rule: RecurringRule, dueTs: number): boolean {
  const info = db.prepare(`INSERT INTO items (source, ext_id, title, state, created_at, last_touched_at)
    VALUES ('recurring', @ext_id, @title, 'new', @ts, @ts) ON CONFLICT(source, ext_id) DO NOTHING`)
    .run({ ext_id: `rule-${rule.id}-${dueTs}`, title: rule.title, ts: now() })
  return info.changes > 0
}

// ---- test-only ----
export function setRespondedAt(id: number, ts: number): void {
  db.prepare(`UPDATE items SET responded_at=? WHERE id=?`).run(ts, id)
}
