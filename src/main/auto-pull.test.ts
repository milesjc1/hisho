import { it, expect } from 'vitest'
import { resolveAutoPullMs } from './auto-pull'

const MIN = 60_000

it('returns null when auto-pull is off', () => {
  expect(resolveAutoPullMs('off', '30')).toBeNull()
  expect(resolveAutoPullMs('', '30')).toBeNull()
})

it('returns the interval in ms when on', () => {
  expect(resolveAutoPullMs('on', '15')).toBe(15 * MIN)
  expect(resolveAutoPullMs('on', '30')).toBe(30 * MIN)
  expect(resolveAutoPullMs('on', '120')).toBe(120 * MIN)
  expect(resolveAutoPullMs('on', '180')).toBe(180 * MIN)
})

it('falls back to 30 min for invalid/non-positive minutes when on', () => {
  expect(resolveAutoPullMs('on', 'nonsense')).toBe(30 * MIN)
  expect(resolveAutoPullMs('on', '0')).toBe(30 * MIN)
  expect(resolveAutoPullMs('on', '')).toBe(30 * MIN)
})
