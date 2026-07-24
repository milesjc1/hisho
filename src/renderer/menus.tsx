import { useEffect, useRef, useState } from 'react'
import type { Priority } from '../shared/types'

/** Fixed backburner timers (spec §5.5: predictable, no event triggers in v1). */
export function dismissOptions(): { label: string; remindAt: number | null }[] {
  const now = Date.now()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return [
    { label: '5 min', remindAt: now + 5 * 60000 },
    { label: '15 min', remindAt: now + 15 * 60000 },
    { label: 'Later today', remindAt: now + 3 * 60 * 60000 },
    { label: 'Tomorrow', remindAt: tomorrow.getTime() },
    { label: 'Ignore', remindAt: null }
  ]
}

/** Close a popover when clicking outside it. */
function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return ref
}

// ---------- Triage menu (new items) ----------

export function TriageMenu({
  suggested,
  onAccept,
  onDismiss
}: {
  suggested: Priority | null
  onAccept: (p: Priority) => void
  onDismiss: (remindAt: number | null) => void
}): JSX.Element {
  const [open, setOpen] = useState<null | 'accept' | 'dismiss'>(null)
  const ref = useOutside(() => setOpen(null))
  const order: Priority[] = ['high', 'med', 'low']
  const sorted = suggested ? [suggested, ...order.filter((p) => p !== suggested)] : order
  const label: Record<Priority, string> = { high: 'High', med: 'Medium', low: 'Low' }

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="triage-btn accept" onClick={() => setOpen(open === 'accept' ? null : 'accept')}>
        Accept
      </button>
      <button
        className="triage-btn dismiss"
        onClick={() => setOpen(open === 'dismiss' ? null : 'dismiss')}
      >
        Dismiss
      </button>

      {open === 'accept' && (
        <div className="menu">
          {sorted.map((p) => (
            <button key={p} className="menu-item" onClick={() => (setOpen(null), onAccept(p))}>
              {label[p]}
              {suggested === p ? ' · suggested' : ''}
            </button>
          ))}
        </div>
      )}
      {open === 'dismiss' && (
        <div className="menu right">
          {dismissOptions().map((o) => (
            <button
              key={o.label}
              className={`menu-item ${o.remindAt === null ? 'muted' : ''}`}
              onClick={() => (setOpen(null), onDismiss(o.remindAt))}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Backburner (clock) menu for accepted items ----------

export function TimerMenu({
  onDismiss
}: {
  onDismiss: (remindAt: number | null) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" title="Backburner" onClick={() => setOpen(!open)}>
        ◷
      </button>
      {open && (
        <div className="menu right">
          {dismissOptions().map((o) => (
            <button
              key={o.label}
              className={`menu-item ${o.remindAt === null ? 'muted' : ''}`}
              onClick={() => (setOpen(false), onDismiss(o.remindAt))}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Priority editor for accepted items ----------

export function PriorityMenu({
  value,
  onChange
}: {
  value: Priority | null
  onChange: (p: Priority) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const label: Record<Priority, string> = { high: 'High', med: 'Medium', low: 'Low' }
  return (
    <div className="menu-wrap" ref={ref}>
      <button className={`prio-chip ${value ?? ''}`} onClick={() => setOpen(!open)}>
        {value ? label[value] : 'Set priority'}
      </button>
      {open && (
        <div className="menu">
          {(['high', 'med', 'low'] as Priority[]).map((p) => (
            <button key={p} className="menu-item" onClick={() => (setOpen(false), onChange(p))}>
              {label[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
