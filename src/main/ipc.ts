import { ipcMain } from 'electron'
import { runClaude } from './claude-runner'
import {
  createTask,
  finishTask,
  listTasks,
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  markReminderDone
} from './db'
import { reloadJobs, runReminderNow } from './scheduler'
import { poll, draftReply } from './aggregator'
import {
  listMessages,
  markMessageSeen,
  markMessageResponded,
  unreadMessageCount
} from './db'
import { setBadgeCount } from './window'
import { startPty, writePty, resizePty, killPty } from './pty'
import type { RunRequest, RunResult, ReminderInput } from '../shared/types'

export function registerIpc(): void {
  // ---------- Quick Task ----------
  ipcMain.handle('task:list', () => listTasks())

  ipcMain.handle(
    'task:run',
    async (event, req: RunRequest): Promise<RunResult & { taskId: number }> => {
      const taskId = createTask(req.prompt, req.model, req.connections)
      const web = event.sender
      const result = await runClaude(req, {
        onText: (chunk) => {
          if (!web.isDestroyed()) web.send('task:text', { taskId, chunk })
        },
        onSession: (sessionId) => {
          if (!web.isDestroyed()) web.send('task:session', { taskId, sessionId })
        }
      })
      finishTask(taskId, result)
      return { ...result, taskId }
    }
  )

  // ---------- Reminders ----------
  ipcMain.handle('reminder:list', () => listReminders())

  ipcMain.handle('reminder:create', (_e, input: ReminderInput) => {
    const id = createReminder(input)
    reloadJobs()
    return id
  })

  ipcMain.handle('reminder:update', (_e, id: number, input: ReminderInput) => {
    updateReminder(id, input)
    reloadJobs()
  })

  ipcMain.handle('reminder:delete', (_e, id: number) => {
    deleteReminder(id)
    reloadJobs()
  })

  ipcMain.handle('reminder:markDone', (_e, id: number, done: boolean) => {
    markReminderDone(id, done)
    reloadJobs()
  })

  ipcMain.handle('reminder:runNow', (_e, id: number) => {
    runReminderNow(id)
  })

  // ---------- Inbox / messages ----------
  ipcMain.handle('message:list', () => listMessages())
  ipcMain.handle('message:refresh', () => poll())
  ipcMain.handle('message:draft', (_e, id: number) => draftReply(id))

  ipcMain.handle('message:markSeen', (_e, id: number) => {
    markMessageSeen(id)
    setBadgeCount(unreadMessageCount())
  })

  ipcMain.handle('message:markResponded', (_e, id: number) => {
    markMessageResponded(id)
    setBadgeCount(unreadMessageCount())
  })

  // ---------- Terminal (pty) ----------
  ipcMain.on('pty:start', (_e, size: { cols: number; rows: number }) =>
    startPty(size.cols, size.rows)
  )
  ipcMain.on('pty:input', (_e, data: string) => writePty(data))
  ipcMain.on('pty:resize', (_e, size: { cols: number; rows: number }) =>
    resizePty(size.cols, size.rows)
  )
  ipcMain.on('pty:kill', () => killPty())
}
