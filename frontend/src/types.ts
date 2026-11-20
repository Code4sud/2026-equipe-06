// API contract shared with the Flask backend. Keep in sync with the backend.

export type CardFamily = 'passions' | 'prides' | 'relationships' | 'challenges' | 'dreams' | 'values'
/** 'mirror' = the final card, imposed by the backend when it decides the game is over */
export type CardFormat = 'text' | 'visual' | 'scenario' | 'choice' | 'persona' | 'joker' | 'mirror'
export type EntryStatus = 'proposed' | 'kept' | 'rejected'
export type SessionState = 'drawing' | 'in_turn' | 'mirror' | 'summary'

export interface Card {
  id: string
  family: CardFamily
  format: CardFormat
  title: string
  image?: string
}

/** How the assistant's words are said aloud: enthusiastic only when what the user said deserves it */
export type Tone = 'neutral' | 'enthusiastic'

export interface Message {
  author: 'assistant' | 'user'
  text: string
  tone?: Tone
}

/** Added silently by the agent when an answer is worth keeping as a skill */
export interface CollectionEntry {
  id: string
  /** The card the user was answering */
  card: Card
  /** Exact sentence from the user that made the agent keep it */
  quote: string
  /**
   * What the agent spotted: mostly a past experience or know-how
   * ("Réparation mécanique", "Gestion d'une caisse"), sometimes a quality ("Patience")
   */
  skill: string
  /** 'proposed' until the user validates it in the summary */
  status: EntryStatus
  /** The official ROME skill matching the quote, for the adviser (shown small) */
  romeLabel?: string | null
  romeCode?: string | null
}

export interface Session {
  sessionId: string
  isNew: boolean
  state: SessionState
}

export interface SessionDetails {
  state: SessionState
  collection: CollectionEntry[]
  turnsCount: number
}

export interface StartTurnResponse {
  turnId: string
  message: Message
  /** Mirror turn: the user first picks cards from the collection, before the exchange */
  pickFromCollection?: boolean
}

export interface SendMessageResponse {
  message: Message
  turnEnded: boolean
  /** Present when this message added at least one entry to the collection */
  newEntries?: CollectionEntry[]
  /** Mirror turn only: the front shows the collection so the user picks entries */
  pickFromCollection?: boolean
  /** 'heavy': a heavy subject came up; 'distress': the game stops on a help message (3114, 112) */
  safety?: 'heavy' | 'distress'
}

export interface EntryUpdate {
  status: EntryStatus
}

export interface PersonalityCard {
  id: string
  title: string
  description: string
  /** Exact sentence of the user that backs the card */
  evidence: string
}

/** Where the report of the Centre des possibles and what the user told meet ('match') or differ ('gap') */
export interface Crossing {
  kind: 'match' | 'gap'
  text: string
}

/** A path to explore: what it is, why it fits what the user told, and a first small step */
export interface Suggestion {
  title: string
  why: string
  firstStep: string
}

export interface Summary {
  overview: string
  /** What the user said in the mirror, word for word: his own conclusions, shown first */
  mirrorWords: string[]
  /** The entries the user kept */
  collection: CollectionEntry[]
  personalityCards: PersonalityCard[]
  suggestions: Suggestion[]
  crossings: Crossing[]
  /** Questions the user could bring to his adviser at the Centre */
  advisorQuestions: string[]
  /**
   * What the user said himself about his health, religion or origin, in his words.
   * Never kept: the summary asks whether he wants it taken into account for the suggestions.
   */
  sensitiveMentions: string[]
  /** For an adviser or a psychologist: computed by the server from what is stored, without the AI */
  technical: TechnicalSheet
}

/** A kept entry as a proof of a skill: the user's sentence and where it was told */
export interface SkillEvidence {
  quote: string
  fact: string
  cardTitle: string
  family: CardFamily
}

/** single: told once; repeated: in several stories of one theme; transversal: across themes */
export type SkillStrength = 'single' | 'repeated' | 'transversal'

export interface TechnicalSkill {
  code: string
  label: string
  /** "Savoir-faire" or "Savoir-être" (ROME) */
  category: string
  domain: string
  issue: string
  objective: string
  strength: SkillStrength
  /** Number of different cards and card themes it was told in */
  cards: number
  families: number
  evidence: SkillEvidence[]
}

export interface TechnicalTurn {
  cardTitle: string
  family: CardFamily
  answers: number
  words: number
  /** How much the user opened up, as read by the end-of-turn analysis; null when not analyzed */
  engagement: 'open' | 'neutral' | 'closed' | null
  endedBy: 'completed' | 'skipped' | 'to_summary' | 'stopped'
  /** Entries kept from this card */
  kept: number
}

export interface TechnicalSheet {
  skills: TechnicalSkill[]
  /** Kept entries that no ROME skill fits */
  unmapped: SkillEvidence[]
  /** ROME domains with at least one skill, in ROME order */
  domains: { domain: string; skills: number; stories: number }[]
  /** Cards played, in order */
  turns: TechnicalTurn[]
  /** Subjects that caught the user's interest, worth another conversation */
  topics: string[]
}

/** Passer (a card) or Passer au bilan: entries found in what was said before leaving the card */
export interface LeaveResponse {
  newEntries?: CollectionEntry[]
}

export interface SuggestionsResponse {
  suggestions: Suggestion[]
}

/** Front-only: the turn being played, kept in App state */
export interface ActiveTurn {
  turnId: string
  card: Card
  firstMessage: Message
  pickFromCollection?: boolean
}
