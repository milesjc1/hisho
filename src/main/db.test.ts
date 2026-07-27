import { it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdtempSync } from 'fs'
import Database from 'better-sqlite3'

// Tests share one db module instance re-pointed per test, so they must run
// sequentially (default single-fork pool) — the module-level `db` is not thread-safe.
let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hisho-')); process.env.PLATE_DB = join(dir, 'h.db') })
afterEach(async () => {
  // Close before deleting — required on Windows (WAL files stay locked otherwise)
  const m = await import('./db'); m.closeDb()
  delete process.env.PLATE_DB; rmSync(dir, { recursive: true, force: true })
})

async function fresh() {
  const db = await import('./db')
  db.initDbAt(process.env.PLATE_DB!)
  return db
}

it('ingest inserts new rows and dedups on (source, ext_id)', async () => {
  const db = await fresh()
  expect(db.ingest([{ source: 'slack', external_id: 'a', title: 'Hi' }])).toBe(1)
  expect(db.ingest([{ source: 'slack', external_id: 'a', title: 'Hi again' }])).toBe(0)
})

it('setState active->responded stamps responded_at; ->other clears it', async () => {
  const db = await fresh()
  db.ingest([{ source: 'slack', external_id: 'a', title: 'Hi' }])
  const id = db.listCenter()[0].id
  db.setState(id, 'responded')
  expect(db.listResponded()[0].responded_at).toBeTypeOf('number')
  db.setState(id, 'active')
  expect(db.listCenter()[0].responded_at).toBeNull()
})

it('dismissEntries sets dismissed + reason on non-terminal rows', async () => {
  const db = await fresh()
  db.ingest([{ source: 'slack', external_id: 'a', title: 'Hi' }])
  expect(db.dismissEntries([{ source: 'slack', external_id: 'a', reason: 'cold sales' }])).toBe(1)
  expect(db.listDismissed()[0].status_reason).toBe('cold sales')
})

it('addManual creates an active manual row; restore returns to active', async () => {
  const db = await fresh()
  const id = db.addManual('Track this')
  expect(db.listCenter().some(i => i.id === id && i.state === 'active')).toBe(true)
  db.setState(id, 'done')
  db.restore(id)
  expect(db.listCenter().some(i => i.id === id && i.state === 'active')).toBe(true)
})

it('staleResponded returns only items older than threshold', async () => {
  const db = await fresh()
  db.ingest([{ source: 'slack', external_id: 'a', title: 'Hi' }])
  const id = db.listCenter()[0].id
  db.setState(id, 'responded')
  db.setRespondedAt(id, Date.now() - 5 * 86_400_000)
  expect(db.staleResponded(3).length).toBe(1)
  expect(db.staleResponded(7).length).toBe(0)
})

it('migrates legacy states open->active, ignored->dismissed, scanned->new', async () => {
  const raw = new Database(process.env.PLATE_DB!)
  raw.exec(`CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
    ext_id TEXT, deep_link TEXT, app_link TEXT, title TEXT NOT NULL, sender TEXT, snippet TEXT,
    suggested_priority TEXT, suggested_resolution TEXT, ignore_reason TEXT, priority TEXT,
    state TEXT NOT NULL DEFAULT 'new', remind_at INTEGER, recurring_rule_id INTEGER,
    created_at INTEGER NOT NULL, last_touched_at INTEGER NOT NULL, UNIQUE(source, ext_id));`)
  const t = Date.now()
  const ins = raw.prepare(`INSERT INTO items (source,ext_id,title,state,created_at,last_touched_at) VALUES (?,?,?,?,?,?)`)
  ins.run('slack','o','Open one','open',t,t)
  ins.run('slack','i','Ignored one','ignored',t,t)
  ins.run('slack','s','Scanned one','scanned',t,t)
  raw.close()
  const db = await fresh()
  expect(db.listCenter().some(i => i.ext_id === 'o' && i.state === 'active')).toBe(true)
  expect(db.listCenter().some(i => i.ext_id === 's' && i.state === 'new')).toBe(true)
  expect(db.listDismissed().some(i => i.ext_id === 'i')).toBe(true)
})
