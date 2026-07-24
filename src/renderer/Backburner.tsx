import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { backIn, isSoon, isLaterToday, SOURCE_LABELS } from './lib'

const api = window.hisho

export default function Backburner(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])
  const [expanded, setExpanded] = useState(false)
  const [, setTick] = useState(0)

  const load = (): void => {
    void api.listBackburner().then(setItems)
  }

  useEffect(() => {
    load()
    const off = api.onItemsChanged(load)
    const clock = setInterval(() => setTick((n) => n + 1), 15000) // refresh countdowns
    return () => {
      off()
      clearInterval(clock)
    }
  }, [])

  // Default view: only items coming back later today. Soonest always visible.
  const today = items.filter((i) => i.remind_at != null && isLaterToday(i.remind_at))
  const rest = items.filter((i) => !(i.remind_at != null && isLaterToday(i.remind_at)))
  const visible = expanded ? items : today.length ? today : items.slice(0, 1)
  const hidden = items.length - visible.length

  return (
    <aside className={`backburner-float ${items.length === 0 ? 'empty' : ''}`}>
      <div className="bb-head">Backburner</div>

      {items.length === 0 && <div className="bb-empty">Nothing parked.</div>}

      <div className="bb-list">
        {visible.map((it, i) => {
          const soon = it.remind_at != null && isSoon(it.remind_at)
          return (
            <div
              key={it.id}
              className={`bb-item ${soon ? 'soon' : ''}`}
              title="Bring back now"
              onClick={() => api.restore(it.id)}
            >
              <div className="bb-title">{it.title}</div>
              <div className="bb-when">
                {it.remind_at != null ? backIn(it.remind_at) : ''}
                <span className="bb-src">{SOURCE_LABELS[it.source]}</span>
              </div>
              {i === 0 && soon && <div className="bb-flag">returning soon</div>}
            </div>
          )
        })}
      </div>

      {(hidden > 0 || (expanded && rest.length > 0)) && (
        <button className="bb-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `See more (${hidden})`}
        </button>
      )}
    </aside>
  )
}
