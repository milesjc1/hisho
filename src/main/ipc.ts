import { ipcMain, shell } from 'electron'
import {
  listCenter,
  listBackburner,
  listResponded,
  listDone,
  listDismissed,
  setState,
  addManual,
  restore,
  newCount,
  getSetting,
  setSetting
} from './db'
import { runPull } from './sync'
import { emitToRenderer, setBadgeCount } from './window'
import type { ItemState } from '../shared/types'

/** After any mutation: refresh the badge and tell the renderer to reload. */
function touched(): void {
  setBadgeCount(newCount())
  emitToRenderer('items:changed')
}

/** Hand a link to the OS default handler (native app / browser) — never an in-app window. */
function openLink(url: string): void {
  let target = url
  // Force Teams web deep links into the desktop app.
  if (target.startsWith('https://teams.microsoft.com/l/')) {
    target = target.replace('https://teams.microsoft.com/l/', 'msteams:/l/')
  }
  void shell.openExternal(target)
}

export function registerIpc(): void {
  ipcMain.handle('shell:open', (_e, url: string) => openLink(url))

  // ---------- board reads ----------
  ipcMain.handle('board:center', () => listCenter())
  ipcMain.handle('board:backburner', () => listBackburner())
  ipcMain.handle('board:responded', () => listResponded())
  ipcMain.handle('board:done', () => listDone())
  ipcMain.handle('board:dismissed', () => listDismissed())

  // ---------- item writes ----------
  ipcMain.handle('item:setState', (_e, id: number, state: ItemState) => {
    setState(id, state)
    touched()
  })
  ipcMain.handle('item:addManual', (_e, title: string) => {
    const id = addManual(title)
    touched()
    return id
  })
  ipcMain.handle('item:restore', (_e, id: number) => {
    restore(id)
    touched()
  })

  // ---------- scan + settings ----------
  ipcMain.handle('pull:run', (_e, days: number) => runPull(days))
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key) ?? null)
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value))
}
