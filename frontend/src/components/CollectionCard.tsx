import type { CSSProperties } from 'react'
import type { CollectionEntry } from '../types'
import { cardColorClass } from '../utils/cardColors'
import './GameCard.css'
import './CollectionCard.css'

interface CollectionCardProps {
  entry: CollectionEntry
  /** Given in the mirror: the card becomes a toggle button */
  onToggle?: (entry: CollectionEntry) => void
  selected?: boolean
  /** Same name on two screens = the card moves from one place to the other (View Transitions) */
  transitionName?: string
  /** false: just shown, cannot be selected (cards kept during the mirror exchange) */
  focusable?: boolean
}

/** A collection entry: the card answered, the user's quote and what the agent spotted. */
export function CollectionCard({
  entry,
  onToggle,
  selected = false,
  transitionName,
  focusable = true,
}: CollectionCardProps) {
  const style: CSSProperties | undefined = transitionName ? { viewTransitionName: transitionName } : undefined
  const className = [
    'collection-card',
    cardColorClass(entry.card),
    selected && 'is-selected',
    !focusable && 'is-static',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="collection-card-theme">{entry.card.title}</span>
      <span className="collection-card-quote">« {entry.quote} »</span>
      <span className="collection-card-skill">{entry.skill}</span>
      {selected && (
        <span className="collection-card-check" aria-hidden="true">
          ✓
        </span>
      )}
    </>
  )

  if (onToggle) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        aria-pressed={selected}
        onClick={() => onToggle(entry)}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} style={style} tabIndex={focusable ? 0 : undefined}>
      {content}
    </div>
  )
}
