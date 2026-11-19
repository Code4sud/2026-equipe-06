import type { Card, CardFamily } from '../types'

export type CardColor = 'yellow' | 'pink' | 'purple' | 'green' | 'blue' | 'orange'

// One color per family. The mockup had 4; blue and orange were added for dreams and values
const FAMILY_COLORS: Record<CardFamily, CardColor> = {
  passions: 'yellow',
  prides: 'pink',
  relationships: 'purple',
  challenges: 'green',
  dreams: 'blue',
  values: 'orange',
}

/**
 * CSS class setting --card-color, --card-face and --card-back (defined in GameCard.css).
 * The mirror and joker cards have their own look, whatever their family.
 */
export function cardColorClass(card: Card) {
  if (card.format === 'mirror') return 'game-card-mirror'
  if (card.format === 'joker') return 'game-card-joker'
  return `game-card-${FAMILY_COLORS[card.family]}`
}
