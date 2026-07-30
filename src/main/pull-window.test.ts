import { it, expect } from 'vitest'
import { resolvePullSince } from './pull-window'

const DAY = 86_400_000
const now = Date.parse('2026-07-30T12:00:00.000Z')

it("mode 'since' returns the stored lastPullAt", () => {
  const last = now - 3 * 60 * 60 * 1000 // 3h ago
  expect(resolvePullSince('since', last, now, 7)).toBe(last)
})

it("mode 'since' with no lastPullAt falls back to now - firstRunDays", () => {
  expect(resolvePullSince('since', null, now, 7)).toBe(now - 7 * DAY)
})

it('numeric mode uses a fixed N-day window regardless of lastPullAt', () => {
  expect(resolvePullSince('1', now - 5 * DAY, now, 7)).toBe(now - 1 * DAY)
  expect(resolvePullSince('30', null, now, 7)).toBe(now - 30 * DAY)
})

it('garbage mode falls back to the firstRunDays window', () => {
  expect(resolvePullSince('nonsense', null, now, 7)).toBe(now - 7 * DAY)
  expect(resolvePullSince('0', null, now, 7)).toBe(now - 7 * DAY)
})
