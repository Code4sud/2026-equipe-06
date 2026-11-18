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

export interface Message {
  author: 'assistant' | 'user'
  text: string
}

/** Added silently by the agent when an answer is worth keeping as a skill */
export interface CollectionEntry {
  id: string
  /** The card the user was answering */
  card: Card
  /** Exact sentence from the user that made the agent keep it */
  quote: string
  /** Skill spotted, e.g. "Patience" */
  skill: string
  /** 'proposed' until the user validates it in the summary */
  status: EntryStatus
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
}

export interface SendMessageResponse {
  message: Message
  turnEnded: boolean
  /** Present when this message added at least one entry to the collection */
  newEntries?: CollectionEntry[]
  /** Mirror turn only: the front shows the collection so the user picks entries */
  pickFromCollection?: boolean
}

export interface EntryUpdate {
  status: EntryStatus
}

export interface PersonalityCard {
  id: string
  title: string
  description: string
}

export interface Summary {
  overview: string
  collection: CollectionEntry[]
  personalityCards: PersonalityCard[]
  suggestions: string[]
}

/** Front-only: the turn being played, kept in App state */
export interface ActiveTurn {
  turnId: string
  card: Card
  firstMessage: Message
}
