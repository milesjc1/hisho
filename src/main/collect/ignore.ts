import type { Candidate } from './types'

export interface IgnoreRules {
  /** Channel names (leading # stripped, lowercased) — matched against candidate kind. */
  channels: string[]
  /** Sender fragments (leading @ stripped, lowercased) — substring-matched on author/sender. */
  senders: string[]
  /** Plain keywords (lowercased) — substring-matched across title/snippet/body. */
  keywords: string[]
}

/**
 * Parse the user's ignore-list text (one entry per line). Prefixes:
 *   #name → channel, @name → sender, otherwise → keyword.
 * Blank lines are dropped; everything is lowercased for case-insensitive matching.
 */
export function parseIgnoreRules(text: string): IgnoreRules {
  const rules: IgnoreRules = { channels: [], senders: [], keywords: [] }
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim().toLowerCase()
    if (!line) continue
    if (line.startsWith('#')) rules.channels.push(line.slice(1).trim())
    else if (line.startsWith('@')) rules.senders.push(line.slice(1).trim())
    else rules.keywords.push(line)
  }
  return rules
}

/** True when a candidate matches any ignore rule (channel / sender / keyword). */
export function matchesIgnore(c: Candidate, r: IgnoreRules): boolean {
  const kind = (c.kind ?? '').replace(/^#/, '').trim().toLowerCase()
  if (kind && r.channels.includes(kind)) return true

  const sender = (c.author ?? c.sender ?? '').toLowerCase()
  if (sender && r.senders.some((s) => sender.includes(s))) return true

  const hay = [c.title, c.snippet, c.body].filter(Boolean).join(' ').toLowerCase()
  if (hay && r.keywords.some((k) => hay.includes(k))) return true

  return false
}

/**
 * Split candidates into kept vs ignored by the user's ignore-list text. When the
 * list is empty the original array is returned by reference (fast path — no work).
 */
export function filterIgnored(
  candidates: Candidate[],
  text: string
): { kept: Candidate[]; ignored: Candidate[] } {
  const r = parseIgnoreRules(text)
  if (!r.channels.length && !r.senders.length && !r.keywords.length) {
    return { kept: candidates, ignored: [] }
  }
  const kept: Candidate[] = []
  const ignored: Candidate[] = []
  for (const c of candidates) (matchesIgnore(c, r) ? ignored : kept).push(c)
  return { kept, ignored }
}
