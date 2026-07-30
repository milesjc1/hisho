import { it, expect } from 'vitest'
import { candidateToIngest } from './index'

it('candidateToIngest carries source_ts through to the ingest row', () => {
  const row = candidateToIngest({
    source: 'slack',
    external_id: 'C1:123.456',
    title: 'Message from kris',
    source_ts: '2026-07-29T14:14:00.000Z'
  })
  expect(row.source_ts).toBe('2026-07-29T14:14:00.000Z')
})

it('candidateToIngest maps author -> sender and defaults missing source_ts to null', () => {
  const row = candidateToIngest({
    source: 'slack',
    external_id: 'C1:123.456',
    title: 'Message from kris',
    author: 'kris.johnson'
  })
  expect(row.sender).toBe('kris.johnson')
  expect(row.source_ts).toBeNull()
})
