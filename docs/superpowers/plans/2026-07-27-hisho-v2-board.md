# Hisho v2 — three-panel board + skill scanner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing `desktop-hisho` Electron app into a three-panel "what's on my plate" board (Backburner | Active | Responded) whose scanner is the rewritten `whats-on-my-plate` Claude skill, retiring the Python `plate` stack.

**Architecture:** Build **in the `desktop-hisho` repo** (it already owns the `com.mileschristensen.hisho` identity, scaffold, icons, updater, and release repo `milesjc1/hisho`). Reuse its scaffold (electron-vite/React19/TS, better-sqlite3 WAL, window/tray/badge, updater, preload, IPC, timer pattern). Change: DB schema + state model, gut `sync.ts` to spawn the Claude skill headless (instead of inline fetch/classify), add a headless writer CLI the skill pipes JSON into, replace the Feed UI with the board, swap theme to ayu-dark + TT Norms Pro, add nag + stale-responded timers. The `whats-on-my-plate` Python project is retired.

**Tech Stack:** electron-vite, React 19, TypeScript, better-sqlite3 (WAL), electron-updater, vitest (new), Claude Code headless (`claude -p`), MCP (Microsoft 365 / Slack / Linear) + `gh`.

---

## Context

Why: Miles has two overlapping inbox aggregators — `desktop-hisho` (feed + nag + terminal) and `whats-on-my-plate` (Python CLI + SQLite + a Claude skill with cross-source LLM triage). He wants **one** tool: a symmetrical three-panel board (wide Active center; small Backburner left; small Responded-not-done right), with manual items, drag/drop between states, periodic desktop nags, auto-nudge on stale "responded" items, and "Open in native app". He values the skill's LLM judgement and wants it usable both from the app and standalone in a terminal. Python is disposable.

Decisions from brainstorming (spec: `whats-on-my-plate/docs/superpowers/specs/2026-07-27-plate-electron-app-design.md`):
- Direction: new Electron app writing SQLite directly (not the Python-CLI-as-writer model); **keep the skill** as the scanner.
- This app **replaces** desktop-hisho and reuses its exact identity/auto-update repo. → **Build in the `desktop-hisho` repo.** (Refines the spec's "project layout": app lives in `desktop-hisho/`, not `whats-on-my-plate/`.)
- Reminders: periodic nag of active+backburner; Responded auto-nudges when stale. No per-item snooze.
- Theme: ayu-dark. Name: Hisho. Python retirement: commit WIP first, then `git rm`.

**Paths:**
- App repo: `C:\Users\MilesChristensen\Desktop\claude-projects\desktop-hisho`
- Skill: `C:\Users\MilesChristensen\.claude\skills\whats-on-my-plate\` (SKILL.md + collectors/)
- Python project to retire: `C:\Users\MilesChristensen\Desktop\claude-projects\whats-on-my-plate`
- Fonts: `C:\Users\MilesChristensen\Desktop\claude-projects\docs\TTNormsPro-{Normal_1906248079,Medium_2602221191,Bold_525556645,ExtraBold_426236846}.ttf`
- `claude.exe`: `C:\Users\MilesChristensen\.local\bin\claude.exe` · `gh`: on PATH (2.85.0)

**Pre-flight (before Task 1):** copy the plan + spec into the app repo docs and commit a baseline.
```bash
cd C:/Users/MilesChristensen/Desktop/claude-projects/desktop-hisho
git checkout -b hisho-v2-board
mkdir -p docs/superpowers/plans docs/superpowers/specs
# copy this plan → docs/superpowers/plans/2026-07-27-hisho-v2-board.md
# copy the approved spec → docs/superpowers/specs/2026-07-27-hisho-v2-board-design.md
git add docs && git commit -m "docs: Hisho v2 board plan + spec"
```

---

## State model (the contract every task shares)

`ItemState = 'new' | 'active' | 'backburner' | 'responded' | 'done' | 'dismissed'`

- **new** — freshly scanned, untriaged. Shown at the TOP of the Active (center) panel with a NEW flag + quick-sort buttons. Not a separate panel.
- **active** — committed work. Center panel, below new.
- **backburner** — parked. Left panel.
- **responded** — waiting on someone. Right panel. `responded_at` set on entry; stale when `now - responded_at > staleDays`.
- **done** — finished. Done view.
- **dismissed** — ignored (manual or skill triage), keeps `status_reason`. Dismissed view.

Panel queries: center = `state IN ('new','active')` (new first, then `last_touched_at ASC`); left = `state='backburner'`; right = `state='responded'` (by `responded_at ASC`); done/dismissed views by `last_touched_at DESC`.

Migration of existing hisho rows: `open→active`, `ignored→dismissed` (status_reason='(legacy ignored)'), `scanned→new`. `new`/`done`/`dismissed` unchanged. `remind_at` retained (backburner items keep any legacy timer but timers no longer fire — nag replaces them).

---

## Task 1: Add vitest + baseline test harness

**Files:**
- Modify: `desktop-hisho/package.json` (devDeps + `test` script)
- Create: `desktop-hisho/vitest.config.ts`
- Create: `desktop-hisho/src/main/db.test.ts` (temp smoke)

- [ ] **Step 1: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
})
```

- [ ] **Step 2: Add dep + script**

In `package.json` devDependencies add `"vitest": "^2.1.8"`; in scripts add `"test": "vitest run"`, `"test:watch": "vitest"`. Then:
```bash
cd C:/Users/MilesChristensen/Desktop/claude-projects/desktop-hisho
npm install
```
Expected: vitest installed, no errors.

- [ ] **Step 3: Write a failing smoke test**

`src/main/db.test.ts`:
```ts
import { it, expect } from 'vitest'
it('vitest runs', () => { expect(1 + 1).toBe(2) })
```

- [ ] **Step 4: Run**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json vitest.config.ts src/main/db.test.ts
git commit -m "test: add vitest harness"
```

---

## Task 2: Rework shared types to the new state model

**Files:**
- Modify: `desktop-hisho/src/shared/types.ts`

- [ ] **Step 1: Replace ItemState + Item + add ingest/dismiss types**

In `types.ts` replace the `ItemState` union and `Item` interface (keep `Connection`/`ModelAlias`/`RunRequest`/`RunResult` and `RecurringRule*`/`FREQUENCY_PRESETS`/`Priority` as-is so `recurring.ts` still compiles). New:
```ts
export type ItemSource =
  | 'slack' | 'teams' | 'outlook' | 'sharepoint' | 'github' | 'linear' | 'manual' | 'recurring'

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
  state: ItemState
  status_reason: string | null
  responded_at: number | null
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
  deep_link?: string | null
  app_link?: string | null
}

