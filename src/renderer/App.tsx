import { useEffect, useState } from 'react'
import QuickTask from './panes/QuickTask'
import Reminders from './panes/Reminders'
import Inbox from './panes/Inbox'
import Terminal from './panes/Terminal'

type TabId = 'task' | 'reminders' | 'inbox' | 'terminal'

const TABS: { id: TabId; label: string }[] = [
  { id: 'task', label: 'Quick Task' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'terminal', label: 'Terminal' }
]

export default function App(): JSX.Element {
  const [tab, setTab] = useState<TabId>('task')

  // Main process can pull us to a tab (e.g. clicking a reminder toast).
  useEffect(() => window.hisho.onNavigate((t) => setTab(t)), [])

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand-dot" />
        <span className="title">Hisho</span>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'task' && <QuickTask />}
      {tab === 'reminders' && <Reminders />}
      {tab === 'inbox' && <Inbox />}
      {tab === 'terminal' && <Terminal />}
    </div>
  )
}
