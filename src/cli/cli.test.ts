import { it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'; import { join } from 'path'
import { rmSync, mkdtempSync } from 'fs'
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
