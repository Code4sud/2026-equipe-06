import type { CSSProperties } from 'react'
import { useCardTilt } from '../hooks/useCardTilt'
import type { Card } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { Asterisk, Flower, Star, Triangle } from './Shapes'
import '../styles/cardShine.css'
import './GameCard.css'

interface GameCardProps {
  card: Card
  index: number
  revealed: boolean
  disabled?: boolean
  /** Thrown off screen to the left (-1) or right (1) when another card is chosen */
  discardDirection?: -1 | 1
  /** Position among the discarded cards, for the delay between each one */
  discardOrder?: number
  chosen?: boolean
  /** Shown as is, without the deal and flip animations (cards already drawn) */
  instant?: boolean
  onSelect: (card: Card) => void
  buttonRef?: React.Ref<HTMLButtonElement>
}

/** Redraw icon: two arrows chasing each other */
function RedrawIcon() {
  return (
    <svg className="game-card-redraw" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M52 24A22 22 0 0 0 14 20M12 40a22 22 0 0 0 38 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M54 8v18H36z M10 56V38h18z" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function GameCard({
  card,
  index,
  revealed,
  disabled,
  discardDirection,
  discardOrder,
  chosen,
  instant,
  onSelect,
  buttonRef,
}: GameCardProps) {
  const style = { '--card-index': index, '--discard-direction': discardDirection ?? 0,
    '--discard-order': discardOrder ?? 0,
  } as CSSProperties
  if (chosen) {
    // Morphs into the big card of the turn screen (View Transitions API)
    style.viewTransitionName = 'chosen-card'
  }
  // The card leans toward the pointer and the light reflection follows it
  const tilt = useCardTilt(revealed && !disabled)

  const isJoker = card.format === 'joker'
  // The joker's back is multicolor, the other cards' backs use their own color
  const shapeColors = isJoker
    ? ['var(--color-pink)', 'var(--color-orange)', 'var(--color-purple)', 'var(--color-green)']
    : Array(4).fill('var(--card-color)')

  return (
    <button
      ref={buttonRef}
      className={[
        'game-card',
        cardColorClass(card),
        revealed && 'is-revealed',
        discardDirection && 'is-discarded',
        chosen && 'is-chosen',
        instant && 'is-instant',
        isJoker && 'is-joker',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      disabled={disabled}
      onClick={() => onSelect(card)}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      aria-label={revealed ? card.title : 'Carte retournée'}
    >
      <span className="game-card-tilt" ref={tilt.ref}>
        <span className="game-card-inner">
          <span className="game-card-face game-card-back" aria-hidden="true">
            <Asterisk className="game-card-back-asterisk" color={shapeColors[0]} outline />
            <Flower className="game-card-back-flower" color={shapeColors[1]} />
            <Triangle className="game-card-back-triangle" color={shapeColors[2]} outline strokeWidth={3} />
            <Star className="game-card-back-star" color={shapeColors[3]} />
            <span className="game-card-brand">ptv</span>
          </span>

          <span className="game-card-face game-card-front card-shine">
            {isJoker && (
              <>
                {/* Brand shapes in the background, like everywhere else */}
                <Flower className="joker-shape joker-flower" color="var(--card-yellow-back)" />
                <Star className="joker-shape joker-star" color="var(--card-pink-back)" />
                <Triangle className="joker-shape joker-triangle" color="var(--card-purple-back)" outline strokeWidth={3} />
                <Asterisk className="joker-shape joker-asterisk" color="var(--card-green-back)" />
                <RedrawIcon />
              </>
            )}
            {card.image && <img className="game-card-image" src={card.image} alt="" />}
            <span className="game-card-title">{card.title}</span>
            <span className="game-card-brand">ptv</span>
          </span>
        </span>
      </span>
    </button>
  )
}
