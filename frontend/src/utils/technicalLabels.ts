// Words of the technical sheet (summary screen and PDF): the same labels in both places.
// Written for an adviser or a psychologist: precise, never a judgment of the person.
import type { CardFamily, SkillStrength, TechnicalTurn } from '../types'

export const FAMILY_LABELS: Record<CardFamily, string> = {
  passions: 'Passions',
  prides: 'Fiertés',
  relationships: 'Relations',
  challenges: 'Défis',
  dreams: 'Projections',
  values: 'Valeurs',
}

export const STRENGTH_LABELS: Record<SkillStrength, string> = {
  transversal: 'Transversale',
  repeated: 'Récurrente',
  single: 'Ponctuelle',
}

export const STRENGTH_HINTS: Record<SkillStrength, string> = {
  transversal: 'racontée dans plusieurs thèmes de cartes',
  repeated: 'racontée dans plusieurs récits d’un même thème',
  single: 'racontée dans un seul récit',
}

/** What was observed in the exchange, not a trait of the person */
export const ENGAGEMENT_LABELS: Record<NonNullable<TechnicalTurn['engagement']>, string> = {
  open: 'Récit développé',
  neutral: 'Échange suivi',
  closed: 'Réponses brèves',
}

export const ENDED_BY_LABELS: Record<TechnicalTurn['endedBy'], string> = {
  completed: 'Menée à terme',
  skipped: 'Passée',
  to_summary: 'Arrêtée pour le bilan',
  stopped: 'Interrompue',
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

/** Average words per answer, rounded; a dash when there was no answer */
export function wordsPerAnswer(turn: TechnicalTurn): string {
  return turn.answers > 0 ? String(Math.round(turn.words / turn.answers)) : '—'
}

/** Method and limits: what the sheet is, how it is made, what it is not */
export const METHOD_POINTS = [
  'Source : une partie de Pioche ta voix, conversation libre avec un assistant (modèles de langage Mistral) à partir de cartes de questions.',
  'Chaque compétence s’appuie sur une phrase de la personne, citée mot pour mot et vérifiée automatiquement, puis gardée par elle au tri final.',
  'Rattachement au référentiel ROME 4.0 (France Travail) au niveau de la macro-compétence, en choisissant le libellé le plus littéral et le plus modeste.',
  'Récurrence : nombre de récits et de thèmes de cartes où une même compétence apparaît. C’est un comptage, pas une note de niveau.',
  'Déroulé : indicateurs d’un seul échange, qui dépendent de la carte, du moment et de l’aisance à l’oral ou à l’écrit. Ils ne décrivent pas la personne.',
  'Ce n’est ni un diagnostic, ni un test psychométrique, ni une évaluation : un support de discussion, à croiser avec l’entretien.',
  'Rien sur la santé, l’origine, la famille ou la religion n’est retenu, sauf ce que la personne a choisi de partager pour ses pistes.',
]
