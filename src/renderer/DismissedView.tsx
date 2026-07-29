import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, sourceStyle } from './lib'

const api = window.hisho

export default function DismissedView(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])

  const load = (): void => {
    void api.dismissed().then(setItems)
  }

  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  return (
    <div className="list-view">
      {items.length === 0 && <div className="list-empty">Nothing dismissed.</div>}
      {items.map((i) => {
        const style = sourceStyle(i.source)
        return (
          <div className="list-row dimmed" key={i.id}>
            <svg className="row-x" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="row-title">{i.title}</span>
            {i.status_reason && <span className="row-reason">{i.status_reason}</span>}
            <span className="badge" style={{ color: style.color, background: style.bg }}>
              {SOURCE_LABELS[i.source]}
            </span>
            <button className="restore-btn" onClick={() => void api.restore(i.id)}>
              Restore
            </button>
          </div>
        )
      })}
    </div>
  )
}
