import { useEffect, useState } from 'react'
import hishoLogo from './assets/hisho.png'
import type { SyncSummary } from '../shared/types'
import Feed from './Feed'
import Backburner from './Backburner'
import RecurringRules from './RecurringRules'
import Archive from './Archive'
import Ignored from './Ignored'

type View = 'feed' | 'rules' | 'archive' | 'ignored'
type Theme = 'light' | 'dark'

const api = window.hisho

const NAV: { id: View; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'rules', label: 'Recurring' },
  { id: 'archive', label: 'Archive' }
]

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('feed')
  const [syncing, setSyncing] = useState(false)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('hisho-theme') as Theme) || 'light'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hisho-theme', theme)
  }, [theme])

  useEffect(() => {
    void api.syncSummary().then(setSummary)
    return api.onItemsChanged(() => void api.syncSummary().then(setSummary))
  }, [])

  const sync = (): void => {
    setSyncing(true)
    void api.sync().finally(() => {
      setSyncing(false)
      void api.syncSummary().then(setSummary)
    })
  }

  return (
    <div className="app">
      <aside className="nav-sidebar">
        <div className="brand">
          <img className="brand-img" src={hishoLogo} alt="Hisho" />
          <span className="brand-name">Hisho</span>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <button
          className="theme-toggle"
          onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="ignored-link"
            onClick={() => setView('ignored')}
            title="See what the last scan ignored"
          >
            {summary ? `${summary.ignored} ignored last scan` : 'No scan yet'}
          </button>
          <button className="sync-btn" onClick={sync} disabled={syncing}>
            {syncing ? 'Scanning…' : 'Scan now'}
          </button>
        </header>

        <div className="main-content">
          {view === 'feed' && (
            <div className="feed-wrap">
              <Backburner />
              <Feed />
            </div>
          )}
          {view === 'rules' && <RecurringRules />}
          {view === 'archive' && <Archive />}
          {view === 'ignored' && <Ignored />}
        </div>
      </main>
    </div>
  )
}
