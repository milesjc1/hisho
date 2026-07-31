import { useEffect, useState } from 'react'
import Board from './Board'
import DoneView from './DoneView'
import DismissedView from './DismissedView'
import Settings from './Settings'
import PullLog from './PullLog'
import Header, { type View } from './Header'
import { ZOOM_FACTORS, type FontScale } from '../shared/types'

const api = window.hisho

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('board')
  const [mode, setMode] = useState('since')
  const [lastPullAt, setLastPullAt] = useState<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const refreshLastPull = (): void => {
    void api.getSetting('lastPullAt').then((v) => setLastPullAt(v != null ? Number(v) : null))
  }

  useEffect(() => {
    void api.getSetting('pullMode').then((v) => {
      if (v != null) setMode(v)
    })
    refreshLastPull()
    void api.getSetting('fontScale').then((v) => {
      const scale = (v ?? 'm') as FontScale
      api.setZoom(ZOOM_FACTORS[scale] ?? ZOOM_FACTORS.m)
    })
  }, [])

  const changeMode = (m: string): void => {
    setMode(m)
    void api.setSetting('pullMode', m)
  }

  const pull = async (): Promise<void> => {
    setScanning(true)
    setPullError(null)
    try {
      const res = await api.pull(mode)
      if (!res.ok) {
        setPullError(res.error ?? 'Scan failed')
        setTimeout(() => setPullError(null), 6000)
      }
      refreshLastPull() // main advanced lastPullAt on success
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="app">
      <Header
        view={view}
        onNavigate={setView}
        mode={mode}
        onChangeMode={changeMode}
        lastPullAt={lastPullAt}
        scanning={scanning}
        onPull={() => void pull()}
        pullError={pullError}
        query={query}
        setQuery={setQuery}
      />

      <div className="content">
        {view === 'board' && <Board query={query} />}
        {view === 'done' && <DoneView query={query} />}
        {view === 'dismissed' && <DismissedView query={query} />}
        {view === 'settings' && <Settings />}

        <PullLog />
      </div>
    </div>
  )
}
