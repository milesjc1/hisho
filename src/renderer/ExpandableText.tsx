import { useState } from 'react'
import { expandableText } from './lib'
import RichText from './RichText'

interface Props {
  snippet: string | null
  body: string | null
  className?: string
}

/** Description text with a "See more" toggle when the full body runs longer
 * than the preview snippet. Renders nothing when there's no text at all. */
export default function ExpandableText({ snippet, body, className }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const { text, hasMore } = expandableText(snippet, body, expanded)
  if (!text) return null
  return (
    <div className={className}>
      <span className={`desc-text${expanded ? ' expanded' : ''}`}>
        <RichText text={text} />
      </span>
      {hasMore && (
        <button className="see-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  )
}
