import type { DragEvent, ReactNode } from 'react'
import type { ItemState } from '../shared/types'

const api = window.hisho

interface Props {
  title: string
  count: number
  state: ItemState
  className?: string
  children: ReactNode
}

export default function Panel({ title, count, state, className, children }: Props): JSX.Element {
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
      className={`panel ${className ?? ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h4>
        {title} <span className="cnt">{count}</span>
      </h4>
      {children}
    </div>
  )
}
