import { it, expect } from 'vitest'
import { formatItemTime, expandableText, formatStamp, matchesQuery } from './lib'
import type { Item } from '../shared/types'

const item = (o: Partial<Item>): Item => ({
  id: 1, source: 'slack', ext_id: null, kind: null, deep_link: null, app_link: null,
  title: '', sender: null, snippet: null, body: null, state: 'new', status_reason: null,
  responded_at: null, source_ts: null, session_id: null, session_dir: null,
  created_at: 0, last_touched_at: 0, ...o
})

it('matchesQuery returns true for an empty or whitespace query', () => {
  expect(matchesQuery(item({ title: 'anything' }), '')).toBe(true)
  expect(matchesQuery(item({ title: 'anything' }), '   ')).toBe(true)
})

it('matchesQuery matches title case-insensitively', () => {
  expect(matchesQuery(item({ title: 'Message from Ian' }), 'ian')).toBe(true)
  expect(matchesQuery(item({ title: 'Message from Ian' }), 'IAN')).toBe(true)
  expect(matchesQuery(item({ title: 'Message from Ian' }), 'bob')).toBe(false)
})

it('matchesQuery searches sender, snippet, body, kind, and status_reason', () => {
  expect(matchesQuery(item({ sender: 'kris.johnson' }), 'kris')).toBe(true)
  expect(matchesQuery(item({ snippet: 'planning meeting' }), 'meeting')).toBe(true)
  expect(matchesQuery(item({ body: 'the full untruncated text' }), 'untruncated')).toBe(true)
  expect(matchesQuery(item({ kind: '#planning' }), 'planning')).toBe(true)
  expect(matchesQuery(item({ status_reason: 'ignore rule' }), 'ignore')).toBe(true)
})

it('matchesQuery does not throw on null fields and returns false when nothing matches', () => {
  expect(matchesQuery(item({ title: 'hello' }), 'zzz')).toBe(false)
})

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
