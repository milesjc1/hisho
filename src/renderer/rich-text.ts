import { emojify } from 'node-emoji'

export type SegmentType = 'text' | 'b' | 'i' | 'code' | 's'
export interface Segment {
  t: SegmentType
  v: string
}

/**
 * Normalize raw message text before segment parsing:
 *  - emoji shortcodes (`:tada:`) → unicode (unknown/custom left as-is).
 *  - Slack link syntax: `<url|label>` → label, `<url>` → url.
 */
export function prepareText(raw: string): string {
  let s = raw ?? ''
  s = s.replace(/<([^>|]+)\|([^>]+)>/g, '$2') // <url|label> → label
  s = s.replace(/<((?:https?|mailto):[^>]+)>/g, '$1') // <url> → url
  return emojify(s)
}

// Inline markers, tried in priority order (bold before italic so ** wins over *).
const MARKERS: { t: SegmentType; re: RegExp }[] = [
  { t: 'b', re: /^\*\*([^*]+)\*\*/ },
  { t: 'i', re: /^\*([^*]+)\*/ },
  { t: 'i', re: /^_([^_]+)_/ },
  { t: 'code', re: /^`([^`]+)`/ },
  { t: 's', re: /^~([^~]+)~/ }
]

/**
 * Split text into styled segments. A very small mrkdwn/markdown subset:
 * `**bold**`, `*italic*` / `_italic_`, `` `code` ``, `~strike~`. Markers inside a
 * match are not re-parsed (flat, good enough for message previews).
 */
export function parseRichSegments(text: string): Segment[] {
  const out: Segment[] = []
  let buf = ''
  let i = 0
  const flush = (): void => {
    if (buf) {
      out.push({ t: 'text', v: buf })
      buf = ''
    }
  }
  while (i < text.length) {
    const rest = text.slice(i)
    let hit: { t: SegmentType; v: string; len: number } | null = null
    for (const m of MARKERS) {
      const match = m.re.exec(rest)
      if (match) {
        hit = { t: m.t, v: match[1], len: match[0].length }
        break
      }
    }
    if (hit) {
      flush()
      out.push({ t: hit.t, v: hit.v })
      i += hit.len
    } else {
      buf += text[i]
      i++
    }
  }
  flush()
  return out
}
