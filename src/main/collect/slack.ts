import type { Candidate } from './types'

const API = 'https://slack.com/api'

async function slack(method: string, token: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  })
  const json: any = await res.json()
  if (!json.ok) throw new Error(`Slack ${method}: ${json.error ?? 'unknown'}`)
  return json
}

interface SlackMatch {
  user?: string
  username?: string
  ts: string
  text?: string
  permalink?: string
  channel?: { id?: string; name?: string; is_im?: boolean }
  blocks?: any[]
  attachments?: any[]
}

/**
 * Readable text for a match. Bot DMs (Linear, microslack) leave `text` empty and
 * carry their content in Block Kit `blocks` (and sometimes `attachments`), so pull
 * from there when `text` is blank. Button labels in `actions` blocks are skipped —
 * they're chrome ("Open"), not content. Returns '' when nothing extractable; the
 * caller supplies a fallback label so the item still lands in the dump.
 */
export function blockText(match: SlackMatch): string {
  const top = (match.text ?? '').trim()
  if (top) return top

  const parts: string[] = []
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'actions') return // button labels are chrome, not content
    if (typeof node.text === 'string') parts.push(node.text)
    else if (node.text && typeof node.text.text === 'string') parts.push(node.text.text)
    if (Array.isArray(node.elements)) node.elements.forEach(walk)
  }
  for (const b of match.blocks ?? []) walk(b)

  for (const a of match.attachments ?? []) {
    for (const f of [a?.pretext, a?.text, a?.fallback]) {
      if (typeof f === 'string' && f.trim()) parts.push(f)
    }
  }

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Hard cap on pages fetched (100/page) so a busy window can't hang the pull. */
const MAX_PAGES = 20

/**
 * The full dump of messages directed at me in the window, via search.messages
 * (needs a user token, xoxp, search:read). `to:me` is a valid search modifier.
 * Everything to me is kept — human DMs and bot notifications (Linear, microslack)
 * alike; bot content is pulled out of Block Kit blocks by blockText(). Only my own
 * authored messages are dropped. All pages in the window are fetched.
 */
export async function collectSlack(days: number, token: string): Promise<Candidate[]> {
  const me = (await slack('auth.test', token, {})) as { user_id: string }
  const after = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) // YYYY-MM-DD

  const matches: SlackMatch[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const search = (await slack('search.messages', token, {
      query: `to:me after:${after}`,
      count: '100',
      page: String(page),
      sort: 'timestamp',
      sort_dir: 'desc'
    })) as { messages?: { matches?: SlackMatch[]; paging?: { pages?: number } } }

    matches.push(...(search.messages?.matches ?? []))
    if (page >= (search.messages?.paging?.pages ?? 1)) break
  }

  const out: Candidate[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    if (m.user === me.user_id) continue // my own message
    const chId = m.channel?.id ?? 'dm'
    const extId = `${chId}:${m.ts}`
    if (seen.has(extId)) continue
    seen.add(extId)
    const text = blockText(m)
    const label = m.channel?.name ? `#${m.channel.name}` : 'Slack DM'
    out.push({
      source: 'slack',
      external_id: extId,
      kind: m.channel?.is_im ? 'dm' : 'mention',
      title: label,
      author: m.username ?? m.user,
      snippet: text ? text.slice(0, 200) : (m.username ?? label),
      deep_link: m.permalink,
      app_link: `slack://channel?id=${chId}&message=${m.ts}`,
      source_ts: new Date(Number(m.ts) * 1000).toISOString()
    })
  }
  return out
}
