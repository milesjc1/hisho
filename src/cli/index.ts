import { readFileSync } from 'fs'
import { initDbAt, ingest, dismissEntries } from '../main/db'
import { collectAll, candidateToIngest } from '../main/collect'
import { triage } from '../main/triage'

/** Pure entry used by tests and main(). `input` is the raw JSON text. Returns stdout text. */
export async function runCli(cmd: string, input: string): Promise<string> {
  const file = process.env.PLATE_DB
  if (!file) throw new Error('PLATE_DB not set')
  initDbAt(file)
  const payload = input.trim() ? JSON.parse(input) : []
  if (cmd === 'ingest') return String(ingest(payload))
  if (cmd === 'dismiss') return String(dismissEntries(payload))
  throw new Error(`unknown command: ${cmd}`)
}

/**
 * Full pipeline for manual testing without launching the app:
 * `plate-write scan <days>` → collect (deterministic) → triage (LLM) → ingest.
 * Writes to PLATE_DB and prints a per-source + totals report.
 */
export async function scan(days: number): Promise<string> {
  const file = process.env.PLATE_DB
  if (!file) throw new Error('PLATE_DB not set')
  initDbAt(file)
  const { candidates, results } = await collectAll(days)
  const report = results.map((r) =>
    r.error ? `  ${r.source}: ${r.candidates.length} (note: ${r.error})` : `  ${r.source}: ${r.candidates.length}`
  )
  const model = process.env.SCAN_MODEL || 'sonnet'
  const { keep, dismiss } = await triage(candidates, model)
  const inserted = ingest(keep.map(candidateToIngest))
  const dismissed = dismiss.length ? dismissEntries(dismiss) : 0
  return [
    'sources:',
    ...report,
    `candidates: ${candidates.length}`,
    `inserted (new): ${inserted}`,
    `dismissed (noise): ${dismissed}`
  ].join('\n')
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Read the JSON payload. Prefer a file path arg (`plate-write ingest <file>`)
 * so JSON never travels through the shell — passing a raw JSON array on the
 * command line trips Claude Code's bash-safety parser (braces + quotes read as
 * "expansion obfuscation"). Fall back to stdin when no path is given.
 */
async function readInput(pathArg: string | undefined): Promise<string> {
  if (pathArg) return readFileSync(pathArg, 'utf8')
  return readStdin()
}

if (require.main === module) {
  const cmd = process.argv[2] ?? ''
  const arg = process.argv[3]
  const run =
    cmd === 'scan'
      ? scan(Number(arg) || 7)
      : readInput(arg).then((s) => runCli(cmd, s))
  run
    .then((out) => { process.stdout.write(out + '\n'); process.exit(0) })
    .catch((e) => { process.stderr.write(String(e?.message ?? e) + '\n'); process.exit(1) })
}
