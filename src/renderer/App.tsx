import { useEffect, useState } from 'react'
import hishoLogo from './assets/hisho.png'
import type { SyncSummary } from '../shared/types'
import Feed from './Feed'
import Backburner from './Backburner'
import RecurringRules from './RecurringRules'
import Archive from './Archive'

type View = 'feed' | 'rules' | 'archive'
type Theme = 'light' | 'dark'

const api = window.hisho

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
      <Backburner />

      <main className="main">
        <header className="topbar">
          <div className="brand">
            <img className="brand-img" src={hishoLogo} alt="Hisho" />
            <span className="brand-name">Hisho</span>
          </div>

          <nav className="viewnav">
            <button className={view === 'feed' ? 'on' : ''} onClick={() => setView('feed')}>
              Feed
            </button>
            <button className={view === 'rules' ? 'on' : ''} onClick={() => setView('rules')}>
              Recurring
            </button>
            <button
              className={view === 'archive' ? 'on' : ''}
              onClick={() => setView('archive')}
            >
              Archive
            </button>
          </nav>

          <div className="topbar-right">
            {summary && (
              <span className="sync-summary" title={`Last scan surfaced ${summary.surfaced}`}>
                {summary.ignored} ignored last scan
              </span>
            )}
            <button className="sync-btn" onClick={sync} disabled={syncing}>
              {syncing ? 'Scanning…' : 'Scan now'}
            </button>
            <button
              className="theme-toggle-sm"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        <div className="main-content">
          {view === 'feed' && <Feed />}
          {view === 'rules' && <RecurringRules />}
          {view === 'archive' && <Archive />}
        </div>
      </main>
    </div>
  )
}
