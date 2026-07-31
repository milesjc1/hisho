import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Item } from '../shared/types'
import { sessionName, buildContext, buildSessionArgs } from './session-args'

const CLAUDE = 'C:\\Users\\MilesChristensen\\.local\\bin\\claude.exe'
export const DEFAULT_SESSION_DIR = 'C:\\Users\\MilesChristensen\\Desktop\\claude-projects'

/** Quote a batch-file argument: wrap in double quotes, and neutralize any inner
 * double quotes (which would break the batch line) by swapping them to single. */
function q(s: string): string {
  return `"${s.replace(/"/g, "'")}"`
}

/**
 * Open (or resume) a Claude Code session for an item in an external terminal.
 * A new session gets a fixed UUID and the item context as its seed; an item that
 * already has a session id resumes it (`--resume`) from the same directory, so the
 * conversation persists between opens. Returns the session id + whether it's new.
 */
export function openSession(item: Item, defaultDir: string): { sessionId: string; isNew: boolean } {
  const resume = !!item.session_id
  const sessionId = item.session_id ?? randomUUID()
  const dir = item.session_dir ?? defaultDir
  const args = buildSessionArgs({ sessionId, name: sessionName(item), context: buildContext(item), resume })

  // A tiny batch encapsulates the quoting: cd into the dir, run claude with args,
  // and `cmd /k` keeps the window open after the session ends.
  const line = [q(CLAUDE), ...args.map(q)].join(' ')
  const cmdFile = join(app.getPath('temp'), `hisho-session-${sessionId}.cmd`)
  writeFileSync(cmdFile, `@echo off\r\ntitle Hisho - ${sessionName(item).replace(/"/g, "'")}\r\ncd /d ${q(dir)}\r\n${line}\r\n`)

  spawn(`start "" cmd /k ${q(cmdFile)}`, {
    cwd: dir,
    shell: true,
    detached: true,
    windowsHide: false
  }).unref()

  return { sessionId, isNew: !resume }
}
