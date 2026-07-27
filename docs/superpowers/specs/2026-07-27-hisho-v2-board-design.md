# whats-on-my-plate — Electron desktop app (design)

**Date:** 2026-07-27
**Status:** Approved design, pre-plan
**Supersedes:** the Tkinter reader (`plate/app.py`) and the Python `plate` package as the write path.

## Summary

Replace the Python CLI + Tkinter reader with a single **Electron desktop app** that owns its
own SQLite database and writes it directly (better-sqlite3), modeled on `desktop-hisho`. A
three-panel board is the primary surface: a wide **Active** center, a small **Backburner** lane
on the left, a small **Responded** lane on the right. New scanned items arrive at the top of
Active flagged NEW; the user sorts them by drag or quick-buttons into Backburner / Responded /
Done / Dismissed.

The intelligent **Claude skill** is kept — it remains the scanner and the LLM-judgement (triage)
layer. Python is retired entirely. The skill writes to the app's DB through a small bundled
**Node writer CLI** so it works both from the app's Pull button (spawned headless) and
standalone in a terminal ("what's on my plate").

## Goals

- One desktop app that lets Miles: add manual items, run the skill to pull items, move items
  between states (drag/drop), get periodic desktop-notification nags, and open items in their
  native app (Slack/Teams/Outlook/Linear/GitHub).
- Keep the skill's cross-source LLM judgement (the thing that made it "feel intelligent").
- Kill the Python stack (schema/persister/digest/cli/graph/sources/app + pytest). Nothing in
  Python survives.

## Non-goals (v1)

- Migrating data out of the old Python `plate.db` (start fresh — the data is small and personal).
- Per-item snooze timers (reminders are a periodic nag of the whole active+backburner list).
- Mobile / web / multi-user. Single local user, single machine.
- In-app reply/send to any source. The skill and app stay read-only toward sources; the only
  thing they mutate is the local DB.

## Architecture

Reuse the `desktop-hisho` scaffold wholesale: `electron-vite` + React 19 + TypeScript,
`better-sqlite3` (WAL), `electron-updater`, and hisho's `main/` helpers (`window.ts`,
`notify.ts`, `updater.ts`, `claude-runner.ts`, the `openLink` deep-link logic from `ipc.ts`).

Three processes/pieces:

1. **Electron main** — owns the DB via a shared `db` module; registers IPC for every UI action;
   runs two background timers (nag + stale-responded); spawns the skill headless on Pull.
2. **Renderer (React)** — the three-panel board + Done/Dismissed views + Add-manual + Settings.
3. **Node writer CLI** (`plate-cli`) — a tiny standalone Node entry bundled with the app that
   imports the *same* DB module and exposes `ingest` (persist scanned items) and `dismiss`
   (auto-dismiss noise). The skill pipes JSON to it. This is the only reason the skill can write
   without Electron running.

### Writer: one DB module, two front doors

Both the Electron main process and the Node CLI import one `db` module. The single subtlety is
the **DB path**: Electron resolves it via `app.getPath('userData')`; the headless CLI has no
Electron. Resolve as: `process.env.PLATE_DB` if set, else a fixed well-known location
(`%APPDATA%/whats-on-my-plate/plate.db`). The app writes `PLATE_DB` into the environment of the
skill process it spawns, so app-triggered and terminal-triggered scans hit the same file.

### Scan flow (Pull)

