import { useEffect, useState } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, timeAgo } from './lib'
import { Button } from './ui'

const api = window.hisho

export default function Ignored(): JSX.Element {
  const [items, setItems] = useState<Item[]>([])

  const load = (): void => {
    void api.listIgnored().then(setItems)
  }
  useEffect(() => {
    load()
    return api.onItemsChanged(load)
  }, [])

  return (
    <div className="view">
      <div className="view-head">
        <h2>Ignored by scan</h2>
        <span className="view-sub">Things the last scans set aside. Add any to your feed.</span>
      </div>

      {items.length === 0 && <div className="feed-empty">Nothing ignored.</div>}

      <div className="arch-list">
        {items.map((it) => (
          <div key={it.id} className="ign-item">
            <div className="ign-body">
              <div className="ign-title" title={it.title}>
                {it.title}
              </div>
              <div className="ign-meta">
                {SOURCE_LABELS[it.source]}
                {it.sender ? ` · ${it.sender}` : ''} · {timeAgo(it.created_at)}
              </div>
              {it.ignore_reason && <div className="ign-reason">{it.ignore_reason}</div>}
            </div>
            <div className="ign-actions">
              {(it.app_link || it.deep_link) && (
                <button
                  className="link-btn"
                  onClick={() => void api.openLink((it.app_link ?? it.deep_link)!)}
                >
                  Open
                </button>
              )}
              <Button size="sm" variant="primary" onClick={() => api.promote(it.id)}>
                Add to feed
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
