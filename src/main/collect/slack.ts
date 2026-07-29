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
}

/**
 * DMs and threads directed at me in the window, via search.messages (needs a
 * user token, xoxp, search:read). `to:me` is a valid search modifier. Messages
 * I authored are dropped — if the last word was mine, I've handled it.
 */
export async function collectSlack(days: number, token: string): Promise<Candidate[]> {
  const me = (await slack('auth.test', token, {})) as { user_id: string }
  const after = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) // YYYY-MM-DD

  const search = (await slack('search.messages', token, {
    query: `to:me after:${after}`,
    count: '30',
    sort: 'timestamp',
    sort_dir: 'desc'
  })) as { messages?: { matches?: SlackMatch[] } }

  const matches = search.messages?.matches ?? []
  const out: Candidate[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    if (m.user === me.user_id) continue // my own message
    const text = (m.text ?? '').trim()
    if (!text) continue // empty/bot-status noise
    const chId = m.channel?.id ?? 'dm'
    const extId = `${chId}:${m.ts}`
    if (seen.has(extId)) continue
    seen.add(extId)
    out.push({
      source: 'slack',
      external_id: extId,
      kind: m.channel?.is_im ? 'dm' : 'mention',
      title: m.channel?.name ? `#${m.channel.name}` : 'Slack DM',
      author: m.username ?? m.user,
      snippet: text.slice(0, 200),
      deep_link: m.permalink,
      app_link: `slack://channel?id=${chId}&message=${m.ts}`,
      source_ts: new Date(Number(m.ts) * 1000).toISOString()
    })
  }
  return out
}
