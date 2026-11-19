import type { Card, CardFamily } from '../types'

export type CardColor = 'yellow' | 'pink' | 'purple' | 'green'

// TEMPORARY: 6 families but only 4 colors in the mockup. To be decided with the team.
const FAMILY_COLORS: Record<CardFamily, CardColor> = {
  passions: 'yellow',
  prides: 'pink',
  relationships: 'purple',
  challenges: 'green',
  dreams: 'pink',
  values: 'yellow',
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
