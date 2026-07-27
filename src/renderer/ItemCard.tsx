import type { DragEvent } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_BADGE, SOURCE_LABELS, waitingDays } from './lib'

const api = window.hisho

interface Props {
  item: Item
  showSort?: boolean
  staleDays?: number
}

export default function ItemCard({ item, showSort, staleDays }: Props): JSX.Element {
  const isNew = item.state === 'new'
  const link = item.app_link ?? item.deep_link
  const badgeClass = SOURCE_BADGE[item.source] ?? ''

  const metaParts = [item.sender, item.snippet].filter(Boolean) as string[]

  const days = item.state === 'responded' ? waitingDays(item.responded_at) : null
  const stale = staleDays != null && days != null && days >= staleDays

  const onDragStart = (e: DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.setData('text/plain', String(item.id))
  }

  return (
    <div className={`card ${isNew ? 'is-new' : ''}`} draggable onDragStart={onDragStart}>
      {link && (
        <button className="open-btn" onClick={() => void api.openLink(link)}>
          Open
        </button>
      )}
      <div className="title">
        {isNew && <span className="new-dot">NEW</span>}
        {item.title}
      </div>
      <div className="meta">
        <span className={`badge ${badgeClass}`}>{SOURCE_LABELS[item.source]}</span>
        {metaParts.length > 0 && <span>{metaParts.join(' · ')}</span>}
        {days != null && (
          <span className={`waiting ${stale ? 'stale' : ''}`}>waiting {days}d</span>
        )}
      </div>
      {showSort && (
        <div className="sortbtns">
          <button className="mini l" onClick={() => void api.setState(item.id, 'backburner')}>
            ← Backburner
          </button>
          <button className="mini r" onClick={() => void api.setState(item.id, 'responded')}>
            Responded →
          </button>
          <button className="mini d" onClick={() => void api.setState(item.id, 'done')}>
            ✓ Done
          </button>
        </div>
      )}
    </div>
  )
}
