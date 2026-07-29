import { useEffect, useState } from 'react'
import Board from './Board'
import DoneView from './DoneView'
import DismissedView from './DismissedView'
import Settings from './Settings'
import PullLog from './PullLog'
import Sidebar, { type View } from './Sidebar'
import { ZOOM_FACTORS, type FontScale } from '../shared/types'

const api = window.hisho

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('board')
  const [days, setDays] = useState(7)
  const [scanning, setScanning] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)

  useEffect(() => {
    void api.getSetting('scanDays').then((v) => {
      if (v != null) setDays(Number(v))
    })
    void api.getSetting('fontScale').then((v) => {
      const scale = (v ?? 'm') as FontScale
      api.setZoom(ZOOM_FACTORS[scale] ?? ZOOM_FACTORS.m)
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

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={setView}
        days={days}
        onChangeDays={changeDays}
        scanning={scanning}
        onPull={() => void pull()}
        pullError={pullError}
      />

      <div className="main">
        {view === 'board' && <Board />}
        {view === 'done' && <DoneView />}
        {view === 'dismissed' && <DismissedView />}
        {view === 'settings' && <Settings />}

        <PullLog />
      </div>
    </div>
  )
}
