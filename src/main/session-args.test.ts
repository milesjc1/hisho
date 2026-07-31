import { it, expect } from 'vitest'
import { sessionName, buildSeed, buildSessionArgs } from './session-args'
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

it('buildSeed is a single line with the item context and a help instruction', () => {
  const seed = buildSeed(item({
    source: 'slack', kind: '#planning', sender: 'ian.beal',
    title: 'planning meeting', deep_link: 'https://x/p1', body: 'line one\nline two'
  }))
  expect(seed).not.toContain('\n')
  expect(seed.toLowerCase()).toContain('help')
  expect(seed).toContain('From: ian.beal')
  expect(seed).toContain('Title: planning meeting')
  expect(seed).toContain('Link: https://x/p1')
  expect(seed).toContain('line one line two') // newlines collapsed
})

it('buildSessionArgs resumes with just --resume <id>', () => {
  expect(buildSessionArgs({ sessionId: 'u1', name: 'n', seed: 's', resume: true }))
    .toEqual(['--resume', 'u1'])
})

it('buildSessionArgs starts a new session with id, name, and seed', () => {
  expect(buildSessionArgs({ sessionId: 'u1', name: 'ian · #planning', seed: 'help me', resume: false }))
    .toEqual(['--session-id', 'u1', '-n', 'ian · #planning', 'help me'])
})
