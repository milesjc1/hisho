import type { DragEvent } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, sourceStyle, waitingDays } from './lib'

const api = window.hisho

export type CardVariant = 'backburner' | 'triage' | 'active' | 'responded'

interface Props {
  item: Item
  variant: CardVariant
  staleDays?: number
}

export default function ItemCard({ item, variant, staleDays }: Props): JSX.Element {
  const link = item.app_link ?? item.deep_link
  const style = sourceStyle(item.source)
  const metaParts = [item.sender, item.snippet].filter(Boolean) as string[]

  const days = variant === 'responded' ? waitingDays(item.responded_at) : null
  const stale = staleDays != null && days != null && days >= staleDays

  const onDragStart = (e: DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.setData('text/plain', String(item.id))
  }

  const move = (state: Item['state']) => () => void api.setState(item.id, state)

  const badge = (
    <span className="badge" style={{ color: style.color, background: style.bg }}>
      {SOURCE_LABELS[item.source]}
    </span>
  )

  return (
    <div className={`card ${variant === 'triage' ? 'triage' : ''}`} draggable onDragStart={onDragStart}>
      {variant === 'triage' ? (
        <div className="card-title-row">
          <span className="new-chip">NEW</span>
          <div className="title">{item.title}</div>
        </div>
      ) : (
        <div className="card-title-row">
          <div className="title">{item.title}</div>
          {variant === 'active' && link && (
            <button className="open-btn" onClick={() => void api.openLink(link)}>
              Open
            </button>
          )}
        </div>
      )}

      <div className="meta">
        {badge}
        {metaParts.length > 0 && <span className="meta-text">{metaParts.join(' · ')}</span>}
        {days != null && (
          <span className={`waiting ${stale ? 'stale' : ''}`}>waiting {days}d</span>
        )}
      </div>

      {variant === 'backburner' && (
        <div className="cardbtns">
          <button className="mini fill act" onClick={move('active')}>
            → Active
          </button>
          <button className="mini done" onClick={move('done')}>
            ✓
          </button>
          <button className="mini ignore" onClick={move('dismissed')}>
            ✕
          </button>
        </div>
      )}

      {variant === 'responded' && (
        <div className="cardbtns">
          <button className="mini fill act" onClick={move('active')}>
            ← Active
          </button>
          <button className="mini done" onClick={move('done')}>
            ✓
          </button>
          <button className="mini ignore" onClick={move('dismissed')}>
            ✕
          </button>
        </div>
      )}

      {variant === 'triage' && (
        <>
          <div className="cardbtns">
            <button className="mini fill park" onClick={move('backburner')}>
              ← Park
            </button>
            <button className="mini fill replied" onClick={move('responded')}>
              Replied →
            </button>
          </div>
          <div className="cardbtns">
            <button className="mini fill done" onClick={move('done')}>
              ✓ Done
            </button>
            <button className="mini fill ignore" onClick={move('dismissed')}>
              ✕ Ignore
            </button>
          </div>
        </>
      )}

      {variant === 'active' && (
        <div className="cardbtns">
          <button className="mini park" onClick={move('backburner')}>
            ← Park
          </button>
          <button className="mini replied" onClick={move('responded')}>
            Replied →
          </button>
          <div className="cardbtns-right">
            <button className="mini done soft" onClick={move('done')}>
              ✓ Done
            </button>
            <button className="mini ignore" onClick={move('dismissed')}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
