import { useEffect, useState } from 'react'
import Board from './Board'
import DoneView from './DoneView'
import DismissedView from './DismissedView'
import Settings from './Settings'
import AddManual from './AddManual'

type View = 'board' | 'done' | 'dismissed' | 'settings'

const api = window.hisho
const DAY_OPTIONS = [1, 3, 7]

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('board')
  const [days, setDays] = useState(7)
  const [scanning, setScanning] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    void api.getSetting('scanDays').then((v) => {
      if (v != null) setDays(Number(v))
    })
  }, [])

  const changeDays = (d: number): void => {
    setDays(d)
    void api.setSetting('scanDays', String(d))
  }

  const pull = async (): Promise<void> => {
    setScanning(true)
    setPullError(null)
    try {
      const res = await api.pull(days)
      if (!res.ok) {
        setPullError(res.error ?? 'Scan failed')
        setTimeout(() => setPullError(null), 6000)
      }
    } finally {
      setScanning(false)
    }
  }

  const navBtn = (id: View, label: string): JSX.Element => (
    <button className={`btn ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
      {label}
    </button>
  )

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">Hisho</span>

        {showAdd && <AddManual />}

        <select className="sel" value={days} onChange={(e) => changeDays(Number(e.target.value))}>
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d} {d === 1 ? 'day' : 'days'}
            </option>
          ))}
        </select>

        <button className="btn primary" onClick={() => void pull()} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Pull'}
        </button>
        {pullError && <span className="pull-error">{pullError}</span>}

        <button className="btn" onClick={() => setShowAdd((s) => !s)}>
          + Add
        </button>
        {navBtn('done', 'Done')}
        {navBtn('dismissed', 'Dismissed')}
        {navBtn('settings', 'Settings')}
        {view !== 'board' && navBtn('board', 'Board')}
      </div>

      {view === 'board' && <Board />}
      {view === 'done' && <DoneView />}
      {view === 'dismissed' && <DismissedView />}
      {view === 'settings' && <Settings />}
    </div>
  )
}
