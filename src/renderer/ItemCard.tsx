import type { DragEvent } from 'react'
import type { Item } from '../shared/types'
import { SOURCE_LABELS, sourceStyle, waitingDays, formatItemTime } from './lib'
import ExpandableText from './ExpandableText'

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
  const metaParts = [item.sender].filter(Boolean) as string[]

  const days = variant === 'responded' ? waitingDays(item.responded_at) : null
  const stale = staleDays != null && days != null && days >= staleDays
  const time = formatItemTime(item.source_ts)

  const sessionBtn = (
    <button
      className="session-btn"
      title={item.session_id ? 'Resume Claude session' : 'Start a Claude session about this item'}
      onClick={() => void api.openSession(item.id)}
    >
      {item.session_id ? '↗ Session' : '✦ Session'}
    </button>
  )

  // Title opens the source (Slack DM, PR, issue…) when the item has a link.
  const titleEl = link ? (
    <button className="title title-link" title="Open" onClick={() => void api.openLink(link)}>
      {item.title}
    </button>
  ) : (
    <div className="title">{item.title}</div>
  )

  const onDragStart = (e: DragEvent<HTMLDivElement>): void => {
    e.dataTransfer.setData('text/plain', String(item.id))
  }

  const move = (state: Item['state']) => () => void api.setState(item.id, state)

  const badge = (
    <span className="badge" style={{ color: style.color, background: style.bg }}>
      {SOURCE_LABELS[item.source]}
      {item.kind && ` · ${item.kind}`}
    </span>
  )

  return (
    <div className={`card ${variant === 'triage' ? 'triage' : ''}`} draggable onDragStart={onDragStart}>
      {variant === 'triage' ? (
        <div className="card-title-row">
          <span className="new-chip">NEW</span>
          {titleEl}
          {sessionBtn}
        </div>
      ) : (
        <div className="card-title-row">
          {titleEl}
          {sessionBtn}
        </div>
      )}

      <div className="meta">
        {badge}
        {time && <span className="meta-text">{time}</span>}
        {metaParts.length > 0 && <span className="meta-text">{metaParts.join(' · ')}</span>}
        {days != null && (
          <span className={`waiting ${stale ? 'stale' : ''}`}>waiting {days}d</span>
        )}
      </div>

      <ExpandableText className="card-desc" snippet={item.snippet} body={item.body} />

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
