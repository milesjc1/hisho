import { useEffect, useState } from 'react'
import { ZOOM_FACTORS, type FontScale } from '../shared/types'

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

export default function Settings(): JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    void Promise.all(
      SPECS.map((s) => api.getSetting(s.key).then((v) => [s.key, v ?? s.default] as const))
    ).then((pairs) => setValues(Object.fromEntries(pairs)))
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
    </div>
  )
}
