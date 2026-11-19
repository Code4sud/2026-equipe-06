import { useRef, type CSSProperties, type PointerEvent } from 'react'
import type { Card } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { prefersReducedMotion } from '../utils/viewTransition'
import { Asterisk, Flower, Star, Triangle } from './Shapes'
import './GameCard.css'

/** Maximum tilt in degrees, kept very light */
const MAX_TILT_DEG = 7

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
  const tiltRef = useRef<HTMLSpanElement>(null)

  // The card leans toward the pointer and the light reflection follows it.
  // Written straight on the element (no re-render on every move).
  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const tilt = tiltRef.current
    if (!tilt || !revealed || disabled || prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    tilt.style.setProperty('--tilt-x', `${-(y - 0.5) * 2 * MAX_TILT_DEG}deg`)
    tilt.style.setProperty('--tilt-y', `${(x - 0.5) * 2 * MAX_TILT_DEG}deg`)
    tilt.style.setProperty('--glare-x', `${x * 100}%`)
    tilt.style.setProperty('--glare-y', `${y * 100}%`)
  }

  function handlePointerLeave() {
    // Back to the values from the CSS (flat card, or the keyboard selection pose)
    const tilt = tiltRef.current
    if (!tilt) return
    for (const name of ['--tilt-x', '--tilt-y', '--glare-x', '--glare-y']) tilt.style.removeProperty(name)
  }

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
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label={revealed ? card.title : 'Carte retournée'}
    >
      <span className="game-card-tilt" ref={tiltRef}>
        <span className="game-card-inner">
          <span className="game-card-face game-card-back" aria-hidden="true">
            <Asterisk className="game-card-back-asterisk" color={shapeColors[0]} outline />
            <Flower className="game-card-back-flower" color={shapeColors[1]} />
            <Triangle className="game-card-back-triangle" color={shapeColors[2]} outline strokeWidth={3} />
            <Star className="game-card-back-star" color={shapeColors[3]} />
            <span className="game-card-brand">ptv</span>
          </span>

          <span className="game-card-face game-card-front">
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
