import { Notification } from 'electron'
import { join } from 'path'
import { showAndFocus } from './window'

const ICON = join(__dirname, '../../resources', 'icon.png')

/** Quiet, single desktop toast. Click brings the feed forward. */
export function notify(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, icon: ICON })
  n.on('click', () => (onClick ? onClick() : showAndFocus()))
  n.show()
}
