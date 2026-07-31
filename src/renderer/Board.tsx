import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import type { KeyboardEvent } from 'react'
import Panel from './Panel'
import ItemCard from './ItemCard'
import { matchesQuery } from './lib'

const api = window.hisho

const IconBackburner = (): JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)
const IconActive = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const IconResponded = (): JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export default function Board({ query }: { query: string }): JSX.Element {
  const [center, setCenter] = useState<Item[]>([])
  const [back, setBack] = useState<Item[]>([])
  const [resp, setResp] = useState<Item[]>([])
  const [staleDays, setStaleDays] = useState(3)
  const [addTitle, setAddTitle] = useState('')

  const submitAdd = async (): Promise<void> => {
    const t = addTitle.trim()
    if (!t) return
    await api.addManual(t)
    setAddTitle('')
  }
  const onAddKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') void submitAdd()
  }

  const load = (): void => {
    void Promise.all([api.center(), api.backburner(), api.responded()]).then(([c, b, r]) => {
      setCenter(c)
      setBack(b)
      setResp(r)
    })
    void api.getSetting('staleDays').then((v) => {
      if (v != null) setStaleDays(Number(v))
    })
  }

  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  const fBack = back.filter((i) => matchesQuery(i, query))
  const fCenter = center.filter((i) => matchesQuery(i, query))
  const fResp = resp.filter((i) => matchesQuery(i, query))
  const newItems = fCenter.filter((i) => i.state === 'new')
  const activeItems = fCenter.filter((i) => i.state !== 'new')

  return (
    <div className="board">
      <Panel title="Backburner" count={fBack.length} state="backburner" icon={<IconBackburner />}>
        {fBack.length === 0 && <div className="panel-empty">Nothing parked</div>}
        {fBack.map((i) => (
          <ItemCard key={i.id} item={i} variant="backburner" />
        ))}
      </Panel>

      <Panel
        title="Active"
        count={fCenter.length}
        state="active"
        icon={<IconActive />}
        accent
        action={
          <span className="add-inline">
            <input
              className="add-inline-input"
              type="text"
              placeholder="Add task…"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={onAddKeyDown}
            />
            <button className="add-inline-go" onClick={() => void submitAdd()}>Add</button>
          </span>
        }
      >
        {newItems.length > 0 && (
          <div className="section-label">
            Needs triage
            <span className="triage-dot" />
          </div>
        )}
        {newItems.map((i) => (
          <ItemCard key={i.id} item={i} variant="triage" />
        ))}

        {newItems.length > 0 && activeItems.length > 0 && <hr className="divider" />}
        {activeItems.length > 0 && <div className="section-label">In Progress</div>}
        {activeItems.map((i) => (
          <ItemCard key={i.id} item={i} variant="active" />
        ))}

        {fCenter.length === 0 && <div className="panel-empty">All clear</div>}
      </Panel>

      <Panel title="Responded" count={fResp.length} state="responded" icon={<IconResponded />}>
        {fResp.length === 0 && <div className="panel-empty">Nothing pending</div>}
        {fResp.map((i) => (
          <ItemCard key={i.id} item={i} variant="responded" staleDays={staleDays} />
        ))}
      </Panel>
    </div>
  )
}