`sync.ts` no longer fetches/classifies inline (hisho's model). Instead Pull:

1. Spawns `claude -p "<what's on my plate, last N days>" --permission-mode auto` via the
   `claude-runner` pattern, with `PLATE_DB` set and cwd = `claude-projects` (so MCP config
   resolves). Read-only: `--permission-mode auto`, NOT `--dangerously-skip-permissions`.
2. The skill fetches all five sources **via MCP + `gh`** (no Python Graph): Microsoft 365 MCP for
   Teams + Outlook, Slack MCP, Linear MCP, `gh` CLI for GitHub. It normalizes to the item
   contract, applies its LLM triage judgement, then writes: actionable items via
   `plate-cli ingest` (state `new`), noise via `plate-cli dismiss` (state `dismissed` + reason).
3. On the skill process closing, main emits `items:changed`; the renderer reloads.

The same skill invoked from a terminal does the identical thing (writes to the same DB).

## Data model

Fresh SQLite DB. One `items` table, one `settings` table.

```sql
CREATE TABLE items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT NOT NULL,          -- slack|teams|outlook|github|linear|manual
  ext_id        TEXT,                   -- stable per-thread id; NULL for manual
  kind          TEXT,                   -- dm|mention|email|pr_review_req|issue_assigned|...
  deep_link     TEXT,                   -- web URL
  app_link      TEXT,                   -- native desktop URI (slack://, msteams:/l/…) or NULL
  title         TEXT NOT NULL,
  sender        TEXT,
  snippet       TEXT,
  state         TEXT NOT NULL DEFAULT 'new',   -- new|active|backburner|responded|done|dismissed
  status_reason TEXT,                   -- why triage dismissed it
  responded_at  INTEGER,                -- ms; set when moved to 'responded' (drives stale nudge)
  created_at    INTEGER NOT NULL,
  last_touched_at INTEGER NOT NULL,     -- resets on interaction; orders within a panel
  UNIQUE(source, ext_id)
);

CREATE TABLE settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
```

`UNIQUE(source, ext_id)` + `INSERT … ON CONFLICT DO NOTHING` on ingest makes rescans idempotent:
an item already triaged/done/dismissed is never reset by a later scan. Manual items get
`source='manual'`, `ext_id=NULL` (unique constraint ignores NULLs, so multiple manual rows are
fine). Dismissed items are kept (not deleted) so rescans don't resurface them.

### State model

- **new** — freshly scanned, untriaged. Rendered in the **Active** center panel, pinned to the
  top with a NEW flag and quick-sort buttons. (Not a separate column — it's the top of Active.)
- **active** — committed working item. Center panel, below the NEW items.
- **backburner** — parked, not now. Left panel.
- **responded** — waiting on someone else. Right panel. Sets `responded_at`; shows "waiting Nd";
  goes red + nudges once `now - responded_at > staleDays`.
- **done** — finished. Done view.
- **dismissed** — ignore (manual or skill-triage). Dismissed view, with reason.

Transitions: any panel item can be dragged to any other panel, or to Done/Dismissed (drop
targets or buttons). NEW items additionally get one-click ← Backburner / Responded → / ✓ Done.
Restore from Done/Dismissed returns an item to `active`.

## UI

Single window, ayu-dark theme (palette below), TT Norms Pro.

- **Top bar:** brand, day selector (1/3/7, default 7), **Pull**, **+ Add**, **Done**, **Dismissed**.
- **Board:** CSS grid `1fr 2.2fr 1fr` — Backburner | Active | Responded. Symmetric sides.
- **Card:** source-colored badge, title, sender, snippet, **Open** button (deep-links to native
  app via `app_link` ?? `deep_link`; Teams web links rewritten to `msteams:/l/` as hisho does).
  Responded cards show "waiting Nd" (red past threshold). NEW cards show the quick-sort row.
- **Drag/drop:** HTML5 DnD; dropping a card on a panel calls the matching state-change IPC.
- **Add manual:** small inline input in the top bar / a modal; creates a `manual` item in
  `active`.
- **Done / Dismissed views:** lists with Restore (→ active); Dismissed shows the reason and a
  Clear-all.
- **Settings:** nag cadence (hrs) + work-hours window, stale-responded threshold (days), scan
  model, default scan days.

**ayu-dark palette:** bg `#0b0e14`, panel `#0f131a`, line `#1e232b`, fg `#bfbdb6`, muted
`#686868`, blue `#59c2ff`, green `#aad94c`, yellow `#ffb454`, red `#f07178`, cyan `#95e6cb`,
magenta `#d2a6ff`, white `#ffffff`. Source badge colors: slack=magenta, teams=blue,
outlook=cyan, linear=yellow, github=white, manual=green.

## Background behavior

- **Nag timer:** every `nagHours` (default 3) during work hours (default 9am–6pm), one toast
  summarizing active + backburner counts ("3 active · 2 backburner"). Click focuses the window.
  Skips if both counts are zero.
- **Stale-responded timer:** periodically scans `responded` items; any with
  `now - responded_at > staleDays` (default 3) triggers a notification to follow up and is marked
  visually stale (red). Does not auto-move the item.
- Reuse hisho's tray badge = count of `new` items.

## Error handling

- Skill spawn: capture stderr; if `claude` exits without a result, surface a toast + inline error
  in the top bar (reuse hisho's `RunResult.error` handling). Auth failures (MCP/gh) bubble up as
  the skill's own message.
- Node CLI ingest: validate each item (require `source`, one of the known values, non-empty
  `title`); skip invalid rows; report a count. Bad JSON on stdin → non-zero exit + message.
- DB: WAL mode; all writes in the main process or the CLI (never the renderer). Single-writer at
  a time in practice (Pull is serialized; UI writes are synchronous better-sqlite3 calls).

## Testing

- **vitest** unit tests for the main-process `db` module: ingest dedup/ON CONFLICT, every state
  transition, `responded_at` set on → responded, stale calculation, manual add, restore.
- **vitest** for pure helpers: JSON-array extraction from skill output, item validation, stale/
  waiting-days formatting, nag-window (is-work-hours) logic.
- Node CLI: `ingest` reads stdin JSON → rows; `dismiss` sets state+reason; both resolve the DB
  path from `PLATE_DB`. Test against a temp DB via `PLATE_DB`.
- No heavy Electron e2e in v1 (matches hisho); renderer logic kept thin and pure where testable.

## Project layout

New app lives in `whats-on-my-plate/` (replacing the Python tree, which is deleted). Structure
mirrors hisho:

```
src/main/       index.ts window.ts db.ts ipc.ts sync.ts notify.ts nag.ts stale.ts
                claude-runner.ts updater.ts
src/cli/        index.ts            # the Node writer CLI (ingest, dismiss)
src/preload/    index.ts
src/renderer/   App.tsx Board.tsx Panel.tsx ItemCard.tsx AddManual.tsx
                DoneView.tsx DismissedView.tsx Settings.tsx theme.css lib.ts
src/shared/     types.ts
electron.vite.config.ts, package.json, tsconfig*.json
```

The Claude skill at `~/.claude/skills/whats-on-my-plate/SKILL.md` is rewritten: drop all
`python -m plate.cli …` calls; fetch every source via MCP/`gh`; keep the triage judgement step;
write via `node <bundled plate-cli> ingest` / `dismiss`.

## Auto-update / packaging

Reuse hisho's `electron-builder` NSIS + `electron-updater` setup. GitHub publish target
(owner/repo) is left for Miles to point at a repo when he wants releases; dev/build works without
it.

## Open decisions deferred to the plan

- Exact skill rewrite: single fetch prompt vs. per-source collector subagents (favor keeping
  focused per-source collectors that read via MCP for quality).
- Whether the Node CLI ships as a separate bundled entry or a subcommand of the app binary
  (favor a separate small entry invoked as `node …/cli/index.js`).
- Drag reordering *within* a panel (nice-to-have; default off in v1 — order by `last_touched_at`).
