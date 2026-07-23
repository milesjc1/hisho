import * as pty from '@lydell/node-pty'
import { existsSync } from 'fs'
import { PROJECTS_DIR } from './claude-runner'
import { emitToRenderer } from './window'

let term: pty.IPty | null = null

const GIT_BASH = 'C:\\Users\\MilesChristensen\\AppData\\Local\\Programs\\Git\\usr\\bin\\bash.exe'

function pickShell(): { file: string; args: string[] } {
  if (existsSync(GIT_BASH)) return { file: GIT_BASH, args: ['-l', '-i'] }
  return { file: 'powershell.exe', args: [] }
}

export function startPty(cols: number, rows: number): void {
  killPty()
  const { file, args } = pickShell()
  term = pty.spawn(file, args, {
    name: 'xterm-color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: PROJECTS_DIR,
    env: process.env as { [key: string]: string }
  })
  term.onData((data) => emitToRenderer('pty:data', data))
  term.onExit(() => {
    emitToRenderer('pty:data', '\r\n[session ended]\r\n')
    term = null
  })
}

export function writePty(data: string): void {
  term?.write(data)
}

export function resizePty(cols: number, rows: number): void {
  if (term && cols > 0 && rows > 0) term.resize(cols, rows)
}

export function killPty(): void {
  if (term) {
    try {
      term.kill()
    } catch {
      /* already gone */
    }
    term = null
  }
}
