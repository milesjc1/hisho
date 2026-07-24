import { dueBackburner, resurface, untriagedCount } from './db'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'

let timer: ReturnType<typeof setInterval> | null = null

const DEFAULT_TICK_MS = 30_000
const TICK_MS = Number(process.env.HISHO_BACKBURNER_MS) || DEFAULT_TICK_MS

export function startBackburner(): void {
  if (!timer) timer = setInterval(() => tick(), TICK_MS)
  tick()
}

export function stopBackburner(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** Return any parked items whose resurface time has arrived back to the feed. */
export function tick(): void {
  const due = dueBackburner(Date.now())
  if (due.length === 0) return

  for (const it of due) resurface(it.id)

  setBadgeCount(untriagedCount())
  emitToRenderer('items:changed')
  notify(
    `${due.length} item${due.length > 1 ? 's' : ''} back on your plate`,
    'A backburnered item just resurfaced.'
  )
  showAndFocus()
}
