import { useState } from 'react'
import type { KeyboardEvent } from 'react'

const api = window.hisho

export default function AddManual(): JSX.Element {
  const [title, setTitle] = useState('')

  const add = async (): Promise<void> => {
    const t = title.trim()
    if (t) {
      await api.addManual(t)
      setTitle('')
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') void add()
  }

  return (
    <div className="add-manual">
      <input
        className="add-input"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <button className="btn" onClick={() => void add()}>
        Add
      </button>
    </div>
  )
}
