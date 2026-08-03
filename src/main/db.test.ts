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

it('dedups slack across channel-prefix and separator variants (normalizes on ts)', async () => {
  const db = await fresh()
  const ts = '1785168351.481429'
  expect(db.ingest([{ source: 'slack', external_id: ts, title: 'bare' }])).toBe(1)
  expect(db.ingest([{ source: 'slack', external_id: `D0AJPGNB8GY-${ts}`, title: 'dash' }])).toBe(0)
  expect(db.ingest([{ source: 'slack', external_id: `D0AJPGNB8GY:${ts}`, title: 'colon' }])).toBe(0)
  expect(db.listCenter().length).toBe(1)
})

it('dismiss matches a slack row regardless of ext_id variant', async () => {
  const db = await fresh()
  const ts = '1785168351.481429'
  db.ingest([{ source: 'slack', external_id: `D0AJPGNB8GY:${ts}`, title: 'colon' }])
  expect(db.dismissEntries([{ source: 'slack', external_id: ts, reason: 'dup' }])).toBe(1)
})

it('does not normalize non-slack ext_ids (distinct ids stay distinct)', async () => {
  const db = await fresh()
  expect(db.ingest([{ source: 'teams', external_id: 'D0AJPGNB8GY-1785168351.481429', title: 'a' }])).toBe(1)
  expect(db.ingest([{ source: 'teams', external_id: '1785168351.481429', title: 'b' }])).toBe(1)
})

it('filterKnown splits candidates already stored (by normalized key) from fresh', async () => {
  const db = await fresh()
  db.ingest([{ source: 'slack', external_id: 'D0AJPGNB8GY:1785168351.481429', title: 'x' }])
  const { fresh: fr, known } = db.filterKnown([
    { source: 'slack', external_id: 'C9OTHER:1785168351.481429' }, // same ts, other channel → known
    { source: 'slack', external_id: '1785168351.999999' },          // different ts → fresh
    { source: 'teams', external_id: 'abc' }                         // different source → fresh
  ])
  expect(known.map(k => k.external_id)).toEqual(['C9OTHER:1785168351.481429'])
  expect(fr.length).toBe(2)
})

it('migration collapses legacy slack ext_id variants to bare ts, keeping most-recent row', async () => {
  const raw = new Database(process.env.PLATE_DB!)
  raw.exec(`CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
    ext_id TEXT, title TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL, last_touched_at INTEGER NOT NULL, UNIQUE(source, ext_id));`)
  const ins = raw.prepare(`INSERT INTO items (source,ext_id,title,state,created_at,last_touched_at) VALUES (?,?,?,?,?,?)`)
  const ts = '1785168351.481429'
  ins.run('slack', `D0AJPGNB8GY:${ts}`, 'colon', 'dismissed', 1, 100) // most recently touched
  ins.run('slack', ts, 'bare', 'new', 2, 50)
  ins.run('slack', `C1-${ts}`, 'dash', 'new', 3, 10)
  raw.close()
  const db = await fresh()
  const slackDismissed = db.listDismissed().filter(i => i.source === 'slack')
  expect(db.listCenter().filter(i => i.source === 'slack').length).toBe(0) // no 'new' survivors
  expect(slackDismissed.length).toBe(1)                                    // three rows → one
  expect(slackDismissed[0].ext_id).toBe(ts)                               // normalized to bare ts
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
