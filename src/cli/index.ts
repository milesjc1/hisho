import { initDbAt, ingest, dismissEntries } from '../main/db'

/** Pure entry used by tests and main(). Returns stdout text. */
export async function runCli(cmd: string, stdin: string): Promise<string> {
  const file = process.env.PLATE_DB
  if (!file) throw new Error('PLATE_DB not set')
  initDbAt(file)
  const payload = stdin.trim() ? JSON.parse(stdin) : []
  if (cmd === 'ingest') return String(ingest(payload))
  if (cmd === 'dismiss') return String(dismissEntries(payload))
  throw new Error(`unknown command: ${cmd}`)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

if (require.main === module) {
  const cmd = process.argv[2] ?? ''
  readStdin()
    .then((s) => runCli(cmd, s))
    .then((out) => { process.stdout.write(out + '\n'); process.exit(0) })
    .catch((e) => { process.stderr.write(String(e?.message ?? e) + '\n'); process.exit(1) })
}
