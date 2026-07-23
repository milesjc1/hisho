import { useEffect, useState } from 'react'
import hishoLogo from './assets/hisho.png'
import QuickTask from './panes/QuickTask'
import Reminders from './panes/Reminders'
import Inbox from './panes/Inbox'
import Terminal from './panes/Terminal'

type TabId = 'task' | 'reminders' | 'inbox' | 'terminal'
type Theme = 'light' | 'dark'

const TABS: { id: TabId; label: string }[] = [
  { id: 'task', label: 'Quick Task' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'terminal', label: 'Terminal' }
]

export default function App(): JSX.Element {
  const [tab, setTab] = useState<TabId>('task')
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('hisho-theme') as Theme) || 'light'
  )

  // Main process can pull us to a tab (e.g. clicking a reminder toast).
  useEffect(() => window.hisho.onNavigate((t) => setTab(t)), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hisho-theme', theme)
  }, [theme])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-img" src={hishoLogo} alt="Hisho" />
          <span className="brand-name">Hisho</span>
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <button
          className="theme-toggle"
          onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </aside>

      <main className="content">
        {tab === 'task' && <QuickTask />}
        {tab === 'reminders' && <Reminders />}
        {tab === 'inbox' && <Inbox />}
        {tab === 'terminal' && <Terminal />}
      </main>
    </div>
  )
}
