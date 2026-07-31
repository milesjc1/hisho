import type { IngestItem } from '../../shared/types'
import type { Candidate, SourceResult } from './types'
import { loadSecrets } from './secrets'
import { collectSlack } from './slack'

export type { Candidate, SourceResult } from './types'
export { parseWatchChannels } from './slack'

/** Candidate → the row shape ingest() expects (author → sender; drop triage-only fields). */
export function candidateToIngest(c: Candidate): IngestItem {
  return {
    source: c.source,
    external_id: c.external_id,
    kind: c.kind ?? null,
    title: c.title,
    sender: c.author ?? c.sender ?? null,
    snippet: c.snippet ?? null,
    body: c.body ?? null,
    deep_link: c.deep_link ?? null,
    app_link: c.app_link ?? null,
    source_ts: c.source_ts ?? null
  }
}

export interface CollectResult {
  candidates: Candidate[]
  /** Per-source status for the pull log / summary. */
  results: SourceResult[]
}

/**
 * Collect the Slack candidate pool. Deterministic — no LLM. A missing token or
 * a dead source is reported as an error rather than throwing. Other sources
 * (Teams/Outlook/GitHub/Linear) reach the feed via the plate-write CLI, not
 * this in-app pull.
 */
export async function collectAll(sinceMs: number, channels: string[] = []): Promise<CollectResult> {
  const s = loadSecrets()

  const result = s.slackUserToken
    ? await wrap('slack', () => collectSlack(sinceMs, s.slackUserToken!, channels))
    : { source: 'slack' as const, candidates: [], error: 'no slackUserToken' }

  return { candidates: result.candidates, results: [result] }
}

async function wrap(source: SourceResult['source'], fn: () => Promise<Candidate[]>): Promise<SourceResult> {
  try {
    return { source, candidates: await fn() }
  } catch (e) {
    return { source, candidates: [], error: (e as Error).message }
  }
}
