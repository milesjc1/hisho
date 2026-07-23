import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  RunRequest,
  RunResult,
  TaskRow,
  ReminderRow,
  ReminderInput,
  MessageRow
} from '../shared/types'

type Tab = 'task' | 'reminders' | 'inbox' | 'terminal'

// Typed, allowlisted bridge. Renderer never touches ipcRenderer directly.
const api = {
  // ---- Quick Task ----
  runTask: (req: RunRequest): Promise<RunResult & { taskId: number }> =>
    ipcRenderer.invoke('task:run', req),
  listTasks: (): Promise<TaskRow[]> => ipcRenderer.invoke('task:list'),
  onTaskText: (cb: (p: { taskId: number; chunk: string }) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, p: { taskId: number; chunk: string }): void => cb(p)
    ipcRenderer.on('task:text', h)
    return () => ipcRenderer.removeListener('task:text', h)
  },

  // ---- Reminders ----
  listReminders: (): Promise<ReminderRow[]> => ipcRenderer.invoke('reminder:list'),
  createReminder: (input: ReminderInput): Promise<number> =>
    ipcRenderer.invoke('reminder:create', input),
  updateReminder: (id: number, input: ReminderInput): Promise<void> =>
    ipcRenderer.invoke('reminder:update', id, input),
  deleteReminder: (id: number): Promise<void> => ipcRenderer.invoke('reminder:delete', id),
  markReminderDone: (id: number, done: boolean): Promise<void> =>
    ipcRenderer.invoke('reminder:markDone', id, done),
  runReminderNow: (id: number): Promise<void> => ipcRenderer.invoke('reminder:runNow', id),
  onRemindersChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('reminder:changed', h)
    return () => ipcRenderer.removeListener('reminder:changed', h)
  },

  // ---- Inbox / messages ----
  listMessages: (): Promise<MessageRow[]> => ipcRenderer.invoke('message:list'),
  refreshMessages: (): Promise<{ found: number; new: number }> =>
    ipcRenderer.invoke('message:refresh'),
  draftReply: (id: number): Promise<string> => ipcRenderer.invoke('message:draft', id),
  markMessageSeen: (id: number): Promise<void> => ipcRenderer.invoke('message:markSeen', id),
  markMessageResponded: (id: number): Promise<void> =>
    ipcRenderer.invoke('message:markResponded', id),
  onMessagesChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('message:changed', h)
    return () => ipcRenderer.removeListener('message:changed', h)
  },

  // ---- Terminal (pty) ----
  ptyStart: (size: { cols: number; rows: number }): void => ipcRenderer.send('pty:start', size),
  ptyInput: (data: string): void => ipcRenderer.send('pty:input', data),
  ptyResize: (size: { cols: number; rows: number }): void =>
    ipcRenderer.send('pty:resize', size),
  ptyKill: (): void => ipcRenderer.send('pty:kill'),
  onPtyData: (cb: (data: string) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, data: string): void => cb(data)
    ipcRenderer.on('pty:data', h)
    return () => ipcRenderer.removeListener('pty:data', h)
  },

  // ---- Navigation (main → renderer) ----
  onNavigate: (cb: (tab: Tab) => void): (() => void) => {
    const h = (_e: IpcRendererEvent, tab: Tab): void => cb(tab)
    ipcRenderer.on('nav:go', h)
    return () => ipcRenderer.removeListener('nav:go', h)
  }
}

contextBridge.exposeInMainWorld('hisho', api)

export type HishoApi = typeof api
