import { spawn } from 'child_process'
import * as readline from 'readline'
import type { Connection, RunRequest, RunResult } from '../shared/types'

/**
 * Working directory for every headless run. Runs inherit the `.claude/`
 * MCP config that lives here (Linear / Microsoft 365 / Slack / Notion).
 */
export const PROJECTS_DIR = 'C:\\Users\\MilesChristensen\\Desktop\\claude-projects'

/** Map an app connection to the tool namespace that grants access to it. */
const CONNECTION_TOOLS: Record<Connection, string[]> = {
  microsoft365: ['mcp__claude_ai_Microsoft_365'],
  slack: ['mcp__claude_ai_Slack'],
  linear: ['mcp__claude_ai_Linear'],
  // No GitHub MCP is configured; reach GitHub through the `gh` CLI.
  github: ['Bash(gh:*)']
}

/** Read-only builtins every run may use regardless of chosen connections. */
const BASE_TOOLS = ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'TodoWrite']

function buildAllowedTools(connections: Connection[]): string[] {
  const tools = [...BASE_TOOLS]
  for (const c of connections) tools.push(...CONNECTION_TOOLS[c])
  return tools
}

export interface RunHooks {
  /** Streamed assistant text as it arrives. */
  onText?: (chunk: string) => void
  /** Session id, emitted as soon as the init event lands. */
  onSession?: (sessionId: string) => void
}

/**
 * Spawn `claude` headless for a single task and resolve with the final result.
 * The prompt is written to stdin (never placed on argv) so no user text needs
 * shell-escaping.
 */
export function runClaude(req: RunRequest, hooks: RunHooks = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const allowed = buildAllowedTools(req.connections)

    const args: string[] = [
      '-p',
      '--model',
      req.model,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode',
      'default',
      '--allowedTools',
      ...allowed.map((t) => `"${t}"`)
    ]
    if (req.resumeSessionId) args.push('--resume', req.resumeSessionId)

    // shell:true so Windows resolves the `claude.cmd` shim. Only fixed flags
    // live on the command line; the prompt goes through stdin.
    const child = spawn(`claude ${args.join(' ')}`, {
      cwd: PROJECTS_DIR,
      shell: true,
      windowsHide: true
    })

    let finalText = ''
    let sessionId: string | undefined
    let costUsd: number | undefined
    let sawResult = false
    let stderr = ''

    const rl = readline.createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) return
      let evt: any
      try {
        evt = JSON.parse(trimmed)
      } catch {
        return
      }

      if (evt.type === 'system' && evt.subtype === 'init') {
        sessionId = evt.session_id
        if (sessionId) hooks.onSession?.(sessionId)
        return
      }

      // Assistant text blocks (streamed as they complete).
      if (evt.type === 'assistant' && evt.message?.content) {
        for (const block of evt.message.content) {
          if (block.type === 'text' && block.text) hooks.onText?.(block.text)
        }
        return
      }

      if (evt.type === 'result') {
        sawResult = true
        finalText = evt.result ?? finalText
        sessionId = evt.session_id ?? sessionId
        costUsd = evt.total_cost_usd
      }
    })

    child.stderr.on('data', (d) => (stderr += d.toString()))

    child.on('error', (err) => {
      resolve({ ok: false, text: '', error: `spawn failed: ${err.message}` })
    })

    child.on('close', (code) => {
      if (sawResult) {
        resolve({ ok: true, text: finalText, sessionId, costUsd })
      } else {
        resolve({
          ok: false,
          text: finalText,
          sessionId,
          error: `claude exited ${code} without a result. ${stderr.slice(0, 500)}`
        })
      }
    })

    // Feed the prompt and close stdin so claude runs to completion.
    child.stdin.write(req.prompt)
    child.stdin.end()
  })
}
