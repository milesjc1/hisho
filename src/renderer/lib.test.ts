import { it, expect } from 'vitest'
import { formatItemTime } from './lib'

it('formatItemTime returns null for missing/invalid input', () => {
  expect(formatItemTime(null)).toBeNull()
  expect(formatItemTime('')).toBeNull()
  expect(formatItemTime('not-a-date')).toBeNull()
})

it('formatItemTime renders a human date + time for a valid ISO string', () => {
  const out = formatItemTime('2026-07-29T14:14:00.000Z')
  expect(out).not.toBeNull()
  // Has a clock time (h:mm) and a comma separating date from time.
  expect(out).toMatch(/\d{1,2}:\d{2}/)
  expect(out).toContain(',')
})
