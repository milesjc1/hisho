import { useState } from 'react'
import type { Item, Priority } from '../shared/types'
import { itemMeta, SOURCE_LABELS } from './lib'
import { TriageMenu, TimerMenu, PriorityMenu } from './menus'

const api = window.hisho

export default function ItemCard({ item }: { item: Item }): JSX.Element {
  const [showRes, setShowRes] = useState(false)
  const isNew = item.state === 'new'
  const compact = !isNew && item.priority === 'low'

  const open = (): void => {
    if (item.deep_link) window.open(item.deep_link, '_blank')
  }
  const accept = (p: Priority): Promise<void> => api.accept(item.id, p)
  const dismiss = (remindAt: number | null): Promise<void> => api.dismiss(item.id, remindAt)

  // Low-priority accepted items are a glanceable one-line checklist.
  if (compact) {
    return (
      <div className="row-item">
        <button className="done-circle" title="Done" onClick={() => api.done(item.id)} />
        <span className="row-title" title={item.title}>
          {item.title}
        </span>
        <span className="row-src">{SOURCE_LABELS[item.source]}</span>
        <PriorityMenu value={item.priority} onChange={(p) => api.setPriority(item.id, p)} />
        {item.deep_link && (
          <button className="link-btn" onClick={open}>
            Open
          </button>
        )}
        <TimerMenu onDismiss={dismiss} />
      </div>
    )
  }

  return (
    <div className={`item-card ${isNew ? 'is-new' : ''} p-${item.priority ?? 'new'}`}>
      <div className="item-main">
        {!isNew && (
          <button className="done-circle" title="Done" onClick={() => api.done(item.id)} />
        )}
        <div className="item-body">
          <div className="item-title" title={item.title}>
            {isNew && <span className="new-dot">NEW</span>}
            {item.title}
          </div>
          <div className="item-meta">{itemMeta(item)}</div>
          {item.suggested_resolution && (
            <button className="res-toggle" onClick={() => setShowRes(!showRes)}>
              {showRes ? 'Hide suggested next step' : 'Suggested next step'}
            </button>
          )}
          {showRes && item.suggested_resolution && (
            <div className="res-body">{item.suggested_resolution}</div>
          )}
        </div>
        <div className="item-actions">
          {item.deep_link && (
            <button className="link-btn" onClick={open}>
              Open
            </button>
          )}
          {isNew ? (
            <TriageMenu
              suggested={item.suggested_priority}
              onAccept={accept}
              onDismiss={dismiss}
            />
          ) : (
            <>
              <PriorityMenu value={item.priority} onChange={(p) => api.setPriority(item.id, p)} />
              <TimerMenu onDismiss={dismiss} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
