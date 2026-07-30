import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, sourceStyle, formatItemTime } from './lib'

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
      {items.length === 0 && <div className="list-empty">Nothing done yet.</div>}
      {items.map((i) => {
        const style = sourceStyle(i.source)
        const link = i.app_link ?? i.deep_link
        const time = formatItemTime(i.source_ts)
        const sub = [time, i.snippet].filter(Boolean).join(' · ')
        return (
          <div className="list-row" key={i.id}>
            <svg className="row-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div className="row-main">
              <div className="row-head">
                {link ? (
                  <button className="row-title row-title-link" title="Open" onClick={() => void api.openLink(link)}>
                    {i.title}
                  </button>
                ) : (
                  <span className="row-title">{i.title}</span>
                )}
                <span className="badge" style={{ color: style.color, background: style.bg }}>
                  {SOURCE_LABELS[i.source]}
                  {i.kind && ` · ${i.kind}`}
                </span>
              </div>
              {sub && <div className="row-sub">{sub}</div>}
            </div>
            <button className="restore-btn" onClick={() => void api.restore(i.id)}>
              Restore
            </button>
          </div>
        )
      })}
    </div>
  )
}
