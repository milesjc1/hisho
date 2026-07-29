import type { UpdateStatus, UpdateEvent } from '../shared/types'

/** True once an update is downloaded and waiting — the only state where a restart-to-install is meaningful. */
export function isInstallable(status: UpdateStatus): boolean {
  return status.state === 'downloaded'
}

/** Fresh status snapshot. Pure — no Electron, so it's unit-testable. */
export function initialStatus(currentVersion: string, lastChecked: number | null): UpdateStatus {
  return {
    currentVersion,
    state: 'idle',
    availableVersion: null,
    progressPercent: null,
    lastChecked,
    error: null
  }
}

/**
 * Map an updater event onto the status. Pure: returns a new object, never
 * mutates `prev`. `currentVersion` and `lastChecked` carry through untouched
 * (lastChecked is stamped by checkNow(), not by these events).
 */
export function reduceUpdateStatus(prev: UpdateStatus, ev: UpdateEvent): UpdateStatus {
  switch (ev.type) {
    case 'checking':
      return { ...prev, state: 'checking', error: null }
    case 'available':
      return { ...prev, state: 'available', availableVersion: ev.version, error: null }
    case 'not-available':
      return { ...prev, state: 'up-to-date', availableVersion: null, progressPercent: null, error: null }
    case 'progress':
      return { ...prev, state: 'downloading', progressPercent: Math.round(ev.percent) }
    case 'downloaded':
      return { ...prev, state: 'downloaded', availableVersion: ev.version, progressPercent: 100 }
    case 'error':
      return { ...prev, state: 'error', error: ev.message }
  }
}
