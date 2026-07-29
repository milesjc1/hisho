import { spawn } from 'child_process'
import type { Candidate } from './collect/types'
import type { DismissEntry, ItemSource } from '../shared/types'

const CLAUDE = 'C:\\Users\\MilesChristensen\\.local\\bin\\claude.exe'
const PROJECTS_DIR = 'C:\\Users\\MilesChristensen\\Desktop\\claude-projects'

export interface TriageResult {
  keep: Candidate[]
  dismiss: DismissEntry[]
}

const RULES = `You triage a candidate list of action-needed items for a busy engineer's board.
Each candidate is JSON with: source, external_id, title, sender, snippet, kind, source_ts.
Classify each as NOISE (auto-dismiss) or KEEP.
NOISE: cold sales/marketing, mass announcements, newsletters, purely-FYI automated
notifications, calendar chatter, bot status spam (CI pings, "PR approved" bots).
KEEP: a real person expects a response, an @mention, a review request, an assigned issue,
a direct ask. WHEN UNSURE, KEEP.
Return ONLY a JSON object, no prose, no code fences:
{"dismiss":[{"source":"<src>","external_id":"<id>","reason":"<short why>"}]}
List only items to dismiss; everything not listed is kept.`

/**
 * Run the LLM once as a pure classifier: candidates in, dismiss decisions out.
 * No tools, no network, no DB writes. Everything the model doesn't dismiss is
 * kept (fail-open — a triage failure keeps all candidates rather than losing them).
 */
export async function triage(candidates: Candidate[], model: string): Promise<TriageResult> {
  if (candidates.length === 0) return { keep: [], dismiss: [] }

  const prompt = `${RULES}\n\nCANDIDATES:\n${JSON.stringify(
    candidates.map((c) => ({
      source: c.source,
      external_id: c.external_id,
      title: c.title,
      sender: c.author ?? c.sender,
      snippet: c.snippet,
      kind: c.kind,
      source_ts: c.source_ts
    }))
  )}`

  let dismissKeys: Set<string>
  let dismiss: DismissEntry[]
  try {
    const raw = await runClaude(prompt, model)
    const parsed = parseDismiss(raw)
    dismiss = parsed.filter((d) => candidates.some((c) => c.source === d.source && c.external_id === d.external_id))
    dismissKeys = new Set(dismiss.map((d) => `${d.source}|${d.external_id}`))
  } catch {
    // Fail open: keep everything rather than drop or block the pull.
    return { keep: candidates, dismiss: [] }
  }

  const keep = candidates.filter((c) => !dismissKeys.has(`${c.source}|${c.external_id}`))
  return { keep, dismiss }
}

export function parseDismiss(text: string): DismissEntry[] {
  const obj = extractJson(text)
  const list = Array.isArray(obj?.dismiss) ? obj.dismiss : []
  return list
    .filter((d: any) => d && typeof d.source === 'string' && typeof d.external_id === 'string')
    .map((d: any) => ({
      source: d.source as ItemSource,
      external_id: String(d.external_id),
      reason: typeof d.reason === 'string' ? d.reason.slice(0, 200) : 'noise'
    }))
}

/** Pull the first JSON object out of a model response (tolerates stray prose/fences). */
export function extractJson(text: string): any {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return {}
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return {}
  }
}

function runClaude(prompt: string, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--model', model, '--output-format', 'json', '--permission-mode', 'bypassPermissions']
    const child = spawn(`"${CLAUDE}" ${args.join(' ')}`, { cwd: PROJECTS_DIR, shell: true, windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => reject(e))
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 200)}`))
      try {
        // --output-format json → envelope with .result holding the model's text.
        const env = JSON.parse(out)
        resolve(typeof env.result === 'string' ? env.result : out)
      } catch {
        resolve(out)
      }
    })
    child.stdin.write(prompt)
    child.stdin.end()
  })
}
