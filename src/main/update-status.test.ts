import { it, expect } from 'vitest'
import { initialStatus, reduceUpdateStatus, isInstallable } from './update-status'
import type { UpdateStatus, UpdateState } from '../shared/types'

const base = (): UpdateStatus => initialStatus('1.2.3', null)

it('initialStatus seeds version + idle, no check yet', () => {
  const s = initialStatus('1.2.3', 1000)
  expect(s).toEqual({
    currentVersion: '1.2.3',
    state: 'idle',
    availableVersion: null,
    progressPercent: null,
    lastChecked: 1000,
    error: null
  })
})

it('checking → up-to-date clears availableVersion and error', () => {
  let s = reduceUpdateStatus({ ...base(), error: 'old', availableVersion: '9.9.9' }, { type: 'checking' })
  expect(s.state).toBe('checking')
  expect(s.error).toBeNull()
  s = reduceUpdateStatus(s, { type: 'not-available' })
  expect(s.state).toBe('up-to-date')
  expect(s.availableVersion).toBeNull()
})

it('checking → available → downloading → downloaded flows through', () => {
  let s = reduceUpdateStatus(base(), { type: 'checking' })
  s = reduceUpdateStatus(s, { type: 'available', version: '2.0.0' })
  expect(s.state).toBe('available')
  expect(s.availableVersion).toBe('2.0.0')

  s = reduceUpdateStatus(s, { type: 'progress', percent: 41.7 })
  expect(s.state).toBe('downloading')
  expect(s.progressPercent).toBe(42) // rounded

  s = reduceUpdateStatus(s, { type: 'downloaded', version: '2.0.0' })
  expect(s.state).toBe('downloaded')
  expect(s.progressPercent).toBe(100)
  expect(s.availableVersion).toBe('2.0.0')
})

it('error from any state records the message', () => {
  const s = reduceUpdateStatus(reduceUpdateStatus(base(), { type: 'checking' }), {
    type: 'error',
    message: 'net down'
  })
  expect(s.state).toBe('error')
  expect(s.error).toBe('net down')
})

it('reducer never mutates its input', () => {
  const prev = base()
  const snapshot = { ...prev }
  reduceUpdateStatus(prev, { type: 'available', version: '2.0.0' })
  expect(prev).toEqual(snapshot)
})

it('isInstallable is true only in the downloaded state', () => {
  const states: UpdateState[] = ['idle', 'checking', 'up-to-date', 'available', 'downloading', 'downloaded', 'error', 'dev']
  for (const state of states) {
    expect(isInstallable({ ...base(), state })).toBe(state === 'downloaded')
  }
})

it('currentVersion and lastChecked are preserved across transitions', () => {
  const prev = { ...initialStatus('1.2.3', 555) }
  const s = reduceUpdateStatus(prev, { type: 'available', version: '2.0.0' })
  expect(s.currentVersion).toBe('1.2.3')
  expect(s.lastChecked).toBe(555)
})
