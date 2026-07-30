import { it, expect } from 'vitest'
import { parseDismiss, extractJson, buildTriagePrompt } from './triage'
import type { Candidate } from './collect/types'

const cands: Candidate[] = [
  { source: 'slack', external_id: 'a', title: 'Message from kris', snippet: 'hey', kind: 'DM' }
]

it('buildTriagePrompt always includes the base rules and the candidates JSON', () => {
  const p = buildTriagePrompt(cands, '')
  expect(p).toContain('You triage a candidate list')
  expect(p).toContain('"external_id":"a"')
  expect(p).not.toContain('ADDITIONAL RULES')
})

it('buildTriagePrompt appends a labelled block only when user rules are present', () => {
  const p = buildTriagePrompt(cands, 'Ignore Jira digests. Always keep my manager.')
  expect(p).toContain('ADDITIONAL RULES')
  expect(p).toContain('Ignore Jira digests. Always keep my manager.')
  // user block sits before the candidates payload
  expect(p.indexOf('ADDITIONAL RULES')).toBeLessThan(p.indexOf('CANDIDATES:'))
})

it('buildTriagePrompt ignores whitespace-only user rules', () => {
  expect(buildTriagePrompt(cands, '   \n ')).not.toContain('ADDITIONAL RULES')
})

it('extractJson strips ```json code fences (what the model actually returns)', () => {
  const fenced = '```json\n{"dismiss":[{"source":"outlook","external_id":"m1","reason":"spam"}]}\n```'
  expect(extractJson(fenced)).toEqual({ dismiss: [{ source: 'outlook', external_id: 'm1', reason: 'spam' }] })
})

it('extractJson tolerates prose around the object', () => {
  expect(extractJson('Here you go: {"dismiss":[]} — done')).toEqual({ dismiss: [] })
})

it('extractJson returns {} on garbage (fail-safe)', () => {
  expect(extractJson('no json here')).toEqual({})
  expect(extractJson('{broken')).toEqual({})
})

it('parseDismiss keeps only well-formed entries and clamps reason', () => {
  const raw = JSON.stringify({
    dismiss: [
      { source: 'slack', external_id: 'a', reason: 'noise' },
      { source: 'github' }, // missing external_id → dropped
      { external_id: 'b', reason: 'x' }, // missing source → dropped
      { source: 'outlook', external_id: 'c', reason: 'y'.repeat(300) }
    ]
  })
  const out = parseDismiss(raw)
  expect(out.map((d) => d.external_id)).toEqual(['a', 'c'])
  expect(out[1].reason.length).toBe(200)
})

it('parseDismiss defaults reason when absent', () => {
  const out = parseDismiss(JSON.stringify({ dismiss: [{ source: 'teams', external_id: 't1' }] }))
  expect(out[0].reason).toBe('noise')
})
