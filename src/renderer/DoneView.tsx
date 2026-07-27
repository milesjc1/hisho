import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_BADGE, SOURCE_LABELS } from './lib'

const api = window.hisho

export default function DoneView(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])

  const load = (): void => {
    void api.done().then(setItems)
  }

  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  return (
    <div className="list-view">
      <h3>Done</h3>
      {items.length === 0 && <div className="list-empty">Nothing done yet.</div>}
      {items.map((i) => (
        <div className="list-row" key={i.id}>
          <span className="row-title">{i.title}</span>
          <span className={`badge ${SOURCE_BADGE[i.source] ?? ''}`}>{SOURCE_LABELS[i.source]}</span>
          <span className="spacer" />
          <button className="btn" onClick={() => void api.restore(i.id)}>
            Restore
          </button>
        </div>
      ))}
    </div>
  )
}
