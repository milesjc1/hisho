import { runClaude } from './claude-runner'
import { notify } from './notify'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { upsertSyncedItem, untriagedCount, getSetting, setSetting } from './db'
import type { ItemSource, Priority, SyncSummary, SyncedItem } from '../shared/types'

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

const DEFAULT_POLL_MINUTES = 10
const POLL_MS_OVERRIDE = Number(process.env.HISHO_POLL_MS) || 0

const VALID_SOURCES: ItemSource[] = [
  'slack',
  'teams',
  'outlook',
  'sharepoint',
  'github',
  'linear'
]
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

// ---------- scan ----------

/** Grab the outermost { ... } object from a possibly-fenced LLM reply. */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const SYNC_PROMPT = (sinceIso: string): string =>
  `Scan my connected accounts for anything that NEEDS MY ATTENTION since ${sinceIso}. Look across:
- Slack: direct messages and mentions of me
- Microsoft Teams: chats needing a reply
- Outlook: emails addressed to me awaiting a response
- Linear: issues assigned to me, mentions, and review requests

Surface an item when there is NO defined resolution yet. That includes BOTH:
1. Messages/comments/emails/issues I have NOT responded to, AND
2. Threads where someone replied but the matter is still UNRESOLVED (a question left open, a decision not made, an action still owed).

Do NOT surface things that are already resolved, purely informational, or where no action is owed by me.

Return ONLY a JSON object (no prose), shaped exactly:
{
  "items": [
    {
      "source": "slack"|"teams"|"outlook"|"sharepoint"|"github"|"linear",
      "ext_id": "stable unique id for this thread/item",
      "title": "one-line description of what is needed",
      "sender": "person who is waiting on me, or null",
      "deep_link": "direct URL to the thread/email/issue, or null",
      "suggested_priority": "high"|"med"|"low",
      "suggested_resolution": "one short sentence on the next step I should take"
    }
  ],
  "summary": {
    "perSource": { "slack": {"surfaced": 0, "ignored": 0}, "teams": {"surfaced": 0, "ignored": 0} }
  }
}
Use a stable ext_id so re-scans do not duplicate. Return an empty items array if nothing needs me. Do not send, modify, or resolve anything.`

export async function runSync(): Promise<{ found: number; new: number }> {
  if (polling) return { found: 0, new: 0 }
  polling = true
  try {
    const lastTs = Number(getSetting('lastSyncTs')) || Date.now() - 24 * 60 * 60_000
    const sinceIso = new Date(lastTs).toISOString()

    const result = await runClaude({
      prompt: SYNC_PROMPT(sinceIso),
      model: (getSetting('syncModel') as 'haiku' | 'sonnet' | 'opus') || 'haiku',
      connections: ['slack', 'microsoft365', 'linear']
    })
    if (!result.ok) return { found: 0, new: 0 }

    const obj = extractJsonObject(result.text)
    const rawItems = Array.isArray(obj?.items) ? (obj!.items as unknown[]) : []

    let created = 0
    for (const raw of rawItems) {
      const m = raw as Record<string, unknown>
      if (!m || typeof m.ext_id !== 'string' || typeof m.source !== 'string') continue
      const source = VALID_SOURCES.includes(m.source as ItemSource)
        ? (m.source as ItemSource)
        : null
      if (!source || typeof m.title !== 'string' || !m.title.trim()) continue

      const sp = VALID_PRIORITIES.includes(m.suggested_priority as Priority)
        ? (m.suggested_priority as Priority)
        : null

      const item: SyncedItem = {
        source,
        ext_id: String(m.ext_id),
        title: String(m.title),
        sender: m.sender ? String(m.sender) : null,
        deep_link: m.deep_link ? String(m.deep_link) : null,
        suggested_priority: sp,
        suggested_resolution: m.suggested_resolution ? String(m.suggested_resolution) : null,
        ts: Date.now()
      }
      if (upsertSyncedItem(item)) created++
    }

    // Persist an ignored/surfaced summary for the UI.
    const perSource =
      obj?.summary && typeof obj.summary === 'object'
        ? ((obj.summary as Record<string, unknown>).perSource as
            | Record<string, { surfaced: number; ignored: number }>
            | undefined) ?? {}
        : {}
    const ignored = Object.values(perSource).reduce((n, s) => n + (Number(s?.ignored) || 0), 0)
    const summary: SyncSummary = {
      at: Date.now(),
      found: rawItems.length,
      surfaced: created,
      ignored,
      perSource
    }
    setSetting('lastSyncSummary', JSON.stringify(summary))
    setSetting('lastSyncTs', String(Date.now()))

    setBadgeCount(untriagedCount())
    emitToRenderer('items:changed')

    if (created > 0) {
      notify(
        `${created} new item${created > 1 ? 's' : ''} to triage`,
        'Hisho pulled in things that need your attention.'
      )
      showAndFocus()
    }

    return { found: rawItems.length, new: created }
  } finally {
    polling = false
  }
}
