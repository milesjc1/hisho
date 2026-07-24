import { ipcMain, shell } from 'electron'
import {
  listFeed,
  listBackburner,
  listArchive,
  listIgnored,
  acceptItem,
  setPriority,
  markDone,
  dismissItem,
  addManual,
  resurface,
  untriagedCount,
  listRules,
  createRule,
  updateRule,
  deleteRule
} from './db'
import { runSync, lastSummary } from './sync'
import { tick as recurringTick } from './recurring'
import { emitToRenderer, setBadgeCount } from './window'
import type { Priority, RecurringRuleInput } from '../shared/types'

/** After any mutation: refresh the badge and tell the renderer to reload. */
function touched(): void {
  setBadgeCount(untriagedCount())
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

  // ---------- feed / items ----------
  ipcMain.handle('items:list', () => listFeed())
  ipcMain.handle('items:backburner', () => listBackburner())
  ipcMain.handle('items:archive', () => listArchive())
  ipcMain.handle('items:ignored', () => listIgnored())

  // Promote an ignored (or archived) item back into the feed.
  ipcMain.handle('items:promote', (_e, id: number) => {
    resurface(id)
    touched()
  })

  ipcMain.handle('items:accept', (_e, id: number, priority: Priority) => {
    acceptItem(id, priority)
    touched()
  })

  ipcMain.handle('items:setPriority', (_e, id: number, priority: Priority) => {
    setPriority(id, priority)
    touched()
  })

  ipcMain.handle('items:done', (_e, id: number) => {
    markDone(id)
    touched()
  })

  ipcMain.handle('items:dismiss', (_e, id: number, remindAt: number | null) => {
    dismissItem(id, remindAt)
    touched()
  })

  ipcMain.handle('items:addManual', (_e, title: string) => {
    const id = addManual(title)
    touched()
    return id
  })

  ipcMain.handle('items:restore', (_e, id: number) => {
    resurface(id)
    touched()
  })

  ipcMain.handle('items:sync', () => runSync())
  ipcMain.handle('sync:summary', () => lastSummary())

  // ---------- recurring rules ----------
  ipcMain.handle('rules:list', () => listRules())
  ipcMain.handle('rules:create', (_e, input: RecurringRuleInput) => {
    const id = createRule(input)
    recurringTick() // spawn immediately if it's already inside its lead window
    return id
  })
  ipcMain.handle('rules:update', (_e, id: number, input: RecurringRuleInput) => {
    updateRule(id, input)
  })
  ipcMain.handle('rules:delete', (_e, id: number) => {
    deleteRule(id)
  })
}
