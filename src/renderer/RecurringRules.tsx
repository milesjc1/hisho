import { useEffect, useState } from 'react'
import type { Priority, RecurringRule, RecurringRuleInput } from '../shared/types'
import { FREQUENCY_PRESETS } from '../shared/types'
import { Button, Field, TextInput, Select } from './ui'

const api = window.hisho

const BLANK: RecurringRuleInput = {
  title: '',
  cron: FREQUENCY_PRESETS[0].cron,
  lead_days: 5,
  default_priority: 'med'
}

export default function RecurringRules(): JSX.Element {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [form, setForm] = useState<RecurringRuleInput | null>(null)
  const [editId, setEditId] = useState<number | null>(null)

  const load = (): void => {
    void api.listRules().then(setRules)
  }
  useEffect(load, [])

  const save = (): void => {
    if (!form || !form.title.trim()) return
    const p =
      editId != null ? api.updateRule(editId, form) : api.createRule(form)
    void Promise.resolve(p).then(() => {
      setForm(null)
      setEditId(null)
      load()
    })
  }

  const edit = (r: RecurringRule): void => {
    setEditId(r.id)
    setForm({
      title: r.title,
      cron: r.cron,
      lead_days: r.lead_days,
      default_priority: r.default_priority
    })
  }

  const remove = (id: number): void => {
    void api.deleteRule(id).then(load)
  }

  return (
    <div className="view">
      <div className="view-head">
        <h2>Recurring tasks</h2>
        {!form && (
          <Button variant="primary" onClick={() => (setEditId(null), setForm({ ...BLANK }))}>
            New rule
          </Button>
        )}
      </div>

      {form && (
        <div className="rule-form">
          <Field label="Title">
            <TextInput
              value={form.title}
              placeholder="e.g. Quarterly product survey"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <div className="rule-form-row">
            <Field label="Schedule">
              <Select
                value={form.cron}
                onChange={(e) => setForm({ ...form, cron: e.target.value })}
              >
                {FREQUENCY_PRESETS.map((f) => (
                  <option key={f.id} value={f.cron}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lead time (days before due)">
              <TextInput
                type="number"
                min={0}
                value={form.lead_days}
                onChange={(e) => setForm({ ...form, lead_days: Number(e.target.value) })}
              />
            </Field>
            <Field label="Default priority">
              <Select
                value={form.default_priority}
                onChange={(e) =>
                  setForm({ ...form, default_priority: e.target.value as Priority })
                }
              >
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </Select>
            </Field>
          </div>
          <div className="rule-form-actions">
            <Button variant="ghost" onClick={() => (setForm(null), setEditId(null))}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!form.title.trim()}>
              {editId != null ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {rules.length === 0 && !form && (
        <div className="feed-empty">
          No recurring tasks yet. They spawn a feed item ahead of each due date.
        </div>
      )}

      <div className="rule-list">
        {rules.map((r) => (
          <div key={r.id} className="rule-item">
            <div>
              <div className="rule-title">{r.title}</div>
              <div className="rule-meta">
                {FREQUENCY_PRESETS.find((f) => f.cron === r.cron)?.label ?? r.cron} · lead{' '}
                {r.lead_days}d · {r.default_priority}
              </div>
            </div>
            <div className="rule-actions">
              <Button size="sm" variant="ghost" onClick={() => edit(r)}>
                Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(r.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
