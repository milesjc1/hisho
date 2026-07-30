import { prepareText, parseRichSegments, type Segment } from './rich-text'

function node(seg: Segment, i: number): JSX.Element {
  switch (seg.t) {
    case 'b':
      return <strong key={i}>{seg.v}</strong>
    case 'i':
      return <em key={i}>{seg.v}</em>
    case 'code':
      return <code key={i}>{seg.v}</code>
    case 's':
      return <s key={i}>{seg.v}</s>
    default:
      return <span key={i}>{seg.v}</span>
  }
}

/** Render message text with emoji + a small markdown subset (bold/italic/code/strike). */
export default function RichText({ text }: { text: string }): JSX.Element {
  return <>{parseRichSegments(prepareText(text)).map(node)}</>
}
