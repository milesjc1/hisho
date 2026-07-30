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

interface SlackChannel {
  id?: string
  name?: string
  is_im?: boolean
  is_mpim?: boolean
  is_channel?: boolean
  is_group?: boolean
}

interface SlackMatch {
  user?: string
  username?: string
  ts: string
  text?: string
  permalink?: string
  channel?: SlackChannel
  blocks?: any[]
  attachments?: any[]
}

/** Item title: who the message is from. `username` is the display handle (human
 * or app, e.g. "kris.johnson", "linear"); fall back to the raw user id. */
export function slackTitle(match: Pick<SlackMatch, 'username' | 'user'>): string {
  return `Message from ${match.username ?? match.user ?? 'someone'}`
}

/** Native deep link that opens the Slack desktop app straight to the exact
 * message. The `team` id is required for the client to route to the right
 * workspace — without it Slack just opens generically (the old bug). `message`
 * is the message ts (with the dot). */
export function slackAppLink(teamId: string | undefined, channelId: string, ts: string): string {
  const team = teamId ? `team=${teamId}&` : ''
  return `slack://channel?${team}id=${channelId}&message=${ts}`
}

/** Human-readable "where from" descriptor shown after the Slack tag. DMs report
 * the other party's user id as `channel.name`, so never surface that as `#name`. */
export function slackDescriptor(channel?: SlackChannel): string {
  if (!channel) return 'DM'
  if (channel.is_im) return 'DM'
  if (channel.is_mpim) return 'Group chat'
  return channel.name ? `#${channel.name}` : 'Channel'
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
  const me = (await slack('auth.test', token, {})) as { user_id: string; team_id?: string }
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
    const descriptor = slackDescriptor(m.channel)
    out.push({
      source: 'slack',
      external_id: extId,
      kind: descriptor,
      title: slackTitle(m),
      author: m.username ?? m.user,
      snippet: text ? text.slice(0, 200) : descriptor,
      body: text || undefined,
      deep_link: m.permalink,
      app_link: slackAppLink(me.team_id, chId, m.ts),
      source_ts: new Date(Number(m.ts) * 1000).toISOString()
    })
  }
  return out
}
