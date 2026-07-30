import { it, expect } from 'vitest'
import { prepareText, parseRichSegments } from './rich-text'

it('parseRichSegments returns a single text segment for plain text', () => {
  expect(parseRichSegments('just words')).toEqual([{ t: 'text', v: 'just words' }])
})

it('parseRichSegments parses **bold**', () => {
  expect(parseRichSegments('**loud**')).toEqual([{ t: 'b', v: 'loud' }])
})

it('parseRichSegments parses *italic* and _italic_', () => {
  expect(parseRichSegments('*a*')).toEqual([{ t: 'i', v: 'a' }])
  expect(parseRichSegments('_b_')).toEqual([{ t: 'i', v: 'b' }])
})

it('parseRichSegments parses `code` and ~strike~', () => {
  expect(parseRichSegments('`x`')).toEqual([{ t: 'code', v: 'x' }])
  expect(parseRichSegments('~y~')).toEqual([{ t: 's', v: 'y' }])
})

it('parseRichSegments keeps surrounding text and mixes markers', () => {
  expect(parseRichSegments('hi **b** and *i* end')).toEqual([
    { t: 'text', v: 'hi ' },
    { t: 'b', v: 'b' },
    { t: 'text', v: ' and ' },
    { t: 'i', v: 'i' },
    { t: 'text', v: ' end' }
  ])
})

it('parseRichSegments does not treat ** as two italics', () => {
  expect(parseRichSegments('**both**')).toEqual([{ t: 'b', v: 'both' }])
})

it('prepareText converts emoji shortcodes to unicode', () => {
  expect(prepareText(':tada: done')).toBe('🎉 done')
})

it('prepareText cleans Slack links to their label or url', () => {
  expect(prepareText('see <https://linear.app/x|Engineering> now')).toBe('see Engineering now')
  expect(prepareText('bare <https://example.com>')).toBe('bare https://example.com')
})

it('prepareText leaves unknown/custom shortcodes untouched', () => {
  expect(prepareText(':blob-party: hey')).toBe(':blob-party: hey')
})
