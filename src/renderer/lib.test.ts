import { it, expect } from 'vitest'
import { formatItemTime, expandableText, formatStamp } from './lib'

it('formatStamp renders a full local date-time for valid ms, null otherwise', () => {
  expect(formatStamp(null)).toBeNull()
  const out = formatStamp(Date.parse('2026-07-30T14:14:07.000Z'))
  expect(out).not.toBeNull()
  expect(out).toMatch(/\d{1,2}:\d{2}/) // has a clock time
})

it('expandableText shows snippet with no toggle when there is no fuller body', () => {
  expect(expandableText('hello', null, false)).toEqual({ text: 'hello', hasMore: false })
  expect(expandableText('hello', 'hello', false)).toEqual({ text: 'hello', hasMore: false })
})

it('expandableText offers a toggle when body is longer than the snippet', () => {
  const snippet = 'the quick brown fox'
  const body = 'the quick brown fox jumps over the lazy dog and keeps running'
  expect(expandableText(snippet, body, false)).toEqual({ text: snippet, hasMore: true })
  expect(expandableText(snippet, body, true)).toEqual({ text: body, hasMore: true })
})

it('expandableText returns empty text and no toggle when nothing is present', () => {
  expect(expandableText(null, null, false)).toEqual({ text: '', hasMore: false })
  expect(expandableText('', '', true)).toEqual({ text: '', hasMore: false })
})

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
