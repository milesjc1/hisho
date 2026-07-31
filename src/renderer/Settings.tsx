import { useEffect, useState } from 'react'
import { ZOOM_FACTORS, type FontScale, type UpdateStatus } from '../shared/types'

const api = window.hisho

interface SettingSpec {
  key: string
  label: string
  default: string
  type: 'number' | 'select' | 'textarea' | 'hours'
  options?: string[]
  placeholder?: string
}

const SPECS: SettingSpec[] = [
  { key: 'nagHours', label: 'Nag interval (hours)', default: '3', type: 'number' },
  { key: 'workHours', label: 'Work hours', default: '', type: 'hours' },
  { key: 'staleDays', label: 'Stale after (days)', default: '3', type: 'number' },
  {
    key: 'scanModel',
    label: 'Scan model',
    default: 'sonnet',
    type: 'select',
    options: ['opus', 'sonnet', 'haiku']
  },
  { key: 'scanDays', label: 'First-pull / fallback window (days)', default: '7', type: 'number' },
  { key: 'autoPull', label: 'Auto-pull', default: 'off', type: 'select', options: ['off', 'on'] },
  {
    key: 'autoPullMinutes',
    label: 'Auto-pull interval',
    default: '30',
    type: 'select',
    options: ['15', '30', '60', '120', '180']
  },
  {
    key: 'fontScale',
    label: 'Text size',
    default: 'm',
    type: 'select',
    options: ['s', 'm', 'l']
  },
  {
    key: 'triageRules',
    label: 'Extra triage rules',
    default: '',
    type: 'textarea',
    placeholder: 'Ignore Jira digest emails. Always keep messages from my manager.'
  },
  {
    key: 'ignoreList',
    label: 'Ignore list (one per line: #channel, @sender, or keyword)',
    default: '',
    type: 'textarea',
    placeholder: '#deploys\n@reminders-bot\nstandup'
  },
  {
    key: 'watchChannels',
    label: 'Watch channels (one per line — pulls all messages, not just @mentions)',
    default: '',
    type: 'textarea',
    placeholder: '#planning\n#engineering'
  }
]

const SCALE_LABELS: Record<string, string> = { s: 'Small', m: 'Medium', l: 'Large' }

/** Work-hours dropdown values (0–23) rendered as "9 AM" / "6 PM". */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i))
function hourLabel(h: string): string {
  const n = Number(h)
  const ampm = n < 12 ? 'AM' : 'PM'
  const hr = n % 12 === 0 ? 12 : n % 12
  return `${hr} ${ampm}`
}

/** Friendly labels for select options, keyed by setting key (fallback: raw value). */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  fontScale: SCALE_LABELS,
  autoPull: { off: 'Off', on: 'On' },
  autoPullMinutes: { '15': '15 min', '30': '30 min', '60': '1 hour', '120': '2 hours', '180': '3 hours' }
}

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
    // SPECS keys + the two hour keys the 'workHours' field reads/writes directly.
    const keys: [string, string][] = [
      ...SPECS.map((s) => [s.key, s.default] as [string, string]),
      ['workStart', '9'],
      ['workEnd', '18']
    ]
    void Promise.all(
      keys.map(([k, d]) => api.getSetting(k).then((v) => [k, v ?? d] as const))
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
      <div className="settings-grid">
        {SPECS.map((s) => (
          <div className={`settings-field${s.type === 'textarea' ? ' wide' : ''}`} key={s.key}>
            <label htmlFor={`set-${s.key}`}>{s.label}</label>
          {s.type === 'select' ? (
            <select
              id={`set-${s.key}`}
              value={values[s.key] ?? s.default}
              onChange={(e) => update(s.key, e.target.value)}
            >
              {s.options!.map((o) => (
                <option key={o} value={o}>
                  {OPTION_LABELS[s.key]?.[o] ?? o}
                </option>
              ))}
            </select>
          ) : s.type === 'textarea' ? (
            <textarea
              id={`set-${s.key}`}
              className="settings-textarea"
              rows={4}
              placeholder={s.placeholder}
              value={values[s.key] ?? s.default}
              onChange={(e) => update(s.key, e.target.value)}
            />
          ) : s.type === 'hours' ? (
            <div className="hours-range">
              <select value={values['workStart'] ?? '9'} onChange={(e) => update('workStart', e.target.value)}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
              <span className="hours-dash">to</span>
              <select value={values['workEnd'] ?? '18'} onChange={(e) => update('workEnd', e.target.value)}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{hourLabel(h)}</option>
                ))}
              </select>
            </div>
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
      </div>

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
        {updateStatus?.state === 'downloaded' ? (
          <button className="pull-btn" onClick={() => void api.installUpdate()}>
            Restart &amp; install now
          </button>
        ) : (
          <button
            className="pull-btn"
            disabled={updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'}
            onClick={() => void api.checkForUpdates()}
          >
            Check for updates
          </button>
        )}
        <p className="updates-note">New versions appear here after a release is published.</p>
      </div>
    </div>
  )
}
