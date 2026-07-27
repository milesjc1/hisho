import parser from 'cron-parser'
import { listRules, spawnRecurringItem, markRuleSpawned, newCount } from './db'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'

let timer: ReturnType<typeof setInterval> | null = null

const DEFAULT_TICK_MS = 5 * 60_000
const TICK_MS = Number(process.env.HISHO_RECUR_MS) || DEFAULT_TICK_MS

export function startRecurring(): void {
  if (!timer) timer = setInterval(() => tick(), TICK_MS)
  tick()
}

export function stopRecurring(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** Spawn a feed item for any rule whose next occurrence is inside its lead window. */
export function tick(): void {
  const now = Date.now()
  let spawned = 0

  for (const rule of listRules()) {
    let dueTs: number
    try {
      dueTs = parser.parseExpression(rule.cron, { currentDate: new Date(now) }).next().getTime()
    } catch {
      continue // invalid cron; skip
    }

    const leadMs = rule.lead_days * 24 * 60 * 60_000
    if (dueTs - now > leadMs) continue // not yet inside the lead window

    // ext_id is unique per occurrence, so this is a no-op if already spawned.
    if (spawnRecurringItem(rule, dueTs)) {
      markRuleSpawned(rule.id, now)
      spawned++
    }
  }

  if (spawned > 0) {
    setBadgeCount(newCount())
    emitToRenderer('items:changed')
    notify(
      `${spawned} recurring task${spawned > 1 ? 's' : ''} due soon`,
      'Hisho added them to your feed.'
    )
    showAndFocus()
  }
}
