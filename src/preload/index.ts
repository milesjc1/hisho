import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  Item,
  Priority,
  RecurringRule,
  RecurringRuleInput,
  SyncSummary
} from '../shared/types'

// Typed, allowlisted bridge. Renderer never touches ipcRenderer directly.
const api = {
  // ---- feed / items ----
  listFeed: (): Promise<Item[]> => ipcRenderer.invoke('items:list'),
  listBackburner: (): Promise<Item[]> => ipcRenderer.invoke('items:backburner'),
  listArchive: (): Promise<Item[]> => ipcRenderer.invoke('items:archive'),
  listIgnored: (): Promise<Item[]> => ipcRenderer.invoke('items:ignored'),
  promote: (id: number): Promise<void> => ipcRenderer.invoke('items:promote', id),
  openLink: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),
  accept: (id: number, priority: Priority): Promise<void> =>
    ipcRenderer.invoke('items:accept', id, priority),
  setPriority: (id: number, priority: Priority): Promise<void> =>
    ipcRenderer.invoke('items:setPriority', id, priority),
  done: (id: number): Promise<void> => ipcRenderer.invoke('items:done', id),
  dismiss: (id: number, remindAt: number | null): Promise<void> =>
    ipcRenderer.invoke('items:dismiss', id, remindAt),
  addManual: (title: string): Promise<number> => ipcRenderer.invoke('items:addManual', title),
  restore: (id: number): Promise<void> => ipcRenderer.invoke('items:restore', id),
  sync: (): Promise<{ found: number; new: number }> => ipcRenderer.invoke('items:sync'),
  syncSummary: (): Promise<SyncSummary | null> => ipcRenderer.invoke('sync:summary'),
  onItemsChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('items:changed', h)
    return () => ipcRenderer.removeListener('items:changed', h)
  },

  // ---- recurring rules ----
  listRules: (): Promise<RecurringRule[]> => ipcRenderer.invoke('rules:list'),
  createRule: (input: RecurringRuleInput): Promise<number> =>
    ipcRenderer.invoke('rules:create', input),
  updateRule: (id: number, input: RecurringRuleInput): Promise<void> =>
    ipcRenderer.invoke('rules:update', id, input),
  deleteRule: (id: number): Promise<void> => ipcRenderer.invoke('rules:delete', id),

  // ---- capture-bar focus (main → renderer, from the global hotkey) ----
  onFocusCapture: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('capture:focus', h)
    return () => ipcRenderer.removeListener('capture:focus', h)
  }
}

contextBridge.exposeInMainWorld('hisho', api)

export type HishoApi = typeof api
