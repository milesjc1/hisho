import { it, expect } from 'vitest'
import { sessionName, buildContext, buildSessionArgs } from './session-args'
import type { Item } from '../shared/types'

const item = (o: Partial<Item>): Item => ({
  id: 1, source: 'slack', ext_id: null, kind: null, deep_link: null, app_link: null,
  title: '', sender: null, snippet: null, body: null, state: 'new', status_reason: null,
  responded_at: null, source_ts: null, session_id: null, session_dir: null,
  created_at: 0, last_touched_at: 0, ...o
})

it('sessionName combines sender and kind, truncated', () => {
  expect(sessionName(item({ sender: 'ian.beal', kind: '#planning' }))).toBe('ian.beal · #planning')
  expect(sessionName(item({ sender: null, kind: null, source: 'linear' }))).toBe('linear')
})

it('buildContext is a single-line context blurb (not an instruction to act)', () => {
  const ctx = buildContext(item({
    source: 'slack', kind: '#planning', sender: 'ian.beal',
    title: 'planning meeting', deep_link: 'https://x/p1', body: 'line one\nline two'
  }))
  expect(ctx).not.toContain('\n')
  expect(ctx.toLowerCase()).toContain('plate') // frames it as a Hisho item
  expect(ctx.toLowerCase()).toContain('wait') // don't act until asked
  expect(ctx).toContain('From: ian.beal')
  expect(ctx).toContain('Title: planning meeting')
  expect(ctx).toContain('Link: https://x/p1')
  expect(ctx).toContain('line one line two')
})

it('buildSessionArgs injects context via --append-system-prompt, no user message', () => {
  expect(buildSessionArgs({ sessionId: 'u1', name: 'n', context: 'ctx', resume: false }))
    .toEqual(['--session-id', 'u1', '-n', 'n', '--append-system-prompt', 'ctx'])
})

it('buildSessionArgs resumes and re-injects the context (system prompt is per-invocation)', () => {
  expect(buildSessionArgs({ sessionId: 'u1', name: 'n', context: 'ctx', resume: true }))
    .toEqual(['--resume', 'u1', '--append-system-prompt', 'ctx'])
})
