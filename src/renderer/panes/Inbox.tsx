import { useEffect, useState } from 'react'
import type { MessageRow } from '../../shared/types'
import { Badge, Button, Card, EmptyState, PaneHeader } from '../ui'

const SOURCE_TONE: Record<string, 'accent' | 'success' | 'warn' | 'neutral'> = {
  slack: 'accent',
  teams: 'warn',
  outlook: 'success'
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function Inbox(): JSX.Element {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function refresh(): Promise<void> {
    setMessages(await window.hisho.listMessages())
  }

  useEffect(() => {
    void refresh()
    return window.hisho.onMessagesChanged(() => void refresh())
  }, [])

  async function checkNow(): Promise<void> {
    setRefreshing(true)
    try {
      await window.hisho.refreshMessages()
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const pending = messages.filter((m) => !m.responded)

  return (
    <div className="pane">
      <PaneHeader
        title="Inbox"
        subtitle="Messages across Teams, Slack and Outlook that need your reply."
        actions={
          <Button onClick={checkNow} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Check now'}
          </Button>
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          hint="New messages needing a reply show up here. Hisho checks automatically every few minutes."
        />
      ) : (
        <div className="msg-list">
          {pending.map((m) => (
            <MessageCard key={m.id} m={m} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}

function MessageCard({
  m,
  onRefresh
}: {
  m: MessageRow
  onRefresh: () => Promise<void>
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)

  useEffect(() => {
    if (!m.seen) void window.hisho.markMessageSeen(m.id)
  }, [m.id, m.seen])

  async function makeDraft(): Promise<void> {
    setDrafting(true)
    try {
      setDraft(await window.hisho.draftReply(m.id))
    } finally {
      setDrafting(false)
    }
  }

  return (
    <Card>
      <div className="msg-head">
        <div className="msg-meta">
          <Badge tone={SOURCE_TONE[m.source] ?? 'neutral'}>{m.source}</Badge>
          <strong>{m.sender || 'Unknown'}</strong>
          <span className="msg-time">{timeAgo(m.ts)}</span>
        </div>
        {m.url && (
          <a className="msg-open" href={m.url} target="_blank" rel="noreferrer">
            Open
          </a>
        )}
      </div>

      <p className="msg-snippet">{m.snippet}</p>

      {draft !== null && <pre className="msg-draft">{drafting ? 'Drafting…' : draft}</pre>}

      <div className="msg-actions">
        <Button size="sm" variant="primary" onClick={makeDraft} disabled={drafting}>
          {drafting ? 'Drafting…' : draft === null ? 'Draft reply' : 'Redraft'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await window.hisho.markMessageResponded(m.id)
            await onRefresh()
          }}
        >
          Mark responded
        </Button>
      </div>
    </Card>
  )
}
