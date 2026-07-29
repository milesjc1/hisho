import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'
import { ingest, dismissEntries, newCount, getSetting } from './db'
import { collectAll, candidateToIngest } from './collect'
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
 */
export async function runPull(days: number): Promise<{ ok: boolean; error?: string }> {
  if (running) return { ok: false, error: 'already running' }
  running = true
  emitPull({ type: 'start' })

  try {
    // 1. Collect (deterministic, parallel, no LLM).
    const { candidates, results } = await collectAll(days)
    for (const r of results) {
      if (r.error) line(`${r.source}: ${r.candidates.length} found (note: ${r.error})`)
      else line(`${r.source}: ${r.candidates.length} found`)
    }
    line(`${candidates.length} candidates total`)

    // 2. Triage (LLM's only job — pure classification).
    const model = getSetting('scanModel') || 'sonnet'
    const { keep, dismiss } = await triage(candidates, model)

    // 3. Write (app writes; dedup handled by ingest()).
    const inserted = ingest(keep.map(candidateToIngest))
    const dismissed = dismiss.length ? dismissEntries(dismiss) : 0
    line(`${inserted} new on your plate, ${dismissed} auto-dismissed`)

    setBadgeCount(newCount())
    emitToRenderer('items:changed')
    emitPull({ type: 'end', code: 0 })

    if (inserted > 0) {
      notify(`${inserted} on your plate`, 'Hisho pulled new items.')
      showAndFocus()
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
