import { it, expect } from 'vitest'
import { blockText, slackTitle, slackDescriptor, slackAppLink, slackAfterDate } from './slack'

it('slackAfterDate returns the UTC day-floor (YYYY-MM-DD) of the cutoff', () => {
  expect(slackAfterDate(Date.parse('2026-07-30T12:34:56.000Z'))).toBe('2026-07-30')
  expect(slackAfterDate(Date.parse('2026-01-05T00:00:00.000Z'))).toBe('2026-01-05')
})

it('slackAppLink builds a team-scoped deep link that jumps to the exact message', () => {
  expect(slackAppLink('T079URTDHBP', 'D0BL9A4M1C3', '1785429625.774749')).toBe(
    'slack://channel?team=T079URTDHBP&id=D0BL9A4M1C3&message=1785429625.774749'
  )
})

it('slackAppLink omits team when unknown (still targets the channel + message)', () => {
  expect(slackAppLink(undefined, 'C123', '1.2')).toBe('slack://channel?id=C123&message=1.2')
})

it('slackTitle names the human or bot sender', () => {
  expect(slackTitle({ username: 'kris.johnson' })).toBe('Message from kris.johnson')
  expect(slackTitle({ username: 'linear' })).toBe('Message from linear')
})

it('slackTitle falls back to user id, then a generic name', () => {
  expect(slackTitle({ user: 'U07B9RCRUMU' })).toBe('Message from U07B9RCRUMU')
  expect(slackTitle({})).toBe('Message from someone')
})

it('slackDescriptor labels DM / group chat / channel', () => {
  expect(slackDescriptor({ is_im: true, name: 'U07BP9QRZ3R' })).toBe('DM')
  expect(slackDescriptor({ is_mpim: true, name: 'mpdm-a--b--c-1' })).toBe('Group chat')
  expect(slackDescriptor({ is_channel: true, name: 'engineering' })).toBe('#engineering')
})

it('slackDescriptor never leaks a user-id channel name as #name', () => {
  // DMs report the other user id as channel.name — must not surface as "#U07..."
  expect(slackDescriptor({ is_im: true, name: 'U07BP9QRZ3R' })).toBe('DM')
})

it('slackDescriptor falls back to Channel when a channel has no name', () => {
  expect(slackDescriptor({ is_channel: true })).toBe('Channel')
})

it('returns top-level text as-is when present (human message)', () => {
  expect(blockText({ text: '  is selina on that chat  ' })).toBe('is selina on that chat')
})

it('extracts mrkdwn from a section block when text is empty (Linear)', () => {
  const match = {
    text: '',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Jesse Garcia* created an issue in the <https://linear.app/anglepoint/team/ANGL/all|Engineering> team'
        }
      }
    ]
  }
  expect(blockText(match)).toContain('*Jesse Garcia* created an issue')
  expect(blockText(match)).toContain('Engineering> team')
})

it('extracts context + section text and ignores actions/divider (microslack)', () => {
  const match = {
    text: '',
    blocks: [
      { type: 'context', elements: [{ type: 'mrkdwn', text: ':e-mail: Outlook  ·  *Azure DevOps*' }] },
      { type: 'section', text: { type: 'mrkdwn', text: '*[PR build failed] Elevate Work Item Check*\nBuild #Work Item Check failed' } },
      {
        type: 'actions',
        elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open' }, url: 'https://example.com' }]
      },
      { type: 'divider' }
    ]
  }
  const out = blockText(match)
  expect(out).toContain('Azure DevOps')
  expect(out).toContain('[PR build failed] Elevate Work Item Check')
  expect(out).not.toContain('Open') // button label skipped
})

it('folds in attachment text/pretext/fallback when present', () => {
  const match = {
    text: '',
    attachments: [{ pretext: 'heads up', text: 'the actual body', fallback: 'ignored fallback' }]
  }
  const out = blockText(match)
  expect(out).toContain('heads up')
  expect(out).toContain('the actual body')
})

it('returns empty string when no text, blocks, or attachments (caller applies fallback)', () => {
  expect(blockText({ text: '' })).toBe('')
  expect(blockText({})).toBe('')
})
