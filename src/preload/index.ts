import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { Item, ItemState, PullEvent } from '../shared/types'

// Typed, allowlisted bridge. Renderer never touches ipcRenderer directly.
const api = {
  center: (): Promise<Item[]> => ipcRenderer.invoke('board:center'),
  backburner: (): Promise<Item[]> => ipcRenderer.invoke('board:backburner'),
  responded: (): Promise<Item[]> => ipcRenderer.invoke('board:responded'),
  done: (): Promise<Item[]> => ipcRenderer.invoke('board:done'),
  dismissed: (): Promise<Item[]> => ipcRenderer.invoke('board:dismissed'),
  setState: (id: number, state: ItemState): Promise<void> =>
    ipcRenderer.invoke('item:setState', id, state),
  addManual: (title: string): Promise<number> => ipcRenderer.invoke('item:addManual', title),
  restore: (id: number): Promise<void> => ipcRenderer.invoke('item:restore', id),
  openLink: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),
  pull: (days: number): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('pull:run', days),
  getSetting: (k: string): Promise<string | null> => ipcRenderer.invoke('settings:get', k),
  setSetting: (k: string, v: string): Promise<void> => ipcRenderer.invoke('settings:set', k, v),
  setZoom: (factor: number): void => {
    webFrame.setZoomFactor(factor)
  },
  onItemsChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('items:changed', h)
    return () => ipcRenderer.removeListener('items:changed', h)
  },
  onPullEvent: (cb: (ev: PullEvent) => void): (() => void) => {
    const h = (_e: unknown, ev: PullEvent): void => cb(ev)
    ipcRenderer.on('pull:event', h)
    return () => ipcRenderer.removeListener('pull:event', h)
  }
}

contextBridge.exposeInMainWorld('hisho', api)

export type HishoApi = typeof api
