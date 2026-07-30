import { it, expect } from 'vitest'
import { parseIgnoreRules, matchesIgnore, filterIgnored } from './ignore'
import type { Candidate } from './types'

const cand = (c: Partial<Candidate>): Candidate => ({
  source: 'slack', external_id: 'x', title: 't', ...c
})

it('parseIgnoreRules classifies #channel / @sender / keyword and trims blanks', () => {
  const r = parseIgnoreRules('  #Deploys \n@Reminders-Bot\n\n  standup notes \n')
  expect(r.channels).toEqual(['deploys'])
  expect(r.senders).toEqual(['reminders-bot'])
  expect(r.keywords).toEqual(['standup notes'])
})

it('parseIgnoreRules on empty/blank returns empty buckets', () => {
  expect(parseIgnoreRules('')).toEqual({ channels: [], senders: [], keywords: [] })
  expect(parseIgnoreRules('   \n  \n')).toEqual({ channels: [], senders: [], keywords: [] })
})

it('matchesIgnore matches a channel by kind, ignoring a leading # and case', () => {
  const r = parseIgnoreRules('#deploys')
  expect(matchesIgnore(cand({ kind: '#Deploys' }), r)).toBe(true)
  expect(matchesIgnore(cand({ kind: '#engineering' }), r)).toBe(false)
  expect(matchesIgnore(cand({ kind: 'DM' }), r)).toBe(false)
})

it('matchesIgnore matches a sender by substring on author or sender', () => {
  const r = parseIgnoreRules('@reminders')
  expect(matchesIgnore(cand({ author: 'Reminders-Bot' }), r)).toBe(true)
  expect(matchesIgnore(cand({ author: undefined, sender: 'reminders' }), r)).toBe(true)
  expect(matchesIgnore(cand({ author: 'kris.johnson' }), r)).toBe(false)
})

it('matchesIgnore matches a keyword substring across title, snippet, and body', () => {
  const r = parseIgnoreRules('standup')
  expect(matchesIgnore(cand({ title: 'Daily Standup' }), r)).toBe(true)
  expect(matchesIgnore(cand({ snippet: 'the standup notes' }), r)).toBe(true)
  expect(matchesIgnore(cand({ body: 'STANDUP reminder' }), r)).toBe(true)
  expect(matchesIgnore(cand({ title: 'code review' }), r)).toBe(false)
})

it('matchesIgnore with empty rules never matches', () => {
  const r = parseIgnoreRules('')
  expect(matchesIgnore(cand({ kind: '#deploys', author: 'anyone', title: 'anything' }), r)).toBe(false)
})

it('filterIgnored splits kept vs ignored and fast-paths empty rules', () => {
  const items = [
    cand({ external_id: '1', kind: '#deploys' }),
    cand({ external_id: '2', kind: 'DM', author: 'kris' }),
    cand({ external_id: '3', title: 'standup' })
  ]
  const out = filterIgnored(items, '#deploys\nstandup')
  expect(out.ignored.map((c) => c.external_id)).toEqual(['1', '3'])
  expect(out.kept.map((c) => c.external_id)).toEqual(['2'])

  const none = filterIgnored(items, '   ')
  expect(none.ignored).toEqual([])
  expect(none.kept).toBe(items) // same reference on fast path
})
