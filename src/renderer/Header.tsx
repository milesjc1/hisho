import { useEffect, useState } from 'react'
import logo from './assets/hisho.png'
import { formatStamp } from './lib'

const api = window.hisho

export type View = 'board' | 'done' | 'dismissed' | 'settings'

interface Props {
  view: View
  onNavigate: (v: View) => void
  mode: string
  onChangeMode: (m: string) => void
  lastPullAt: number | null
  scanning: boolean
  onPull: () => void
  pullError: string | null
  query: string
  setQuery: (q: string) => void
}

const IconGrid = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const IconCheck = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
)
const IconX = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
)
const IconSettings = (): JSX.Element => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
)

const NAV: { id: View; label: string; icon: () => JSX.Element }[] = [
  { id: 'board', label: 'Board', icon: IconGrid },
  { id: 'done', label: 'Done', icon: IconCheck },
  { id: 'dismissed', label: 'Dismissed', icon: IconX },
  { id: 'settings', label: 'Settings', icon: IconSettings }
]

export default function Header({
  view, onNavigate, mode, onChangeMode, lastPullAt, scanning, onPull, pullError, query, setQuery
}: Props): JSX.Element {
  const [counts, setCounts] = useState({ board: 0, done: 0, dismissed: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  const loadCounts = (): void => {
    void Promise.all([api.center(), api.done(), api.dismissed()]).then(([c, d, x]) => {
      setCounts({ board: c.length, done: d.length, dismissed: x.length })
    })
  }
  useEffect(() => {
    loadCounts()
    return api.onItemsChanged(loadCounts)
  }, [])

  const countFor = (id: View): number | null =>
    id === 'board' ? counts.board : id === 'done' ? counts.done : id === 'dismissed' ? counts.dismissed : null

  const pick = (id: View): void => {
    onNavigate(id)
    setMenuOpen(false)
  }
  const currentLabel = NAV.find((n) => n.id === view)?.label ?? 'Board'

  // "Since" carries the actual last-pull timestamp so it doesn't need a second line.
  const windowOptions = [
    { v: 'since', label: lastPullAt ? `Since ${formatStamp(lastPullAt)}` : 'Since last pull' },
    { v: '1', label: 'Last 1 day' },
    { v: '7', label: 'Last 7 days' },
    { v: '30', label: 'Last 30 days' }
  ]

  return (
    <header className="header">
      <div className="header-left">
        <div className="hamburger-wrap">
          <button className="hamburger" title="Menu" onClick={() => setMenuOpen((o) => !o)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu">
                {NAV.map((n) => {
                  const cnt = countFor(n.id)
                  const Icon = n.icon
                  return (
                    <button key={n.id} className={`menu-item ${view === n.id ? 'active' : ''}`} onClick={() => pick(n.id)}>
                      <Icon />
                      <span className="menu-label">{n.label}</span>
                      {cnt != null && <span className="menu-badge">{cnt}</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <img className="brand-logo" src={logo} alt="Hisho" width={22} height={22} />
        <span className="brand-name">Hisho</span>
        <span className="brand-view">{currentLabel}</span>
      </div>

      <div className="header-center">
        <div className="search-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Search your plate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" title="Clear" onClick={() => setQuery('')}>×</button>
          )}
        </div>
      </div>

      <div className="header-right">
        <select className="scan-select" value={mode} onChange={(e) => onChangeMode(e.target.value)}>
          {windowOptions.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        <button className="pull-btn" onClick={onPull} disabled={scanning}>
          <svg className={scanning ? 'spinning' : ''} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          {scanning ? 'Scanning…' : 'Pull'}
        </button>
        {pullError && <span className="pull-error header-pull-error">{pullError}</span>}
      </div>
    </header>
  )
}
