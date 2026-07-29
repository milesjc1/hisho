import { useEffect, useState } from 'react'
import { ZOOM_FACTORS, type FontScale, type UpdateStatus } from '../shared/types'

const api = window.hisho

interface SettingSpec {
  key: string
  label: string
  default: string
  type: 'number' | 'select'
  options?: string[]
}

const SPECS: SettingSpec[] = [
  { key: 'nagHours', label: 'Nag interval (hours)', default: '3', type: 'number' },
  { key: 'workStart', label: 'Work start (hour)', default: '9', type: 'number' },
  { key: 'workEnd', label: 'Work end (hour)', default: '18', type: 'number' },
  { key: 'staleDays', label: 'Stale after (days)', default: '3', type: 'number' },
  {
    key: 'scanModel',
    label: 'Scan model',
    default: 'sonnet',
    type: 'select',
    options: ['opus', 'sonnet', 'haiku']
  },
  { key: 'scanDays', label: 'Scan window (days)', default: '7', type: 'number' },
  {
    key: 'fontScale',
    label: 'Text size',
    default: 'm',
    type: 'select',
    options: ['s', 'm', 'l']
  }
]

const SCALE_LABELS: Record<string, string> = { s: 'Small', m: 'Medium', l: 'Large' }

/** Human-friendly "N min ago" for the last update check. */
function lastCheckedLabel(ms: number | null): string {
  if (!ms) return 'never'
  const mins = Math.floor((Date.now() - ms) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** One-line status derived from the updater state. */
function statusLine(s: UpdateStatus): string {
  switch (s.state) {
    case 'checking':
      return 'Checking…'
    case 'up-to-date':
      return 'Up to date'
    case 'available':
      return `Update available (${s.availableVersion ?? '?'})`
    case 'downloading':
      return `Downloading… ${s.progressPercent ?? 0}%`
    case 'downloaded':
      return 'Ready — installs when you quit Hisho'
    case 'error':
      return `Check failed: ${s.error ?? 'unknown error'}`
    case 'dev':
      return 'Dev build — updates disabled'
    default:
      return 'Idle'
  }
}

export default function Settings(): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    void Promise.all(
      SPECS.map((s) => api.getSetting(s.key).then((v) => [s.key, v ?? s.default] as const))
    ).then((pairs) => setValues(Object.fromEntries(pairs)))
  }, [])

  useEffect(() => {
    void api.getUpdateStatus().then(setUpdateStatus)
    return api.onUpdateChanged(setUpdateStatus)
  }, [])

  const update = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }))
    void api.setSetting(key, value)
    if (key === 'fontScale') {
      api.setZoom(ZOOM_FACTORS[value as FontScale] ?? ZOOM_FACTORS.m)
    }
  }

  return (
    <div className="settings">
      {SPECS.map((s) => (
        <div className="settings-field" key={s.key}>
          <label htmlFor={`set-${s.key}`}>{s.label}</label>
          {s.type === 'select' ? (
            <select
              id={`set-${s.key}`}
              value={values[s.key] ?? s.default}
              onChange={(e) => update(s.key, e.target.value)}
            >
              {s.options!.map((o) => (
                <option key={o} value={o}>
                  {s.key === 'fontScale' ? SCALE_LABELS[o] : o}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`set-${s.key}`}
              type="number"
              value={values[s.key] ?? s.default}
              onChange={(e) => update(s.key, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="updates">
        <div className="updates-row">
          <span className="updates-label">Version</span>
          <span className="updates-value">{updateStatus?.currentVersion ?? '…'}</span>
        </div>
        <div className="updates-row">
          <span className="updates-label">Status</span>
          <span className="updates-value">{updateStatus ? statusLine(updateStatus) : '…'}</span>
        </div>
        <div className="updates-row">
          <span className="updates-label">Last checked</span>
          <span className="updates-value">{lastCheckedLabel(updateStatus?.lastChecked ?? null)}</span>
        </div>
        <button
          className="pull-btn"
          disabled={updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'}
          onClick={() => void api.checkForUpdates()}
        >
          Check for updates
        </button>
        <p className="updates-note">New versions appear here after a release is published.</p>
      </div>
    </div>
  )
}
