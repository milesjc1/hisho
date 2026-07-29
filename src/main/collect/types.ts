import type { IngestItem, ItemSource } from '../../shared/types'

/**
 * A normalized action-needed item produced by a collector, before triage.
 * Superset of IngestItem: adds recency + author context the LLM uses to rank,
 * which are dropped before the row is written.
 */
export interface Candidate extends IngestItem {
  /** ISO-8601 timestamp of the underlying message/PR/issue activity. */
  source_ts?: string
  /** Display name of the person who created/sent the item (→ IngestItem.sender). */
  author?: string
}

/** Outcome of one collector. Failures are isolated; one dead source never blocks the rest. */
export interface SourceResult {
  source: ItemSource
  candidates: Candidate[]
  error?: string
}

/** Credentials for the Slack collector. Loaded from env / credentials.json. */
export interface Secrets {
  slackUserToken?: string
}
