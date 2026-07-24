import { BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'

const RESOURCES = join(__dirname, '../../resources')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

export function isQuitting(): boolean {
  return quitting
}
export function setQuitting(v: boolean): void {
  quitting = v
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 780,
    minHeight: 560,
    show: false,
    backgroundColor: '#f9ecda',
    autoHideMenuBar: true,
    title: 'Hisho',
    icon: join(RESOURCES, 'app.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // When auto-launched at login (--hidden), stay in the tray instead of popping up.
  const startHidden = process.argv.includes('--hidden')
  mainWindow.on('ready-to-show', () => {
    if (!startHidden) mainWindow?.show()
  })

  // Close hides to tray instead of quitting.
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function showWindow(): void {
  if (!mainWindow) createWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

/**
 * Gentle surface: bring the window to the front when new items arrive.
 * No always-on-top flash — quiet, pull-not-push (spec §10).
 */
export function showAndFocus(): void {
  if (!mainWindow) createWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

/** Ask the renderer to focus the manual-capture bar (global hotkey). */
export function focusCapture(): void {
  showAndFocus()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('capture:focus')
}

/** Push an event to the renderer (e.g. reminders changed → refresh). */
export function emitToRenderer(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

export function setBadgeCount(count: number): void {
  if (!tray) return
  tray.setToolTip(count > 0 ? `Hisho — ${count} to triage` : 'Hisho')
  if (!mainWindow) return
  mainWindow.setOverlayIcon(
    count > 0 ? makeBadgeIcon(count) : null,
    count > 0 ? `${count} to triage` : ''
  )
}

function makeBadgeIcon(count: number): Electron.NativeImage {
  const label = count > 9 ? '9+' : String(count)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="#dc2626"/>
    <text x="16" y="22" font-size="18" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text>
  </svg>`
  return nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  )
}

export function createTray(onQuit: () => void): void {
  const icon = nativeImage.createFromPath(join(RESOURCES, 'icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Hisho')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Hisho', click: () => showWindow() },
      { type: 'separator' },
      { label: 'Quit', click: onQuit }
    ])
  )
  tray.on('double-click', () => showWindow())
}
