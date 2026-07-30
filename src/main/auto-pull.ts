import { powerMonitor } from 'electron'
import { getSetting } from './db'
import { runPull } from './sync'

const MIN = 60_000
const DEFAULT_MIN = 30

let timer: ReturnType<typeof setInterval> | null = null

/**
 * Interval (ms) for the auto-pull timer, or null when disabled.
 *   enabled !== 'on' → null. Otherwise minutes × 60_000, falling back to 30 min
 *   for unparseable / non-positive values.
 */
export function resolveAutoPullMs(enabled: string, minutes: string): number | null {
  if (enabled !== 'on') return null
  const n = Number(minutes)
  return (Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN) * MIN
}

/** Current interval from settings, honoring a test/dev override. */
function currentMs(): number | null {
  const ms = resolveAutoPullMs(getSetting('autoPull') ?? 'off', getSetting('autoPullMinutes') ?? '')
  if (ms == null) return null
  const override = Number(process.env.HISHO_AUTOPULL_MS)
  return Number.isFinite(override) && override > 0 ? override : ms
}

/** Arm the interval (background pulls) if auto-pull is enabled. No-op if already armed or off. */
export function startAutoPull(): void {
  if (timer) return
  const ms = currentMs()
  if (ms == null) return
  timer = setInterval(() => void runPull('since', { background: true }), ms)
}

export function stopAutoPull(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** Re-arm from the latest settings (call after a setting change). */
export function rescheduleAutoPull(): void {
  stopAutoPull()
  startAutoPull()
}

/**
 * Wire the timer + power events. Sleep stops the timer; wake does a catch-up pull
 * then re-arms — so the timer is only ever live while the computer is on.
 */
export function initAutoPull(): void {
  powerMonitor.on('suspend', () => stopAutoPull())
  powerMonitor.on('resume', () => {
    if (currentMs() != null) void runPull('since', { background: true })
    startAutoPull()
  })
  startAutoPull()
}
