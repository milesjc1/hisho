import { runClaude } from './claude-runner'
import { notify } from './notify'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import {
  insertScanned,
  listScanned,
  classifyItem,
  untriagedCount,
  ignoredCount,
  getSetting,
  setSetting
} from './db'
import type { Item, ItemSource, Priority, ScannedItem, SyncSummary } from '../shared/types'

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

const DEFAULT_POLL_MINUTES = 10
const POLL_MS_OVERRIDE = Number(process.env.HISHO_POLL_MS) || 0

const VALID_SOURCES: ItemSource[] = ['slack', 'teams', 'outlook', 'sharepoint', 'github', 'linear']
const VALID_PRIORITIES: Priority[] = ['high', 'med', 'low']

function pollMs(): number {
  const raw = Number(getSetting('pollIntervalMinutes'))
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_MINUTES
  return minutes * 60_000
}

// ---------- lifecycle ----------

export function startSync(): void {
  const interval = POLL_MS_OVERRIDE || pollMs()
  if (!pollTimer) pollTimer = setInterval(() => void runSync(), interval)
  void runSync()
}

export function stopSync(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

export function lastSummary(): SyncSummary | null {
  const raw = getSetting('lastSyncSummary')
  if (!raw) return null
  try {
    return JSON.parse(raw) as SyncSummary
  } catch {
    return null
  }
}

// ---------- json helpers ----------

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ---------- stage 1: fetch ----------

const FETCH_PROMPT = (sinceIso: string): string =>
  `List EVERYTHING that has arrived for me since ${sinceIso} across my connected accounts:
- Slack: direct messages and mentions of me
- Microsoft Teams: chats
- Outlook: emails addressed to me
- Linear: issues assigned to me, mentions, and review requests

Do NOT judge importance and do NOT decide what matters — just enumerate. Return ONE entry per
distinct thread / message / email / issue. NEVER group or summarize multiple things into one
entry (no "3 tickets" roll-ups).

Return ONLY a JSON array (no prose). Each element:
{
  "source": "slack"|"teams"|"outlook"|"sharepoint"|"github"|"linear",
  "ext_id": "stable unique id for this thread/item",
  "title": "one-line description",
  "sender": "person, or null",
  "snippet": "<=200 char preview; note if the latest message is from ME or from them",
  "deep_link": "direct URL, or null"
}
Return [] if nothing is new. Do not send, modify, or resolve anything.`

async function fetchStage(sinceIso: string): Promise<number> {
  const result = await runClaude({
    prompt: FETCH_PROMPT(sinceIso),
    model: (getSetting('syncModel') as 'haiku' | 'sonnet' | 'opus') || 'haiku',
    connections: ['slack', 'microsoft365', 'linear']
  })
  if (!result.ok) return 0

  let inserted = 0
  for (const raw of extractJsonArray(result.text)) {
    const m = raw as Record<string, unknown>
    if (!m || typeof m.ext_id !== 'string' || typeof m.source !== 'string') continue
    const source = VALID_SOURCES.includes(m.source as ItemSource) ? (m.source as ItemSource) : null
    if (!source || typeof m.title !== 'string' || !m.title.trim()) continue
    const item: ScannedItem = {
      source,
      ext_id: String(m.ext_id),
      title: String(m.title),
      sender: m.sender ? String(m.sender) : null,
      snippet: m.snippet ? String(m.snippet) : null,
      deep_link: m.deep_link ? String(m.deep_link) : null
    }
    if (insertScanned(item) != null) inserted++
  }
  return inserted
}

// ---------- stage 2: classify (text-only, no MCP) ----------

const CLASSIFY_PROMPT = (rows: Item[]): string => {
  const list = rows.map((r) => ({
    ext_id: r.ext_id,
    source: r.source,
    sender: r.sender,
    title: r.title,
    snippet: r.snippet
  }))
  return `You are triaging my inbox. For EACH item below decide whether it needs MY attention.

SURFACE it if there is no resolution yet: I have not responded, OR someone replied but the
matter is still open (a question unanswered, a decision not made, an action still owed by me).
IGNORE it if it is already resolved, purely informational/automated, a notification, or nothing
is owed by me.

Items (JSON):
${JSON.stringify(list, null, 2)}

Return ONLY a JSON array, one element per item, no prose:
{
  "ext_id": "<matches input>",
  "verdict": "surface"|"ignore",
  "priority": "high"|"med"|"low",      // best guess when surfacing; else "low"
  "suggested_resolution": "one short sentence on the next step",  // when surfacing
  "reason": "short reason it was ignored"                          // when ignoring
}`
}

async function classifyStage(): Promise<{ surfaced: number; ignored: number }> {
  const rows = listScanned()
  if (rows.length === 0) return { surfaced: 0, ignored: 0 }

  const byExtId = new Map(rows.map((r) => [r.ext_id, r]))
  const result = await runClaude({
    prompt: CLASSIFY_PROMPT(rows),
    model: 'haiku',
    connections: [] // pure reasoning over provided text — no tools needed
  })

  let surfaced = 0
  let ignored = 0
  if (result.ok) {
    for (const raw of extractJsonArray(result.text)) {
      const v = raw as Record<string, unknown>
      const row = typeof v.ext_id === 'string' ? byExtId.get(v.ext_id) : undefined
      if (!row) continue
      const verdict = v.verdict === 'surface' ? 'surface' : 'ignore'
      const priority = VALID_PRIORITIES.includes(v.priority as Priority)
        ? (v.priority as Priority)
        : null
      if (verdict === 'surface') {
        classifyItem(row.id, 'surface', priority, v.suggested_resolution ? String(v.suggested_resolution) : null, null)
        surfaced++
      } else {
        classifyItem(row.id, 'ignore', null, null, v.reason ? String(v.reason) : null)
        ignored++
      }
      byExtId.delete(row.ext_id)
    }
  }

  // Anything the model failed to label: default to ignore so it doesn't get stuck as 'scanned'.
  for (const row of byExtId.values()) {
    classifyItem(row.id, 'ignore', null, null, 'Unclassified by scan')
    ignored++
  }

  return { surfaced, ignored }
}

// ---------- orchestration ----------

export async function runSync(): Promise<{ found: number; new: number }> {
  if (polling) return { found: 0, new: 0 }
  polling = true
  try {
    const lastTs = Number(getSetting('lastSyncTs')) || Date.now() - 24 * 60 * 60_000
    const sinceIso = new Date(lastTs).toISOString()

    const fetched = await fetchStage(sinceIso)
    const { surfaced, ignored } = await classifyStage()

    const summary: SyncSummary = {
      at: Date.now(),
      found: fetched,
      surfaced,
      ignored,
      perSource: {}
    }
    setSetting('lastSyncSummary', JSON.stringify(summary))
    setSetting('lastSyncTs', String(Date.now()))

    setBadgeCount(untriagedCount())
    emitToRenderer('items:changed')

    if (surfaced > 0) {
      notify(
        `${surfaced} new item${surfaced > 1 ? 's' : ''} to triage`,
        'Hisho pulled in things that need your attention.'
      )
      showAndFocus()
    }

    return { found: fetched, new: surfaced }
  } finally {
    polling = false
  }
}

/** Total items currently on the ignored shelf (drives the topbar summary). */
export function ignoredTotal(): number {
  return ignoredCount()
}
