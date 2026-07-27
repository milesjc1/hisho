import { notify } from './notify'
import { emitToRenderer } from './window'
import { staleResponded, getSetting } from './db'

let timer: ReturnType<typeof setInterval> | null = null
const TICK_MS = 30 * 60_000

export function startStale(): void {
  const tick = (): void => {
    const days = Number(getSetting('staleDays')) || 3
    const stale = staleResponded(days)
    if (stale.length > 0) {
      notify(`${stale.length} awaiting follow-up`, 'Responded items went stale.')
      emitToRenderer('items:changed')
    }
  }
  if (!timer) {
    timer = setInterval(tick, TICK_MS)
    tick()
  }
}

export function stopStale(): void {
  if (timer) clearInterval(timer)
  timer = null
}
