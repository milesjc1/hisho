import { app, BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { createWindow, createTray, showWindow, setQuitting } from './window'
import { startScheduler, stopScheduler } from './scheduler'
import { startAggregator, stopAggregator } from './aggregator'
import { killPty } from './pty'
import { initAutoUpdate } from './updater'

// Single instance: focus the existing window instead of launching a second copy.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.whenReady().then(() => {
    try {
      boot()
    } catch (err) {
      const msg = err instanceof Error ? (err.stack ?? err.message) : String(err)
      try {
        writeFileSync(join(app.getPath('temp'), 'hisho-startup-error.log'), msg)
      } catch {
        /* noop */
      }
      dialog.showErrorBox('Hisho failed to start', msg)
      app.quit()
    }
  })

  function boot(): void {
    // Stable identity so Windows groups the window/shortcut under one taskbar icon.
    app.setAppUserModelId('com.mileschristensen.hisho')

    // Launch on login, hidden to the tray (only in packaged builds).
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] })
    }

    initDb()
    createWindow()
    createTray(() => {
      setQuitting(true)
      app.quit()
    })
    registerIpc()
    startScheduler()
    startAggregator()
    initAutoUpdate()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }

  // Keep running in the tray even when all windows are hidden.
  app.on('window-all-closed', () => {})

  app.on('before-quit', () => {
    setQuitting(true)
    stopScheduler()
    stopAggregator()
    killPty()
  })
}
