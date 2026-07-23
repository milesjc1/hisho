import { useEffect, useState } from 'react'
import {
  ALL_CONNECTIONS,
  CONNECTION_LABELS,
  FREQUENCY_PRESETS,
  MODEL_LABELS,
  type Connection,
  type ModelAlias,
  type ReminderInput,
  type ReminderRow
} from '../../shared/types'
import { Badge, Button, Card, Chip, EmptyState, Field, PaneHeader, Select, TextArea, TextInput } from '../ui'

const MODELS: ModelAlias[] = ['sonnet', 'opus', 'haiku']

function freqLabel(cron: string): string {
  return FREQUENCY_PRESETS.find((f) => f.cron === cron)?.label ?? cron
}

const BLANK: ReminderInput = {
  title: '',
  prompt: '',
  model: 'sonnet',
  connections: ['microsoft365', 'slack', 'linear'],
  cron: FREQUENCY_PRESETS[2].cron // daily
}

export default function Reminders(): JSX.Element {
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const [editing, setEditing] = useState<ReminderInput | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function refresh(): Promise<void> {
    setReminders(await window.hisho.listReminders())
  }

  useEffect(() => {
    void refresh()
    return window.hisho.onRemindersChanged(() => void refresh())
  }, [])

  function startNew(): void {
    setEditingId(null)
    setEditing({ ...BLANK })
  }

  function startEdit(r: ReminderRow): void {
    setEditingId(r.id)
    setEditing({
      title: r.title,
      prompt: r.prompt,
      model: r.model as ModelAlias,
      connections: JSON.parse(r.connections),
      cron: r.cron
    })
  }

  async function save(): Promise<void> {
    if (!editing || !editing.title.trim() || !editing.prompt.trim()) return
    if (editingId === null) await window.hisho.createReminder(editing)
    else await window.hisho.updateReminder(editingId, editing)
    setEditing(null)
    setEditingId(null)
    await refresh()
  }

  if (editing) {
    return (
      <div className="pane">
        <PaneHeader title={editingId === null ? 'New reminder' : 'Edit reminder'} />
        <div className="rem-form">
          <Field label="Title">
            <TextInput
              value={editing.title}
              placeholder="e.g. Clean up Linear backlog"
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </Field>
          <Field label="Workflow" hint="What Claude should check/prepare each time it fires.">
            <TextArea
              rows={4}
              value={editing.prompt}
              placeholder="e.g. Review my Linear issues; list stale ones with no update in 2 weeks and suggest what to close or re-prioritize."
              onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
            />
          </Field>
          <div className="rem-form-row">
            <Field label="Model">
              <Select
                value={editing.model}
                onChange={(e) => setEditing({ ...editing, model: e.target.value as ModelAlias })}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Frequency">
              <Select
                value={editing.cron}
                onChange={(e) => setEditing({ ...editing, cron: e.target.value })}
              >
                {FREQUENCY_PRESETS.map((f) => (
                  <option key={f.id} value={f.cron}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Connections">
            <div className="chip-row">
              {ALL_CONNECTIONS.map((c) => (
                <Chip
                  key={c}
                  active={editing.connections.includes(c)}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      connections: editing.connections.includes(c)
                        ? editing.connections.filter((x) => x !== c)
                        : [...editing.connections, c]
                    })
                  }
                >
                  {CONNECTION_LABELS[c as Connection]}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="rem-form-actions">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={!editing.title.trim() || !editing.prompt.trim()}
            >
              {editingId === null ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pane">
      <PaneHeader
        title="Reminders"
        subtitle="Recurring workflows that nag you — escalating until you mark them done."
        actions={
          <Button variant="primary" onClick={startNew}>
            + New reminder
          </Button>
        }
      />

      {reminders.length === 0 ? (
        <EmptyState
          title="No reminders yet"
          hint="Create one to have Claude check in on recurring work and nag you until it's done."
          action={<Button variant="primary" onClick={startNew}>+ New reminder</Button>}
        />
      ) : (
        <div className="rem-list">
          {reminders.map((r) => (
            <ReminderCard
              key={r.id}
              r={r}
              onEdit={() => startEdit(r)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReminderCard({
  r,
  onEdit,
  onRefresh
}: {
  r: ReminderRow
  onEdit: () => void
  onRefresh: () => Promise<void>
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const active = !r.done && r.escalation_level > 0

  return (
    <Card>
      <div className="rem-head">
        <div className="rem-title">
          <strong>{r.title}</strong>
          {r.done ? (
            <Badge tone="success">done</Badge>
          ) : active ? (
            <Badge tone={r.escalation_level >= 3 ? 'danger' : 'warn'}>
              nagging ×{r.escalation_level}
            </Badge>
          ) : (
            <Badge tone="neutral">scheduled</Badge>
          )}
        </div>
        <span className="rem-freq">{freqLabel(r.cron)}</span>
      </div>

      {r.last_suggestion && (
        <div className="rem-suggestion">
          <button className="rem-toggle" onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'} Suggested action
          </button>
          {open && <pre className="rem-suggestion-body">{r.last_suggestion}</pre>}
        </div>
      )}

      <div className="rem-actions">
        <Button size="sm" onClick={() => window.hisho.runReminderNow(r.id)}>
          Run now
        </Button>
        {r.done ? (
          <Button
            size="sm"
            onClick={async () => {
              await window.hisho.markReminderDone(r.id, false)
              await onRefresh()
            }}
          >
            Reopen
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              await window.hisho.markReminderDone(r.id, true)
              await onRefresh()
            }}
          >
            Mark done
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await window.hisho.deleteReminder(r.id)
            await onRefresh()
          }}
        >
          Delete
        </Button>
      </div>
    </Card>
  )
}
