import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { notify } from './notify'

const { autoUpdater } = electronUpdater

const SIX_HOURS = 6 * 60 * 60 * 1000

/**
 * Check GitHub Releases for a newer version on launch (and periodically).
 * Downloads in the background; installs on the next app quit.
 */
export function initAutoUpdate(): void {
  if (!app.isPackaged) return // dev runs use `npm run dev`, no updates

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    notify(
      `Hisho ${info.version} is ready`,
      'The update will install next time you quit Hisho.'
    )
  })
  autoUpdater.on('error', (err) => {
    console.error('[updater]', err?.message ?? err)
  })

  void autoUpdater.checkForUpdates()
  setInterval(() => void autoUpdater.checkForUpdates(), SIX_HOURS)
}
