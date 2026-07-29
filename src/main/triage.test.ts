import { it, expect } from 'vitest'
import { parseDismiss, extractJson } from './triage'

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
