import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, sourceStyle, formatItemTime, matchesQuery } from './lib'
import ExpandableText from './ExpandableText'

const api = window.hisho

export default function DoneView({ query }: { query: string }): JSX.Element {
  const [items, setItems] = useState<Item[]>([])

  const load = (): void => {
    void api.done().then(setItems)
  }

  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  const filtered = items.filter((i) => matchesQuery(i, query))

  return (
    <div className="list-view">
      {filtered.length === 0 && (
        <div className="list-empty">{query.trim() ? 'No matches.' : 'Nothing done yet.'}</div>
      )}
      {filtered.map((i) => {
        const style = sourceStyle(i.source)
        const link = i.app_link ?? i.deep_link
        const time = formatItemTime(i.source_ts)
        const sub = [time, i.sender].filter(Boolean).join(' · ')
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
              <ExpandableText className="row-desc" snippet={i.snippet} body={i.body} />
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