/** {source, external_id, reason} — skill triage dismiss payload. */
export interface DismissEntry { source: ItemSource; external_id: string; reason: string }
```
Remove the old `Item` fields (`suggested_*`, `ignore_reason`, `remind_at`, `recurring_rule_id`, `priority`), the old `ItemState`, `ScannedItem`, and `SyncSummary`. Leave `Priority`, `RecurringRule`, `RecurringRuleInput`, `FrequencyPreset`, `FREQUENCY_PRESETS`, `PRIORITY_LABELS` in place (recurring feature still uses them).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit`
Expected: errors ONLY in files updated by later tasks (`db.ts`, `sync.ts`, `ipc.ts`, `recurring.ts`). Note them; do not fix yet.

- [ ] **Step 3: Commit**
```bash
git add src/shared/types.ts
git commit -m "feat: new ItemState/Item contract for board"
```

---

## Task 3: DB schema migration + panel queries (TDD)

**Files:**
- Modify: `desktop-hisho/src/main/db.ts`
- Test: `desktop-hisho/src/main/db.test.ts`

**DB path change:** honor `PLATE_DB` first so the headless CLI and app share one file. `app.setName('Hisho')` is set in `index.ts` (Task 9) so `userData = %APPDATA%/Hisho`.

- [ ] **Step 1: Write failing tests for migration + transitions**

Replace `src/main/db.test.ts`:
```ts
import { it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdtempSync } from 'fs'
import Database from 'better-sqlite3'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hisho-')); process.env.PLATE_DB = join(dir, 'h.db') })
afterEach(() => { delete process.env.PLATE_DB; rmSync(dir, { recursive: true, force: true }) })

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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL (functions `initDbAt`, `ingest`, `listCenter`, etc. missing).

- [ ] **Step 3: Rewrite db.ts**

Replace `src/main/db.ts` with (recurring-rules functions re-added at the bottom, unchanged from the old file, so the feature survives):
```ts
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

