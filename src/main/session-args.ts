import type { Item } from '../shared/types'

/** Short label for the Claude session (`-n`), e.g. "ian.beal · #planning". */
export function sessionName(item: Item): string {
  const who = item.sender ?? item.source
  const where = item.kind ? ` · ${item.kind}` : ''
  return `${who}${where}`.slice(0, 60)
}

/** Single-line context blurb injected via `--append-system-prompt` so Claude knows
 * the item but waits for the user (no auto-sent message). Newlines collapsed so it
 * passes cleanly as one CLI / batch-file argument. */
export function buildContext(item: Item): string {
  const parts = [
    "This session is about an item on the user's Hisho plate. They may ask you to draft a reply, write a report, fix a bug, or investigate — wait for their instruction before acting.",
    `Source: ${item.source}${item.kind ? ` (${item.kind})` : ''}`,
    item.sender ? `From: ${item.sender}` : '',
    `Title: ${item.title}`,
    item.deep_link ? `Link: ${item.deep_link}` : '',
    (item.body ?? item.snippet) ? `Message: ${item.body ?? item.snippet}` : ''
  ].filter(Boolean)
  return parts.join(' | ').replace(/\s+/g, ' ').trim()
}

/** Argv for `claude`: open interactively (no user message) with the item context
 * appended to the system prompt. Resume re-injects it (system prompt is per-run).
 * spawn/batch take these as an argv array. */
export function buildSessionArgs(o: {
  sessionId: string
  name: string
  context: string
  resume: boolean
}): string[] {
  return o.resume
    ? ['--resume', o.sessionId, '--append-system-prompt', o.context]
    : ['--session-id', o.sessionId, '-n', o.name, '--append-system-prompt', o.context]
}
