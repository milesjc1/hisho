import { useEffect, useRef, useState } from 'react'
import type { PullEvent } from '../shared/types'

const api = window.hisho
const MAX_LINES = 500

export default function PullLog(): JSX.Element | null {
  const [lines, setLines] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [seen, setSeen] = useState(false) // any run this session?
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return api.onPullEvent((ev: PullEvent) => {
      if (ev.type === 'start') {
        setLines([])
        setOpen(true)
        setRunning(true)
        setSeen(true)
      } else if (ev.type === 'line') {
        setLines((prev) => {
          const next = [...prev, ev.text]
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
        })
      } else {
        setRunning(false)
        setLines((prev) => [
          ...prev,
          ev.error
            ? `— failed: ${ev.error} —`
            : `— process exited (code ${ev.code}) —`
        ])
      }
    })
  }, [])

  // Auto-scroll to newest line while open.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines, open])

  if (!seen) return null

  return (
    <div className={`pulllog ${open ? 'open' : ''}`}>
      <div className="pulllog-head" onClick={() => setOpen((o) => !o)}>
        <span className="pulllog-title">
          {open ? '▼' : '▸'} Pull log{running ? ' · running…' : ''}
        </span>
        {open && (
          <button
            className="pulllog-x"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="pulllog-body" ref={bodyRef}>
          {lines.length === 0 ? (
            <div className="pulllog-line dim">waiting for output…</div>
          ) : (
            lines.map((l, i) => (
              <div key={i} className="pulllog-line">
                {l}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