/** Test-friendly opener (also used by initDb and the CLI). */
export function initDbAt(file: string): void {
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all db tests PASS. (If better-sqlite3 errors with `NODE_MODULE_VERSION`, run `npm rebuild better-sqlite3` and retry.)

- [ ] **Step 5: Commit**
```bash
git add src/main/db.ts src/main/db.test.ts
git commit -m "feat: board schema, panel queries, legacy migration, ingest/dismiss"
```

---

## Task 4: Headless writer CLI (`ingest` / `dismiss`)

**Files:**
- Create: `desktop-hisho/src/cli/index.ts`
- Create: `desktop-hisho/src/cli/cli.test.ts`
- Create: `desktop-hisho/src/test/electron-stub.ts`
- Modify: `desktop-hisho/electron.vite.config.ts` (add `cli` input), `vitest.config.ts` (alias electron→stub)

The CLI runs under Electron's Node via `ELECTRON_RUN_AS_NODE=1` so it reuses the electron-ABI `better-sqlite3` (no second native build). It resolves the DB via `PLATE_DB`.

- [ ] **Step 1: Failing CLI test**

`src/cli/cli.test.ts`:
```ts
import { it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'; import { join } from 'path'
import { rmSync, mkdtempSync } from 'fs'
import { runCli } from './index'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cli-')); process.env.PLATE_DB = join(dir, 'c.db') })
afterEach(() => { delete process.env.PLATE_DB; rmSync(dir, { recursive: true, force: true }) })

it('ingest reads stdin JSON and prints inserted count', async () => {
  const out = await runCli('ingest', JSON.stringify([{ source: 'slack', external_id: 'x', title: 'Hey' }]))
  expect(out.trim()).toBe('1')
})
it('dismiss sets reason and prints count', async () => {
  await runCli('ingest', JSON.stringify([{ source: 'slack', external_id: 'x', title: 'Hey' }]))
  const out = await runCli('dismiss', JSON.stringify([{ source: 'slack', external_id: 'x', reason: 'noise' }]))
  expect(out.trim()).toBe('1')
})
```

- [ ] **Step 2: Run → fail**

Run: `npm test`
Expected: FAIL (`./index` has no `runCli`).

- [ ] **Step 3: Implement CLI**

`src/cli/index.ts`:
```ts
import { initDbAt, ingest, dismissEntries } from '../main/db'

/** Pure entry used by tests and main(). Returns stdout text. */
export async function runCli(cmd: string, stdin: string): Promise<string> {
  const file = process.env.PLATE_DB
  if (!file) throw new Error('PLATE_DB not set')
  initDbAt(file)
  const payload = stdin.trim() ? JSON.parse(stdin) : []
  if (cmd === 'ingest') return String(ingest(payload))
  if (cmd === 'dismiss') return String(dismissEntries(payload))
  throw new Error(`unknown command: ${cmd}`)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

if (require.main === module) {
  const cmd = process.argv[2] ?? ''
  readStdin()
    .then((s) => runCli(cmd, s))
    .then((out) => { process.stdout.write(out + '\n'); process.exit(0) })
    .catch((e) => { process.stderr.write(String(e?.message ?? e) + '\n'); process.exit(1) })
}
```
> `db.ts` imports `electron`'s `app`, but the CLI only calls `initDbAt` (never `dbPath`), so `app` is never touched. Under `ELECTRON_RUN_AS_NODE=1` `electron` still resolves. In vitest, alias `electron` to a stub (Step 4).

- [ ] **Step 4: Stub electron in vitest**

`src/test/electron-stub.ts`:
```ts
export const app = { getPath: () => { throw new Error('use PLATE_DB in tests') } }
```
`vitest.config.ts` becomes:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: { alias: { electron: resolve(__dirname, 'src/test/electron-stub.ts') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
})
```

- [ ] **Step 5: Add CLI to the electron-vite build**

In `electron.vite.config.ts`, `main.build.rollupOptions.input`:
```ts
input: {
  index: resolve(__dirname, 'src/main/index.ts'),
  cli: resolve(__dirname, 'src/cli/index.ts')
}
```
(Outputs `out/main/cli.js`.)

- [ ] **Step 6: Run tests + build**

Run: `npm test` → CLI + db tests PASS.
Run: `npm run build` → `out/main/cli.js` exists.

- [ ] **Step 7: Commit**
```bash
git add src/cli src/test/electron-stub.ts vitest.config.ts electron.vite.config.ts
git commit -m "feat: headless writer CLI (ingest/dismiss) sharing db module"
```

---

## Task 5: `plate-write` shim so the skill has one command

**Files:**
- Create: `desktop-hisho/scripts/plate-write.cmd`
- Install: `C:\Users\MilesChristensen\.local\bin\plate-write.cmd`

- [ ] **Step 1: Author the shim**

`scripts/plate-write.cmd` (dev-mode: local electron + built CLI; DB fixed to the app's userData so terminal + app agree):
```bat
@echo off
set "ELECTRON_RUN_AS_NODE=1"
if "%PLATE_DB%"=="" set "PLATE_DB=%APPDATA%\Hisho\hisho.db"
"%~dp0..\node_modules\.bin\electron.cmd" "%~dp0..\out\main\cli.js" %*
```

- [ ] **Step 2: Install to a PATH dir** — copy to `~/.local/bin` but hardcode the repo path (the `%~dp0` in the installed copy would point at `.local/bin`, not the repo):
```bat
@echo off
set "ELECTRON_RUN_AS_NODE=1"
set "REPO=C:\Users\MilesChristensen\Desktop\claude-projects\desktop-hisho"
if "%PLATE_DB%"=="" set "PLATE_DB=%APPDATA%\Hisho\hisho.db"
"%REPO%\node_modules\.bin\electron.cmd" "%REPO%\out\main\cli.js" %*
```
```bash
cp <installed variant> "C:/Users/MilesChristensen/.local/bin/plate-write.cmd"
```

- [ ] **Step 3: Manual verify (after Task 4 build)**
```bash
echo [{"source":"slack","external_id":"shim1","title":"shim test"}] | plate-write ingest
```
Expected: prints `1`. Re-run → prints `0`.

- [ ] **Step 4: Commit**
```bash
git add scripts/plate-write.cmd
git commit -m "feat: plate-write shim (ELECTRON_RUN_AS_NODE) for the skill"
```

---

## Task 6: Rewrite the Claude skill — MCP fetch, keep triage, write via shim

**Files (the skill dir, outside the repo):**
- Modify: `~/.claude/skills/whats-on-my-plate/SKILL.md`
- Create: `~/.claude/skills/whats-on-my-plate/collectors/teams.md`
- Create: `~/.claude/skills/whats-on-my-plate/collectors/outlook.md`
- Keep unchanged: `collectors/{slack,github,linear}.md`

- [ ] **Step 1: New teams collector**

`collectors/teams.md` — read-only, window {N} days. Resolve me via `mcp__claude_ai_Microsoft_365__get_me`. Enumerate Teams chats via `mcp__claude_ai_Microsoft_365__teams_list_chats` + `chat_message_search`; keep chats/messages where the latest message is NOT from me (`kind:"dm"` for 1:1, `kind:"mention"` when @-mentioned). Emit `{source:"teams", external_id:<message/chat id>, kind, title:<chat/topic>, snippet:<=200 chars, author, url:<web link>, app_link:"msteams:/l/..." when ids known else null, source_ts:ISO8601, awaiting_reply:true}`. Return a JSON array or `{"error":"..."}`.

- [ ] **Step 2: New outlook collector**

`collectors/outlook.md` — read-only, window {N} days. Resolve me via `get_me`. Use `mcp__claude_ai_Microsoft_365__outlook_email_search` for mail addressed to me in-window where I have not replied. Drop calendar auto-responses (subject starts with `Accepted:/Declined:/Tentative:/Canceled:/Cancelled:`) — preserves the old Python `CALENDAR_PREFIXES` filter. Emit `{source:"outlook", external_id:<message id>, kind:"email"|"email_cc", title:<subject>, snippet, author:<from>, url:<OWA web link>, app_link:null, source_ts, awaiting_reply:true}`. Return JSON array or `{"error":"..."}`.

- [ ] **Step 3: Rewrite SKILL.md procedure**

Replace the Procedure so it: (a) drops ALL `python -m plate.cli …`; (b) dispatches **five** collector subagents in parallel (slack, teams, outlook, github, linear) reading via MCP/`gh`; (c) keeps the **triage judgement**: read all normalized items, split actionable vs noise (cold sales, mass announcements, FYI auto-notices, calendar chatter; KEEP anything a real person awaits, @mentions, review requests, assigned issues, direct asks; keep-when-unsure); (d) write actionable items `<json array> | plate-write ingest`; write noise `[{source,external_id,reason}] | plate-write dismiss`; (e) print a short summary ("N on your plate, M auto-dismissed — open Hisho"). Update front-matter description: writes to Hisho's DB via `plate-write`. Keep the 7/3/1-day window logic. Remove the Graph/`login`/`fetch-teams`/`fetch-outlook`/`scan-start`/`scan-finish`/`digest`/`mark` sections.

- [ ] **Step 4: Manual verify (end-to-end, after Tasks 5 + 9 exist)**

Terminal at `claude-projects`: `what's on my plate (last 3 days)` → skill fetches via MCP, prints the summary, and `%APPDATA%/Hisho/hisho.db` gains `new` + `dismissed` rows.

- [ ] **Step 5: Record change** — skill lives under `~/.claude` (not the app repo). If it is not a git repo, skip commit; the change is captured in memory (Task 15).

---

## Task 7: IPC surface for the board

**Files:**
- Modify: `desktop-hisho/src/main/ipc.ts`

- [ ] **Step 1: Replace registerIpc with board handlers** (keep the `openLink` Teams-rewrite helper):
```ts
import { ipcMain, shell } from 'electron'
import {
  listCenter, listBackburner, listResponded, listDone, listDismissed,
  setState, addManual, restore, newCount, getSetting, setSetting
} from './db'
import { runPull } from './sync'
import { emitToRenderer, setBadgeCount } from './window'
import type { ItemState } from '../shared/types'

function touched(): void { setBadgeCount(newCount()); emitToRenderer('items:changed') }

function openLink(url: string): void {
  let t = url
  if (t.startsWith('https://teams.microsoft.com/l/')) t = t.replace('https://teams.microsoft.com/l/', 'msteams:/l/')
  void shell.openExternal(t)
}

export function registerIpc(): void {
  ipcMain.handle('shell:open', (_e, url: string) => openLink(url))
  ipcMain.handle('board:center', () => listCenter())
  ipcMain.handle('board:backburner', () => listBackburner())
  ipcMain.handle('board:responded', () => listResponded())
  ipcMain.handle('board:done', () => listDone())
  ipcMain.handle('board:dismissed', () => listDismissed())
  ipcMain.handle('item:setState', (_e, id: number, state: ItemState) => { setState(id, state); touched() })
  ipcMain.handle('item:addManual', (_e, title: string) => { const id = addManual(title); touched(); return id })
  ipcMain.handle('item:restore', (_e, id: number) => { restore(id); touched() })
  ipcMain.handle('pull:run', (_e, days: number) => runPull(days))
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key) ?? null)
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value))
}
```

- [ ] **Step 2: Typecheck** — `npx tsc -p tsconfig.node.json --noEmit` (still errors until `sync.runPull` exists in Task 8; note only that).
- [ ] **Step 3: Commit** — `git add src/main/ipc.ts && git commit -m "feat: board IPC handlers"`

---

## Task 8: Gut `sync.ts` → spawn the skill headless (Pull)

**Files:**
- Replace: `desktop-hisho/src/main/sync.ts`

- [ ] **Step 1: Replace sync.ts**
```ts
import { spawn } from 'child_process'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'
import { newCount, getSetting } from './db'

const PROJECTS_DIR = 'C:\\Users\\MilesChristensen\\Desktop\\claude-projects'
const CLAUDE = 'C:\\Users\\MilesChristensen\\.local\\bin\\claude.exe'

let running = false

function dbFile(): string {
  return process.env.PLATE_DB || `${process.env.APPDATA}\\Hisho\\hisho.db`
}

export function runPull(days: number): Promise<{ ok: boolean; error?: string }> {
  if (running) return Promise.resolve({ ok: false, error: 'already running' })
  running = true
  return new Promise((resolve) => {
    const prompt = `what's on my plate (last ${days} days)`
    const args = ['-p', '--permission-mode', 'auto', '--model', getSetting('scanModel') || 'sonnet']
    const child = spawn(`"${CLAUDE}" ${args.join(' ')}`, {
      cwd: PROJECTS_DIR, shell: true, windowsHide: true,
      env: { ...process.env, PLATE_DB: dbFile() }
    })
    let stderr = ''
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.stdin.write(prompt); child.stdin.end()
    child.on('error', (e) => { running = false; resolve({ ok: false, error: e.message }) })
    child.on('close', (code) => {
      running = false
      setBadgeCount(newCount())
      emitToRenderer('items:changed')
      if (code === 0) {
        const n = newCount()
        if (n > 0) { notify(`${n} on your plate`, 'Hisho pulled new items.'); showAndFocus() }
        resolve({ ok: true })
      } else resolve({ ok: false, error: `claude exited ${code}: ${stderr.slice(0, 400)}` })
    })
  })
}
```

- [ ] **Step 2: Typecheck** — `npx tsc -p tsconfig.node.json --noEmit`. Expected: `ipc.ts` + `sync.ts` clean; remaining errors only in `index.ts`/`recurring.ts` (Task 9) and renderer (later).
- [ ] **Step 3: Commit** — `git add src/main/sync.ts && git commit -m "feat: Pull spawns the whats-on-my-plate skill headless"`

---

## Task 9: Wire main lifecycle — name, timers, retire old services

**Files:**
- Modify: `desktop-hisho/src/main/index.ts`, `desktop-hisho/src/main/recurring.ts`
- Create: `desktop-hisho/src/main/nag.ts`, `desktop-hisho/src/main/stale.ts`, `desktop-hisho/src/main/nag.test.ts`
- Delete: `desktop-hisho/src/main/backburner.ts`

- [ ] **Step 1: Failing test for work-hours gate**

`src/main/nag.test.ts`:
```ts
import { it, expect } from 'vitest'
import { isWorkHours } from './nag'
it('true inside window, false outside', () => {
  expect(isWorkHours(new Date('2026-07-27T10:00:00'), 9, 18)).toBe(true)
  expect(isWorkHours(new Date('2026-07-27T20:00:00'), 9, 18)).toBe(false)
})
```

- [ ] **Step 2: Run → fail** (`isWorkHours` missing).

- [ ] **Step 3: Implement nag.ts**
```ts
import { notify } from './notify'
import { countState, getSetting } from './db'

