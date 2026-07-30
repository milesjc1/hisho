import { app, BrowserWindow, dialog, globalShortcut } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { createWindow, createTray, showWindow, setQuitting, focusCapture } from './window'
import { startRecurring, stopRecurring } from './recurring'
import { startNag, stopNag } from './nag'
import { startStale, stopStale } from './stale'
import { initAutoPull, stopAutoPull } from './auto-pull'
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
    app.setName('Hisho')

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
    startRecurring()
    startNag()
    startStale()
    initAutoPull()
    initAutoUpdate()

    // Global hotkey for instant manual capture — beat the sticky note.
    globalShortcut.register('CommandOrControl+Shift+Space', () => focusCapture())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }

  // Keep running in the tray even when all windows are hidden.
  app.on('window-all-closed', () => {})

  app.on('before-quit', () => {
    setQuitting(true)
    stopRecurring()
    stopNag()
    stopStale()
    stopAutoPull()
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
}
