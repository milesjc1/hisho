import type { Item } from '../shared/types'

/** Short label for the Claude session (`-n`), e.g. "ian.beal · #planning". */
export function sessionName(item: Item): string {
  const who = item.sender ?? item.source
  const where = item.kind ? ` · ${item.kind}` : ''
  return `${who}${where}`.slice(0, 60)
}

/** Single-line seed prompt: an instruction plus the item's context. Newlines are
 * collapsed so it passes cleanly as one CLI argument / batch-file argument. */
export function buildSeed(item: Item): string {
  const parts = [
    'I need help handling an item from my Hisho plate — draft a reply, write a report, fix a bug, investigate, whatever fits.',
    `Source: ${item.source}${item.kind ? ` (${item.kind})` : ''}`,
    item.sender ? `From: ${item.sender}` : '',
    `Title: ${item.title}`,
    item.deep_link ? `Link: ${item.deep_link}` : '',
    (item.body ?? item.snippet) ? `Message: ${item.body ?? item.snippet}` : ''
  ].filter(Boolean)
  return parts.join(' | ').replace(/\s+/g, ' ').trim()
}

/** Argv for `claude`: resume an existing session, or start a fixed-id one with a
 * display name and the seed prompt. node-pty/spawn take an argv array (no escaping). */
export function buildSessionArgs(o: {
  sessionId: string
  name: string
  seed: string
  resume: boolean
}): string[] {
  return o.resume
    ? ['--resume', o.sessionId]
    : ['--session-id', o.sessionId, '-n', o.name, o.seed]
}