let timer: ReturnType<typeof setInterval> | null = null

export function isWorkHours(d: Date, startHr: number, endHr: number): boolean {
  const h = d.getHours(); return h >= startHr && h < endHr
}
function num(key: string, def: number): number { const n = Number(getSetting(key)); return Number.isFinite(n) && n > 0 ? n : def }

export function startNag(): void {
  const hours = num('nagHours', 3)
  const tick = (): void => {
    if (!isWorkHours(new Date(), num('workStart', 9), num('workEnd', 18))) return
    const active = countState('active'), back = countState('backburner')
    if (active + back === 0) return
    notify('On your plate', `${active} active · ${back} backburner`)
  }
  if (!timer) timer = setInterval(tick, hours * 3_600_000)
}
export function stopNag(): void { if (timer) clearInterval(timer); timer = null }
```

- [ ] **Step 4: Implement stale.ts**
```ts
import { notify } from './notify'
import { emitToRenderer } from './window'
import { staleResponded, getSetting } from './db'

let timer: ReturnType<typeof setInterval> | null = null
const TICK_MS = 30 * 60_000

export function startStale(): void {
  const tick = (): void => {
    const days = Number(getSetting('staleDays')) || 3
    const stale = staleResponded(days)
    if (stale.length > 0) { notify(`${stale.length} awaiting follow-up`, 'Responded items went stale.'); emitToRenderer('items:changed') }
  }
  if (!timer) { timer = setInterval(tick, TICK_MS); tick() }
}
export function stopStale(): void { if (timer) clearInterval(timer); timer = null }
```

- [ ] **Step 5: Update index.ts + recurring.ts**

`index.ts`: after `app.setAppUserModelId('com.mileschristensen.hisho')` add `app.setName('Hisho')`. Replace the services block and imports so it uses `startRecurring/startNag/startStale` (drop `startSync`/`startBackburner`):
```ts
initDb()
createWindow()
createTray(() => { setQuitting(true); app.quit() })
registerIpc()
startRecurring()
startNag()
startStale()
initAutoUpdate()
```
In `before-quit` call `stopRecurring(); stopNag(); stopStale()`. Remove `sync`/`backburner` imports. Keep the global hotkey (`focusCapture`) and single-instance logic.

`recurring.ts`: change the one `untriagedCount` import/use to `newCount`; it otherwise already uses `listRules/spawnRecurringItem/markRuleSpawned` (still present in db.ts).

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test` (nag test passes) and `npx tsc -p tsconfig.node.json --noEmit` (main clean).

