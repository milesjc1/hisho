import { it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'; import { join } from 'path'
import { rmSync, mkdtempSync, writeFileSync, readFileSync } from 'fs'
import { runCli } from './index'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cli-')); process.env.PLATE_DB = join(dir, 'c.db') })
afterEach(async () => {
  const m = await import('../main/db'); m.closeDb()
  delete process.env.PLATE_DB; rmSync(dir, { recursive: true, force: true })
})

it('ingest reads stdin JSON and prints inserted count', async () => {
  const out = await runCli('ingest', JSON.stringify([{ source: 'slack', external_id: 'x', title: 'Hey' }]))
  expect(out.trim()).toBe('1')
})
it('dismiss sets reason and prints count', async () => {
  await runCli('ingest', JSON.stringify([{ source: 'slack', external_id: 'x', title: 'Hey' }]))
  const out = await runCli('dismiss', JSON.stringify([{ source: 'slack', external_id: 'x', reason: 'noise' }]))
  expect(out.trim()).toBe('1')
})

it('ingest reads JSON from a file path (same as stdin)', async () => {
  const f = join(dir, 'plate.json')
  writeFileSync(f, JSON.stringify([{ source: 'slack', external_id: 'y', title: 'From file' }]))
  const out = await runCli('ingest', readFileSync(f, 'utf8'))
  expect(out.trim()).toBe('1')
})

it('re-ingesting the same source+external_id inserts nothing (dedup)', async () => {
  const row = [{ source: 'github', external_id: 'pr-1', title: 'Review me' }]
  expect((await runCli('ingest', JSON.stringify(row))).trim()).toBe('1')
  expect((await runCli('ingest', JSON.stringify(row))).trim()).toBe('0')
})
