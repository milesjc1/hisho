import { runClaude } from './claude-runner'
import { notify } from './notify'
import { emitToRenderer, navigateTo, setBadgeCount } from './window'
import {
  upsertMessage,
  unreadMessageCount,
  getSetting,
  setSetting,
  getMessage
} from './db'
import type { Connection } from '../shared/types'

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

const DEFAULT_POLL_MINUTES = 10
const POLL_MS_OVERRIDE = Number(process.env.HISHO_POLL_MS) || 0

function pollMs(): number {
  const raw = Number(getSetting('pollIntervalMinutes'))
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POLL_MINUTES
  return minutes * 60_000
}

/** Which connection a message source is reached through. */
export function connectionForSource(source: string): Connection {
  return source === 'slack' ? 'slack' : 'microsoft365'
}

// ---------- lifecycle ----------

export function startAggregator(): void {
  const interval = POLL_MS_OVERRIDE || pollMs()
  if (!pollTimer) pollTimer = setInterval(() => void poll(), interval)
  void poll()
}

export function stopAggregator(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

// ---------- polling ----------

function extractJsonArray(text: string): unknown[] {
  // Strip code fences, then grab the outermost [ ... ].
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

export async function poll(): Promise<{ found: number; new: number }> {
  if (polling) return { found: 0, new: 0 }
  polling = true
  try {
    const lastTs = Number(getSetting('lastPollTs')) || Date.now() - 24 * 60 * 60_000
    const sinceIso = new Date(lastTs).toISOString()

    const prompt = `Check for messages that need MY response since ${sinceIso}. Look across:
- Slack: direct messages and mentions of me
- Microsoft Teams: chats needing a reply
- Outlook: emails addressed to me awaiting a response

Return ONLY a JSON array (no prose). Each item:
{"source":"slack"|"teams"|"outlook","id":"stable unique id","sender":"name","snippet":"<=140 char summary","url":"link or null"}
Return [] if nothing needs a reply. Do not send or modify anything.`

    const result = await runClaude({
      prompt,
      model: 'haiku',
      connections: ['slack', 'microsoft365']
    })

    if (!result.ok) return { found: 0, new: 0 }

    const items = extractJsonArray(result.text)
    let created = 0
    for (const raw of items) {
      const m = raw as Record<string, unknown>
      if (!m || typeof m.id !== 'string' || typeof m.source !== 'string') continue
      const isNew = upsertMessage({
        source: String(m.source),
        ext_id: String(m.id),
        sender: String(m.sender ?? ''),
        snippet: String(m.snippet ?? ''),
        url: m.url ? String(m.url) : null,
        ts: Date.now()
      })
      if (isNew) created++
    }

    setSetting('lastPollTs', String(Date.now()))
    setBadgeCount(unreadMessageCount())
    emitToRenderer('message:changed')

    if (created > 0) {
      notify(
        `${created} new message${created > 1 ? 's' : ''} to respond to`,
        'Open Hisho to review and draft replies.',
        () => navigateTo('inbox')
      )
    }

    return { found: items.length, new: created }
  } finally {
    polling = false
  }
}

// ---------- draft a reply ----------

export async function draftReply(messageId: number): Promise<string> {
  const m = getMessage(messageId)
  if (!m) return 'Message not found.'
  const result = await runClaude({
    prompt: `Draft a reply to this ${m.source} message from ${m.sender}:

"${m.snippet}"

Write only the reply text — professional, concise, in my voice. Do NOT send it.`,
    model: 'sonnet',
    connections: [connectionForSource(m.source)]
  })
  return result.ok ? result.text : `Draft failed: ${result.error ?? 'unknown'}`
}