- [ ] **Step 7: Commit**
```bash
git rm src/main/backburner.ts
git add src/main/index.ts src/main/nag.ts src/main/stale.ts src/main/nag.test.ts src/main/recurring.ts
git commit -m "feat: Hisho name, nag + stale timers, retire inline sync/backburner"
```

---

## Task 10: preload API + renderer types

**Files:**
- Modify: `desktop-hisho/src/preload/index.ts`
- Modify: `desktop-hisho/src/renderer/global.d.ts` if the `window.hisho` type isn't picked up (it derives from `HishoApi` automatically)

- [ ] **Step 1: Replace the api object** (keep `contextBridge.exposeInMainWorld('hisho', api)` + `export type HishoApi = typeof api`):
```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { Item, ItemState } from '../shared/types'

const api = {
  center: (): Promise<Item[]> => ipcRenderer.invoke('board:center'),
  backburner: (): Promise<Item[]> => ipcRenderer.invoke('board:backburner'),
  responded: (): Promise<Item[]> => ipcRenderer.invoke('board:responded'),
  done: (): Promise<Item[]> => ipcRenderer.invoke('board:done'),
  dismissed: (): Promise<Item[]> => ipcRenderer.invoke('board:dismissed'),
  setState: (id: number, state: ItemState): Promise<void> => ipcRenderer.invoke('item:setState', id, state),
  addManual: (title: string): Promise<number> => ipcRenderer.invoke('item:addManual', title),
  restore: (id: number): Promise<void> => ipcRenderer.invoke('item:restore', id),
  openLink: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),
  pull: (days: number): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('pull:run', days),
  getSetting: (k: string): Promise<string | null> => ipcRenderer.invoke('settings:get', k),
  setSetting: (k: string, v: string): Promise<void> => ipcRenderer.invoke('settings:set', k, v),
  onItemsChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb(); ipcRenderer.on('items:changed', h)
    return () => ipcRenderer.removeListener('items:changed', h)
  }
}
contextBridge.exposeInMainWorld('hisho', api)
export type HishoApi = typeof api
```

