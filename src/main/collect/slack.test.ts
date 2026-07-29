import { it, expect } from 'vitest'
import { blockText } from './slack'

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
