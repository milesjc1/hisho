import { Notification } from 'electron'
import { join } from 'path'
import { forceWindowOpen, navigateTo } from './window'
import type { ReminderRow } from '../shared/types'

const ICON = join(__dirname, '../../resources', 'icon.png')

/**
 * Fire a desktop notification for a reminder at its current escalation level:
 *   1 → single toast
 *   2 → toast (repeat)
 *   3+ → toast + force the window open
 */
export function notifyReminder(reminder: ReminderRow, level: number): void {
  const suggestion = (reminder.last_suggestion ?? '').trim()
  const preview = suggestion.length > 180 ? suggestion.slice(0, 180) + '…' : suggestion

  const body =
    level >= 3
      ? `Still not done (nagged ${level}×). ${preview}`
      : level === 2
        ? `Reminder — still pending. ${preview}`
        : preview || 'Time to take care of this.'

  if (Notification.isSupported()) {
    const n = new Notification({
      title: level >= 3 ? `⚠ ${reminder.title}` : reminder.title,
      body,
      icon: ICON,
      urgency: level >= 3 ? 'critical' : 'normal'
    })
    n.on('click', () => navigateTo('reminders'))
    n.show()
  }

  if (level >= 3) forceWindowOpen()
}

/** Generic toast (used by the message aggregator too). */
export function notify(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, icon: ICON })
  if (onClick) n.on('click', onClick)
  n.show()
}