- [ ] **Step 2: Typecheck** `npx tsc -p tsconfig.node.json --noEmit` → clean.
- [ ] **Step 3: Commit** — `git add src/preload/index.ts && git commit -m "feat: board preload api"`

---

## Task 11: ayu-dark theme + TT Norms Pro

**Files:**
- Create: `desktop-hisho/resources/fonts/TTNormsPro-{Normal,Medium,Bold,ExtraBold}.ttf`
- Replace: `desktop-hisho/src/renderer/theme.css`
- Modify: `desktop-hisho/src/renderer/app.css`
- Modify: `desktop-hisho/package.json` build.files

- [ ] **Step 1: Copy fonts**
```bash
mkdir -p resources/fonts
cp "C:/Users/MilesChristensen/Desktop/claude-projects/docs/TTNormsPro-Normal_1906248079.ttf" resources/fonts/TTNormsPro-Normal.ttf
cp "C:/Users/MilesChristensen/Desktop/claude-projects/docs/TTNormsPro-Medium_2602221191.ttf" resources/fonts/TTNormsPro-Medium.ttf
cp "C:/Users/MilesChristensen/Desktop/claude-projects/docs/TTNormsPro-Bold_525556645.ttf" resources/fonts/TTNormsPro-Bold.ttf
cp "C:/Users/MilesChristensen/Desktop/claude-projects/docs/TTNormsPro-ExtraBold_426236846.ttf" resources/fonts/TTNormsPro-ExtraBold.ttf
```

