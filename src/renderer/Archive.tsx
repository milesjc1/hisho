import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, timeAgo } from './lib'
import { Button } from './ui'

const api = window.hisho

export default function Archive(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])

  const load = (): void => {
    void api.listArchive().then(setItems)
  }
  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  const done = items.filter((i) => i.state === 'done')
  const ignored = items.filter((i) => i.state === 'dismissed')

  const section = (label: string, list: Item[]): JSX.Element | null =>
    list.length === 0 ? null : (
      <section className="tier">
        <div className="tier-label">
          {label} <span className="tier-count">{list.length}</span>
        </div>
        <div className="arch-list">
          {list.map((it) => (
            <div key={it.id} className="arch-item">
              <span className="arch-title" title={it.title}>
                {it.title}
              </span>
              <span className="arch-meta">
                {SOURCE_LABELS[it.source]} · {timeAgo(it.last_touched_at)}
              </span>
              <Button size="sm" variant="ghost" onClick={() => api.restore(it.id)}>
                Restore
              </Button>
            </div>
          ))}
        </div>
      </section>
    )

  return (
    <div className="view">
      <div className="view-head">
        <h2>Archive</h2>
      </div>
      {items.length === 0 && <div className="feed-empty">Nothing archived yet.</div>}
      {section('Done', done)}
      {section('Ignored', ignored)}
    </div>
  )
}
