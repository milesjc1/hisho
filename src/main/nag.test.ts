import { it, expect } from 'vitest'
import { isWorkHours } from './nag'
it('true inside window, false outside', () => {
  expect(isWorkHours(new Date('2026-07-27T10:00:00'), 9, 18)).toBe(true)
  expect(isWorkHours(new Date('2026-07-27T20:00:00'), 9, 18)).toBe(false)
})