- [ ] **Step 2: theme.css** — ayu-dark tokens + @font-face. Wire the fonts by importing them in `main.tsx` with `?url` and injecting `@font-face` via a small `<style>`, OR (simpler with electron-vite) place the four ttf under `src/renderer/public/fonts/` and reference `/fonts/*.ttf`. Acceptance: fonts render as TT Norms Pro in `npm run dev`.
```css
@font-face { font-family:'TT Norms Pro'; font-weight:400; src:url('/fonts/TTNormsPro-Normal.ttf'); }
@font-face { font-family:'TT Norms Pro'; font-weight:500; src:url('/fonts/TTNormsPro-Medium.ttf'); }
@font-face { font-family:'TT Norms Pro'; font-weight:700; src:url('/fonts/TTNormsPro-Bold.ttf'); }
@font-face { font-family:'TT Norms Pro'; font-weight:800; src:url('/fonts/TTNormsPro-ExtraBold.ttf'); }
:root {
  --bg:#0b0e14; --panel:#0f131a; --col:#11161f; --center:#0e1420; --line:#1e232b;
  --fg:#bfbdb6; --muted:#686868; --white:#fff;
  --blue:#59c2ff; --green:#aad94c; --yellow:#ffb454; --red:#f07178; --cyan:#95e6cb; --magenta:#d2a6ff;
  --font:'TT Norms Pro',-apple-system,'Segoe UI',sans-serif;
}
* { box-sizing:border-box; }
html,body,#root { height:100%; margin:0; }
body { font-family:var(--font); background:var(--bg); color:var(--fg); font-size:14px; -webkit-font-smoothing:antialiased; }
button,input,select,textarea { font-family:inherit; }
```

- [ ] **Step 3: app.css board classes** — add `.app`, `.topbar`, `.board{display:grid;grid-template-columns:1fr 2.2fr 1fr;gap:12px}`, `.panel`, `.panel.center`, `.card`, `.badge.b-{magenta,blue,cyan,yellow,white,green}`, `.new-dot`, `.waiting`, `.waiting.stale{color:var(--red)}`, `.open-btn`, `.sortbtns .mini`, `.drop-hover`. Mirror the approved mockup `whats-on-my-plate/.superpowers/brainstorm/42078-1785171757/content/board-3panel.html`.

- [ ] **Step 4: Bundle fonts** — in `package.json` build.files add `"resources/fonts/**"` (and if using `src/renderer/public`, electron-vite copies it automatically).

- [ ] **Step 5: Commit**
```bash
git add resources/fonts src/renderer/theme.css src/renderer/app.css package.json
git commit -m "feat: ayu-dark theme + TT Norms Pro"
```

---

## Task 12: Board renderer — panels, cards, drag/drop, views, add, settings

**Files:**
- Replace: `desktop-hisho/src/renderer/App.tsx`, `desktop-hisho/src/renderer/lib.ts`
- Create: `Board.tsx`, `Panel.tsx`, `ItemCard.tsx`, `AddManual.tsx`, `DoneView.tsx`, `DismissedView.tsx`, `Settings.tsx`
- Delete: `Feed.tsx`, `Backburner.tsx`, `Archive.tsx`, `Ignored.tsx`, `RecurringRules.tsx`, `menus.tsx`

- [ ] **Step 1: lib.ts helpers**
```ts
export const SOURCE_BADGE: Record<string, string> = {
  slack:'b-magenta', teams:'b-blue', outlook:'b-cyan', linear:'b-yellow',
  github:'b-white', manual:'b-green', recurring:'b-green', sharepoint:'b-cyan'
}
export function waitingDays(respondedAt: number | null): number | null {
  if (!respondedAt) return null
  return Math.floor((Date.now() - respondedAt) / 86_400_000)
}
```

- [ ] **Step 2: ItemCard.tsx** — props `{ item, showSort?, staleDays? }`. Render source badge (`SOURCE_BADGE[item.source]`), title, `sender · snippet`, an **Open** button when `item.app_link ?? item.deep_link` (calls `window.hisho.openLink`), a `.waiting` line for responded items (`waitingDays`, add `.stale` when `days >= staleDays`), and when `showSort` a `.sortbtns` row (← Backburner / Responded → / ✓ Done) calling `window.hisho.setState`. Card `draggable`; `onDragStart` sets `e.dataTransfer.setData('text/plain', String(item.id))`.

- [ ] **Step 3: Panel.tsx** — props `{ title, count, state, children }`. `.panel` with header + count. Drop target: `onDragOver` `preventDefault()` + toggle `.drop-hover`; `onDrop` reads the id and calls `window.hisho.setState(id, state)` (refresh comes via `onItemsChanged`).

- [ ] **Step 4: Board.tsx** — state `center/back/resp`, load via `window.hisho.center()/backburner()/responded()`, subscribe `onItemsChanged`, read `staleDays` setting. Render `.board`: left `<Panel state="backburner">` maps back; center `<Panel state="active">` renders `new` items first (`showSort`) then `active`; right `<Panel state="responded">` maps resp with `staleDays`.

- [ ] **Step 5: AddManual.tsx** — inline input; Enter → `window.hisho.addManual(title.trim())` then clear.

- [ ] **Step 6: DoneView / DismissedView** — list `window.hisho.done()` / `dismissed()`; each row a **Restore** button (`window.hisho.restore(id)`). Dismissed rows show `status_reason`.

- [ ] **Step 7: Settings.tsx** — read/write via `getSetting`/`setSetting`: `nagHours`(3), `workStart`(9), `workEnd`(18), `staleDays`(3), `scanModel`(sonnet), `scanDays`(7).

