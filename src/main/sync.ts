import { spawn } from 'child_process'
import { emitToRenderer, setBadgeCount, showAndFocus } from './window'
import { notify } from './notify'
import { newCount, getSetting } from './db'

const PROJECTS_DIR = 'C:\\Users\\MilesChristensen\\Desktop\\claude-projects'
const CLAUDE = 'C:\\Users\\MilesChristensen\\.local\\bin\\claude.exe'

let running = false

/** DB file the skill's plate-write must target (same file the app opened). */
function dbFile(): string {
  return process.env.PLATE_DB || `${process.env.APPDATA}\\Hisho\\hisho.db`
}

/** Spawn the whats-on-my-plate skill headless; it writes to the DB via plate-write. */
export function runPull(days: number): Promise<{ ok: boolean; error?: string }> {
  if (running) return Promise.resolve({ ok: false, error: 'already running' })
  running = true
  return new Promise((resolve) => {
    const prompt = `what's on my plate (last ${days} days)`
    const args = ['-p', '--permission-mode', 'auto', '--model', getSetting('scanModel') || 'sonnet']
    const child = spawn(`"${CLAUDE}" ${args.join(' ')}`, {
      cwd: PROJECTS_DIR,
      shell: true,
      windowsHide: true,
      env: { ...process.env, PLATE_DB: dbFile() }
    })
    let stderr = ''
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.stdin.write(prompt)
    child.stdin.end()
    child.on('error', (e) => {
      running = false
      resolve({ ok: false, error: e.message })
    })
    child.on('close', (code) => {
      running = false
      setBadgeCount(newCount())
      emitToRenderer('items:changed')
      if (code === 0) {
        const n = newCount()
        if (n > 0) {
          notify(`${n} on your plate`, 'Hisho pulled new items.')
          showAndFocus()
        }
        resolve({ ok: true })
      } else {
        resolve({ ok: false, error: `claude exited ${code}: ${stderr.slice(0, 400)}` })
      }
    })
  })
}
