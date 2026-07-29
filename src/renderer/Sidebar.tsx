import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import logo from './assets/hisho.png'

const api = window.hisho

export type View = 'board' | 'done' | 'dismissed' | 'settings'

interface Props {
  view: View
  onNavigate: (v: View) => void
  days: number
  onChangeDays: (d: number) => void
  scanning: boolean
  onPull: () => void
  pullError: string | null
}

const DAY_OPTIONS = [1, 3, 7]

const IconGrid = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)
const IconCheck = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconX = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const IconSettings = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const NAV: { id: View; label: string; icon: () => JSX.Element }[] = [
  { id: 'board', label: 'Board', icon: IconGrid },
  { id: 'done', label: 'Done', icon: IconCheck },
  { id: 'dismissed', label: 'Dismissed', icon: IconX },
  { id: 'settings', label: 'Settings', icon: IconSettings }
]

export default function Sidebar({
  view,
  onNavigate,
  days,
  onChangeDays,
  scanning,
  onPull,
  pullError
}: Props): JSX.Element {
  const [counts, setCounts] = useState({ board: 0, done: 0, dismissed: 0 })
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')

  const loadCounts = (): void => {
    void Promise.all([api.center(), api.done(), api.dismissed()]).then(([c, d, x]) => {
      setCounts({ board: c.length, done: d.length, dismissed: x.length })
    })
  }

  useEffect(() => {
    loadCounts()
    return api.onItemsChanged(loadCounts)
  }, [])

  const submitAdd = async (): Promise<void> => {
    const t = title.trim()
    if (!t) return
    await api.addManual(t)
    setTitle('')
    setShowAdd(false)
  }

  const onAddKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') void submitAdd()
  }

  const countFor = (id: View): number | null =>
    id === 'board' ? counts.board : id === 'done' ? counts.done : id === 'dismissed' ? counts.dismissed : null

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src={logo} alt="Hisho" width={30} height={30} />
        <span className="brand-name">Hisho</span>
      </div>

      <nav className="nav">
        {NAV.map((n) => {
          const cnt = countFor(n.id)
          const Icon = n.icon
          return (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => onNavigate(n.id)}
            >
              <Icon />
              <span className="nav-label">{n.label}</span>
              {cnt != null && (
                <span className={`nav-badge ${n.id === 'board' && view === 'board' ? 'accent' : ''}`}>{cnt}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="add-wrap">
        {showAdd ? (
          <div className="add-form">
            <input
              className="add-input"
              type="text"
              placeholder="Task title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onAddKeyDown}
              autoFocus
            />
            <div className="add-row">
              <button className="add-submit" onClick={() => void submitAdd()}>
                Add
              </button>
              <button className="add-cancel" onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button className="add-toggle" onClick={() => setShowAdd(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add task
          </button>
        )}
      </div>

      <div className="scan">
        <label className="scan-label">Scan window</label>
        <select className="scan-select" value={days} onChange={(e) => onChangeDays(Number(e.target.value))}>
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d} {d === 1 ? 'day' : 'days'}
            </option>
          ))}
        </select>
        <button className="pull-btn" onClick={onPull} disabled={scanning}>
          <svg
            className={scanning ? 'spinning' : ''}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          {scanning ? 'Scanning…' : 'Pull'}
        </button>
        {pullError && <span className="pull-error">{pullError}</span>}
      </div>
    </aside>
  )
}
