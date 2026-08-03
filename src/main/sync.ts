import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'
import { ingest, dismissEntries, newCount, getSetting, setSetting, filterKnown } from './db'
import { collectAll, candidateToIngest, parseWatchChannels } from './collect'
import { filterIgnored } from './collect/ignore'
import { resolvePullSince } from './pull-window'
import { triage } from './triage'
import type { PullEvent } from '../shared/types'

let running = false

function emitPull(ev: PullEvent): void {
  emitToRenderer('pull:event', ev)
}
function line(text: string): void {
  emitPull({ type: 'line', text })
}

/**
 * Pull the plate: deterministic collectors hit every source in parallel, the
 * LLM triages the candidate pool (noise vs keep), and the app writes directly
 * to the DB. The LLM never touches the network or the DB. Dedup is automatic —
 * ingest() skips anything already stored (including resolved items).
 *
 * `mode` selects the window: 'since' (default — everything since the last successful
 * pull) or a fixed day count ('1'/'7'/'30'). The pull's start time is stamped as
 * `lastPullAt` only on success, so a failed pull never advances the cutoff.
 */
export async function runPull(
  mode: string,
  opts?: { background?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  if (running) return { ok: false, error: 'already running' }
  running = true
  emitPull({ type: 'start' })

  const startedAt = Date.now()
  try {
    // 1. Collect (deterministic, parallel, no LLM). Resolve the cutoff from the mode.
    const lastPullAt = Number(getSetting('lastPullAt')) || null
    const firstRunDays = Number(getSetting('scanDays')) || 7
    const since = resolvePullSince(mode, lastPullAt, startedAt, firstRunDays)
    line(`pulling since ${new Date(since).toLocaleString()}${mode === 'since' ? '' : ` (last ${mode}d)`}`)
    const channels = parseWatchChannels(getSetting('watchChannels') || '')
    if (channels.length) line(`watching ${channels.length} channel(s): ${channels.map((c) => `#${c}`).join(', ')}`)
    const { candidates, results } = await collectAll(since, channels)
    for (const r of results) {
      if (r.error) line(`${r.source}: ${r.candidates.length} found (note: ${r.error})`)
      else line(`${r.source}: ${r.candidates.length} found`)
    }
    line(`${candidates.length} candidates total`)

    // 1b. Deterministic ignore-list (user setting) — hard filter before the model.
    // Matched items skip triage entirely and land in Dismissed with reason 'ignore rule'.
    const { kept, ignored } = filterIgnored(candidates, getSetting('ignoreList') || '')
    if (ignored.length) line(`${ignored.length} ignored by your rules`)

    // 1c. Drop anything already on the plate BEFORE triage — no point paying the LLM to
    // re-classify items ingest() would dedup away anyway. Matches on the normalized key,
    // so a re-pull of already-seen (incl. dismissed) items skips the model entirely.
    const { fresh, known } = filterKnown(kept)
    if (known.length) line(`${known.length} already on your plate, skipping triage`)

    // 2. Triage (LLM's only job — pure classification). This is the slow step —
    // log before and after so the pull log isn't silent while the model thinks.
    // The user's natural-language rules (setting) are appended to the prompt.
    const model = getSetting('scanModel') || 'sonnet'
    const userRules = getSetting('triageRules') || ''
    line(`triaging ${fresh.length} with ${model}…`)
    const { keep, dismiss } = await triage(fresh, model, userRules)
    line(`triage: ${keep.length} kept, ${dismiss.length} flagged as noise`)

    // 3. Write (app writes; dedup handled by ingest()).
    line('writing to your plate…')
    const inserted = ingest(keep.map(candidateToIngest))
    const skipped = keep.length - inserted // already in the DB from a prior pull
    if (skipped > 0) line(`${skipped} already on your plate, skipped`)
    // Record ignore-list matches as Dismissed: ingest so the row exists, then dismiss.
    if (ignored.length) {
      ingest(ignored.map(candidateToIngest))
      dismissEntries(ignored.map((c) => ({ source: c.source, external_id: c.external_id, reason: 'ignore rule' })))
    }
    const dismissed = dismiss.length ? dismissEntries(dismiss) : 0
    line(`${inserted} new on your plate, ${dismissed} auto-dismissed`)

    // Advance the incremental cutoff — start time, so nothing that arrived mid-pull is missed.
    setSetting('lastPullAt', String(startedAt))

    setBadgeCount(newCount())
    emitToRenderer('items:changed')
    emitPull({ type: 'end', code: 0 })

    if (inserted > 0) {
      notify(`${inserted} on your plate`, 'Hisho pulled new items.')
      if (!opts?.background) showAndFocus() // background (auto-pull) never steals focus
    }
    return { ok: true }
  } catch (e) {
    const error = (e as Error).message
    line(`[error] ${error}`)
    emitPull({ type: 'end', code: 1, error })
    return { ok: false, error }
  } finally {
    running = false
  }
}
