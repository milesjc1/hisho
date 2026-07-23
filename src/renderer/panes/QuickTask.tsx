import { useEffect, useRef, useState } from 'react'
import {
  ALL_CONNECTIONS,
  CONNECTION_LABELS,
  MODEL_LABELS,
  type Connection,
  type ModelAlias
} from '../../shared/types'
import { Button, Chip, Field, PaneHeader, Select, TextArea } from '../ui'

const MODELS: ModelAlias[] = ['sonnet', 'opus', 'haiku']

export default function QuickTask(): JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ModelAlias>('sonnet')
  const [connections, setConnections] = useState<Connection[]>(['microsoft365', 'slack', 'linear'])
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [cost, setCost] = useState<number | null>(null)
  const outRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const off = window.hisho.onTaskText(({ chunk }) => {
      setOutput((prev) => (prev ? prev + '\n\n' : '') + chunk)
    })
    return off
  }, [])

  useEffect(() => {
    outRef.current?.scrollTo(0, outRef.current.scrollHeight)
  }, [output])

  function toggle(c: Connection): void {
    setConnections((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function run(): Promise<void> {
    if (!prompt.trim() || running) return
    setRunning(true)
    setOutput('')
    setCost(null)
    try {
      const res = await window.hisho.runTask({ prompt, model, connections })
      if (!res.ok) setOutput((o) => o + `\n\n[error] ${res.error ?? 'unknown'}`)
      else if (res.text && !output) setOutput(res.text)
      setCost(res.costUsd ?? null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="pane">
      <PaneHeader
        title="Quick Task"
        subtitle="Fire a one-off task at Claude — draft a reply, write a ticket, triage something."
      />

      <TextArea
        placeholder="e.g. Draft a reply to the latest email from Dana about the Q3 rollout…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />

      <div className="qt-controls">
        <Field label="Model">
          <Select value={model} onChange={(e) => setModel(e.target.value as ModelAlias)}>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {MODEL_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="qt-conns">
          <span>Connections</span>
          <div className="row">
            {ALL_CONNECTIONS.map((c) => (
              <Chip key={c} active={connections.includes(c)} onClick={() => toggle(c)}>
                {CONNECTION_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="qt-run">
          <Button variant="primary" onClick={run} disabled={running || !prompt.trim()}>
            {running ? 'Running…' : 'Run'}
          </Button>
        </div>
      </div>

      {(output || running) && (
        <pre className="output" ref={outRef}>
          {output || 'Working…'}
        </pre>
      )}
      {cost !== null && <div className="cost">cost: ${cost.toFixed(4)}</div>}
    </div>
  )
}