- [ ] **Step 8: App.tsx** — top bar (brand "Hisho", day `<select>` 1/3/7 seeded from `scanDays`, **Pull** → `window.hisho.pull(days)` with a spinner + error toast on `{ok:false}`, **+ Add**, **Done**, **Dismissed**, **Settings**). Body renders `Board` or the selected view. Persist the chosen day to `scanDays`.

- [ ] **Step 9: Run dev + manual smoke**

Run: `npm run dev`
Expected: 3-panel board (ayu-dark, TT Norms Pro). Add manual → Active. Drag Active→Backburner→Responded (shows "waiting 0d"). Done/Dismissed views + Restore work. **Pull** (needs Tasks 5+6) pulls items.

- [ ] **Step 10: Commit**
```bash
git rm src/renderer/Feed.tsx src/renderer/Backburner.tsx src/renderer/Archive.tsx src/renderer/Ignored.tsx src/renderer/RecurringRules.tsx src/renderer/menus.tsx
git add src/renderer
git commit -m "feat: three-panel board UI (drag/drop, views, add, settings)"
```

---

## Task 13: Build, version bump, verify packaging path

**Files:**
- Modify: `desktop-hisho/package.json` (version, description)

- [ ] **Step 1: Bump + describe** — `"version": "0.2.0"`, update `description`. Keep appId/publish (`milesjc1/hisho`) unchanged.
- [ ] **Step 2: Rebuild native + build**
```bash
npm run rebuild
npm run build
```
Expected: `out/main/index.js` + `out/main/cli.js`, no TS errors.
- [ ] **Step 3: Full test run** — `npm test` → all green.
- [ ] **Step 4: Commit** — `git add package.json && git commit -m "chore: Hisho v2 0.2.0"`

---

## Task 14: Retire the Python `whats-on-my-plate` project

**Files (other repo):** `C:\Users\MilesChristensen\Desktop\claude-projects\whats-on-my-plate`

- [ ] **Step 1: Commit last session's WIP first**
```bash
cd C:/Users/MilesChristensen/Desktop/claude-projects/whats-on-my-plate
git add -A
git commit -m "chore: snapshot Python triage WIP before retirement"
```
- [ ] **Step 2: Remove the Python tree**
```bash
git rm -r plate tests requirements-dev.txt
```
(Keep `docs/` specs for provenance.)
- [ ] **Step 3: Point README at Hisho**
Replace `README.md` with a short note: "Retired. Superseded by the Hisho v2 board app (`../desktop-hisho`); the scanner lives in the `whats-on-my-plate` Claude skill, which now writes to Hisho's DB via `plate-write`." Then:
```bash
git add README.md && git commit -m "docs: retire Python plate; superseded by Hisho v2"
```

---

## Task 15: Update memory

**Files:** `C:\Users\MilesChristensen\.claude\projects\C--Users-MilesChristensen-Desktop-claude-projects\memory\`

- [ ] **Step 1** — Edit `whats-on-my-plate.md`: Python stack retired; skill now writes to Hisho's SQLite via the `plate-write` shim (ELECTRON_RUN_AS_NODE); scanner = 5 MCP/`gh` collectors + triage.
- [ ] **Step 2** — Edit `desktop-hisho.md`: Hisho v2 = three-panel board (Backburner|Active|Responded), states new/active/backburner/responded/done/dismissed, Pull spawns the skill, nag + stale-responded timers, ayu-dark + TT Norms Pro, branch `hisho-v2-board`. Update `MEMORY.md` hooks.

---

## Verification (end-to-end)

1. `cd desktop-hisho && npm install && npm run rebuild && npm test` → all vitest green (migration, ingest/dedup, setState/responded_at, dismiss, stale, CLI, work-hours).
2. `npm run build` → `out/main/index.js` + `out/main/cli.js`.
3. Shim: `echo [{"source":"slack","external_id":"v1","title":"verify"}] | plate-write ingest` → `1`; re-run → `0`.
4. `npm run dev` → 3-panel ayu-dark board in TT Norms Pro. Add manual → Active. Drag Active→Backburner→Responded ("waiting 0d"). Done/Dismissed views + Restore.
5. Terminal at `claude-projects`: `what's on my plate (last 3 days)` → skill fetches via MCP/gh, writes rows; board shows new items in Active with NEW + quick-sort; noise in Dismissed with reasons.
6. In-app **Pull** (7 days) → spawns the skill, board refreshes, "N on your plate" toast.
7. Force a stale nudge: set a Responded item's `responded_at` 4 days back (or `staleDays=0`); a stale tick fires the follow-up notification; card shows red "waiting Nd".
8. One Hisho in the tray; `%APPDATA%/Hisho/hisho.db` is the single DB (no identity collision).

## Out of scope (v1)
Per-item snooze; recurring-rule editing UI (rules still spawn via main); migrating old Python `plate.db` data; packaged-shim hardening (dev shim only); drag-reordering within a panel; priority tiers.
