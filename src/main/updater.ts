import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { notify } from './notify'
import { emitToRenderer, setQuitting } from './window'
import { getSetting, setSetting } from './db'
import { initialStatus, reduceUpdateStatus, isInstallable } from './update-status'
import type { UpdateEvent, UpdateStatus } from '../shared/types'

const { autoUpdater } = electronUpdater

const SIX_HOURS = 6 * 60 * 60 * 1000
const LAST_CHECKED_KEY = 'lastUpdateCheck'

let status: UpdateStatus = initialStatus(app.getVersion(), null)
let hydrated = false

function readLastChecked(): number | null {
  const raw = getSetting(LAST_CHECKED_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Pull the persisted lastChecked from the DB on first use. Deferred so the
 * module can load before initDb() runs; every caller here fires post-boot.
 */
function ensureHydrated(): void {
  if (hydrated) return
  hydrated = true
  status = { ...status, lastChecked: readLastChecked() }
}

/** Fold an event into `status`, then push the snapshot to the renderer. */
function apply(ev: UpdateEvent): void {
  status = reduceUpdateStatus(status, ev)
  emitToRenderer('update:changed', status)
}

/** Current update state (for the Settings panel). */
export function getStatus(): UpdateStatus {
  ensureHydrated()
  return status
}

/**
 * Quit and install a downloaded update now, instead of waiting for the user to
 * fully quit (the window hides to tray on close, so that rarely happens).
 * No-op unless an update is actually downloaded. `setQuitting(true)` first, or
 * the close-to-tray handler swallows the quit and nothing installs.
 */
export function installNow(): void {
  if (!isInstallable(status)) return
  setQuitting(true)
  autoUpdater.quitAndInstall()
}

/**
 * Manually check for updates. Stamps `lastChecked`, persists it, and kicks off
 * a real check. In dev (unpackaged) there are no releases, so report `dev`.
 */
export function checkNow(): void {
  ensureHydrated()
  status = { ...status, lastChecked: Date.now() }
  setSetting(LAST_CHECKED_KEY, String(status.lastChecked))

  if (!app.isPackaged) {
    status = { ...status, state: 'dev' }
    emitToRenderer('update:changed', status)
    return
  }

  emitToRenderer('update:changed', status)
  void autoUpdater.checkForUpdates()
}

/**
 * Check GitHub Releases for a newer version on launch (and periodically).
 * Downloads in the background; installs on the next app quit. Every autoUpdater
 * event is folded into `status` and pushed to the renderer.
 */
export function initAutoUpdate(): void {
  ensureHydrated()
  if (!app.isPackaged) return // dev runs use `npm run dev`, no updates

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => apply({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => apply({ type: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => apply({ type: 'not-available' }))
  autoUpdater.on('download-progress', (p) => apply({ type: 'progress', percent: p.percent }))
  autoUpdater.on('update-downloaded', (info) => {
    apply({ type: 'downloaded', version: info.version })
    notify(`Hisho ${info.version} is ready`, 'The update will install next time you quit Hisho.')
  })
  autoUpdater.on('error', (err) => {
    const message = err?.message ?? String(err)
    apply({ type: 'error', message })
    console.error('[updater]', message)
  })

  void autoUpdater.checkForUpdates()
  setInterval(() => void autoUpdater.checkForUpdates(), SIX_HOURS)
}
