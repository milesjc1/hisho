import type { DragEvent, ReactNode } from 'react'
import type { ItemState } from '../shared/types'

const api = window.hisho

interface Props {
  title: string
  count: number
  state: ItemState
  icon: ReactNode
  accent?: boolean
  children: ReactNode
}

export default function Panel({ title, count, state, icon, accent, children }: Props): JSX.Element {
  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.classList.add('drop-hover')
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.currentTarget.classList.remove('drop-hover')
  }
  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.classList.remove('drop-hover')
    const id = e.dataTransfer.getData('text/plain')
    if (id) void api.setState(Number(id), state)
  }

  return (
    <div
      className={`panel ${accent ? 'accent' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="panel-head">
        <span className="panel-icon">{icon}</span>
        <span className="panel-title">{title}</span>
        <span className="panel-count">{count}</span>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}
