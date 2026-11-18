import type { CSSProperties } from 'react'
import type { Card } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { Asterisk, Flower, Star, Triangle } from './Shapes'
import './GameCard.css'

interface GameCardProps {
  card: Card
  index: number
  revealed: boolean
  disabled?: boolean
  dimmed?: boolean
  chosen?: boolean
  /** Shown as is, without the deal and flip animations (cards already drawn) */
  instant?: boolean
  onSelect: (card: Card) => void
  buttonRef?: React.Ref<HTMLButtonElement>
}

export function GameCard({
  card,
  index,
  revealed,
  disabled,
  dimmed,
  chosen,
  instant,
  onSelect,
  buttonRef,
}: GameCardProps) {
  const style = { '--card-index': index } as CSSProperties

  return (
    <button
      ref={buttonRef}
      className={[
        'game-card',
        cardColorClass(card),
        revealed && 'is-revealed',
        dimmed && 'is-dimmed',
        chosen && 'is-chosen',
        instant && 'is-instant',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      disabled={disabled}
      onClick={() => onSelect(card)}
      aria-label={revealed ? card.title : 'Carte retournée'}
    >
      <span className="game-card-inner">
        <span className="game-card-face game-card-back" aria-hidden="true">
          <Asterisk className="game-card-back-asterisk" color="var(--card-color)" outline />
          <Flower className="game-card-back-flower" color="var(--card-color)" />
          <Triangle className="game-card-back-triangle" color="var(--card-color)" outline strokeWidth={3} />
          <Star className="game-card-back-star" color="var(--card-color)" />
          <span className="game-card-brand">ptv</span>
        </span>

        <span className="game-card-face game-card-front">
          {card.image && <img className="game-card-image" src={card.image} alt="" />}
          <span className="game-card-title">{card.title}</span>
          <span className="game-card-brand">ptv</span>
        </span>
      </span>
    </button>
  )
}
