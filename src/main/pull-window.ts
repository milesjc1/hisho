const DAY = 86_400_000

/**
 * Resolve the pull cutoff (epoch ms) from the selected window mode.
 *   'since'            → the last successful pull time, or (first ever) now - firstRunDays.
 *   '1' / '7' / '30'   → a fixed N-day window back from now.
 *   anything unparseable / non-positive → the firstRunDays fallback.
 */
export function resolvePullSince(
  mode: string,
  lastPullAt: number | null,
  now: number,
  firstRunDays: number
): number {
  if (mode === 'since') return lastPullAt ?? now - firstRunDays * DAY
  const n = Number(mode)
  const days = Number.isFinite(n) && n > 0 ? n : firstRunDays
  return now - days * DAY
}
