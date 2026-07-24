import { useEffect, useRef, useState } from 'react'
import type { Item, Priority } from '../shared/types'
import ItemCard from './ItemCard'

const api = window.hisho

const TIERS: { key: 'new' | Priority; label: string }[] = [
  { key: 'new', label: 'New — triage these' },
  { key: 'high', label: 'High' },
  { key: 'med', label: 'Medium' },
  { key: 'low', label: 'Low' }
]

export default function Feed(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState('')
  const captureRef = useRef<HTMLInputElement>(null)

  const load = (): void => {
    void api.listFeed().then(setItems)
  }

  useEffect(() => {
    load()
    const off = api.onItemsChanged(load)
    const offCap = api.onFocusCapture(() => captureRef.current?.focus())
    return () => {
      off()
      offCap()
    }
  }, [])

  const add = (): void => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void api.addManual(t).then(load)
  }

  const group = (key: 'new' | Priority): Item[] =>
    key === 'new'
      ? items.filter((i) => i.state === 'new')
      : items.filter((i) => i.state === 'open' && i.priority === key)

  return (
    <div className="feed">
      <div className="capture">
        <input
          ref={captureRef}
          className="capture-input"
          placeholder="Add a task…  (Ctrl+Shift+Space anywhere)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="capture-add" onClick={add} disabled={!draft.trim()}>
          Add
        </button>
      </div>

      {items.length === 0 && (
        <div className="feed-empty">
          Nothing on your plate. New pings and recurring tasks will show up here.
        </div>
      )}

      {TIERS.map(({ key, label }) => {
        const g = group(key)
        if (g.length === 0) return null
        return (
          <section key={key} className="tier">
            <div className="tier-label">
              {label} <span className="tier-count">{g.length}</span>
            </div>
            <div className="tier-items">
              {g.map((it) => (
                <ItemCard key={it.id} item={it} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
