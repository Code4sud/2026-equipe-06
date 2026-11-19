// In-memory fake backend following the same contract as httpApi.
import type { Api } from './http'
import { ApiError } from './http'
import type { Card, CollectionEntry, Message } from '../types'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

const DECK: Card[] = [
  { id: 'c01', family: 'passions', format: 'text', title: 'Ton dernier week-end' },
  { id: 'c02', family: 'passions', format: 'text', title: 'Ce que tu regardes sur YouTube ou TikTok' },
  { id: 'c03', family: 'prides', format: 'text', title: 'Une fois où t’étais fier' },
  { id: 'c04', family: 'prides', format: 'text', title: 'Un truc que t’as appris tout seul' },
  { id: 'c05', family: 'relationships', format: 'text', title: 'La dernière fois qu’on t’a demandé de l’aide' },
  { id: 'c06', family: 'relationships', format: 'text', title: 'Quelqu’un qui compte sur toi' },
  { id: 'c07', family: 'challenges', format: 'text', title: 'Un truc que t’as réparé' },
  { id: 'c08', family: 'challenges', format: 'scenario', title: 'Naufragé sur une île avec 5 personnes : tu prends quel rôle ?' },
  { id: 'c09', family: 'dreams', format: 'persona', title: 'Raconte une journée de ta vie dans 10 ans' },
  { id: 'c10', family: 'values', format: 'choice', title: 'Plutôt réparer un objet ou expliquer un truc à quelqu’un ?' },
  { id: 'c11', family: 'values', format: 'text', title: 'Un truc qui te met en colère quand c’est injuste' },
]

/** Final card, imposed alone once enough turns have been played */
const MIRROR_CARD: Card = {
  id: 'mirror',
  family: 'values',
  format: 'mirror',
  title: 'Le miroir : qu’est-ce que t’as appris sur toi ?',
}
const TURNS_BEFORE_MIRROR = 3

// Mirror turn: the user first picks cards from the collection, then sums up. The agent only asks
const MIRROR_SCRIPT = [
  'Dernière carte : le miroir. Cette fois, c’est toi qui parles de toi. Pour commencer, choisis dans ta collection les cartes qui te ressemblent le plus.',
  'Pourquoi celles-là ?',
  'Et si tu devais raconter à un pote ce que t’as découvert sur toi aujourd’hui, tu dirais quoi ?',
]

const FOLLOW_UPS = [
  'Ok, raconte-moi un peu. Ça s’est passé comment ?',
  'Et toi, concrètement, tu t’y es pris comment ?',
  'Franchement, c’est pas rien. Qu’est-ce qui était le plus dur ?',
]


// Fake findings handed out in order: mostly past experiences and know-how, a few qualities
const SKILL_NAMES = [
  'Garde d’enfants',
  'Réparation mécanique (scooters)',
  'Gestion d’une caisse',
  'Montage vidéo',
  'Patience',
  'Organisation d’un événement',
  'Cuisine pour un groupe',
  'Médiation entre potes',
]

// The agent "keeps" the 1st and 3rd answers of each turn
const ANSWERS_WORTH_KEEPING = [1, 3]

interface MockTurn {
  card: Card
  userMessages: string[]
}

interface MockSession {
  drawnCardIds: Set<string>
  turns: Map<string, MockTurn>
  collection: CollectionEntry[]
  mirrorSelection?: string[]
}

const sessionsByEmail = new Map<string, string>()
const sessions = new Map<string, MockSession>()

function getSessionOrThrow(sessionId: string): MockSession {
  const session = sessions.get(sessionId)
  if (!session) throw new ApiError(404, `/sessions/${sessionId}`)
  return session
}

function getTurnOrThrow(sessionId: string, turnId: string): MockTurn {
  const turn = getSessionOrThrow(sessionId).turns.get(turnId)
  if (!turn) throw new ApiError(404, `/sessions/${sessionId}/turns/${turnId}`)
  return turn
}

export const mockApi: Api = {
  async requestCode() {
    await delay()
  },

  async createSession(email) {
    await delay()
    // Demo: any code is accepted
    const existingId = sessionsByEmail.get(email)
    if (existingId) return { sessionId: existingId, isNew: false, state: 'drawing' }

    const sessionId = crypto.randomUUID()
    sessionsByEmail.set(email, sessionId)
    sessions.set(sessionId, { drawnCardIds: new Set(), turns: new Map(), collection: [] })
    return { sessionId, isNew: true, state: 'drawing' }
  },

  async getSession(sessionId) {
    await delay()
    const session = getSessionOrThrow(sessionId)
    return { state: 'drawing', collection: session.collection, turnsCount: session.turns.size }
  },

  async drawCards(sessionId) {
    await delay()
    const session = getSessionOrThrow(sessionId)
    if (session.turns.size >= TURNS_BEFORE_MIRROR) return [MIRROR_CARD]

    let available = DECK.filter((card) => !session.drawnCardIds.has(card.id))
    // 4 cards: the front adds the joker as the 5th one
    if (available.length < 4) {
      session.drawnCardIds.clear()
      available = DECK
    }
    const drawn = [...available].sort(() => Math.random() - 0.5).slice(0, 4)
    drawn.forEach((card) => session.drawnCardIds.add(card.id))
    return drawn
  },

  async startTurn(sessionId, cardId) {
    await delay()
    const session = getSessionOrThrow(sessionId)
    const card = cardId === MIRROR_CARD.id ? MIRROR_CARD : DECK.find((c) => c.id === cardId)
    if (!card) throw new ApiError(404, `/cards/${cardId}`)
    const turnId = crypto.randomUUID()
    session.turns.set(turnId, { card, userMessages: [] })
    if (card.format === 'mirror') {
      return { turnId, message: { author: 'assistant', text: MIRROR_SCRIPT[0] }, pickFromCollection: true }
    }
    return { turnId, message: { author: 'assistant', text: `${card.title}… vas-y, raconte !` } }
  },

  async sendMessage(sessionId, turnId, text, selectedEntryIds) {
    await delay(700)
    const session = getSessionOrThrow(sessionId)
    const turn = getTurnOrThrow(sessionId, turnId)
    turn.userMessages.push(text)
    const answerNumber = turn.userMessages.length

    // Mirror: the first message carries the picked cards, then the user explains and sums up
    if (turn.card.format === 'mirror') {
      if (selectedEntryIds) session.mirrorSelection = selectedEntryIds
      const turnEnded = answerNumber >= MIRROR_SCRIPT.length
      const message: Message = {
        author: 'assistant',
        text: turnEnded ? 'Merci. À mon tour de te montrer ce que j’ai repéré.' : MIRROR_SCRIPT[answerNumber],
      }
      return { message, turnEnded }
    }

    const newEntries: CollectionEntry[] = []
    if (ANSWERS_WORTH_KEEPING.includes(answerNumber)) {
      newEntries.push({
        id: crypto.randomUUID(),
        card: turn.card,
        quote: text,
        skill: SKILL_NAMES[session.collection.length % SKILL_NAMES.length],
        status: 'proposed',
      })
      session.collection.push(...newEntries)
    }

    const turnEnded = answerNumber > FOLLOW_UPS.length
    const message: Message = {
      author: 'assistant',
      text: turnEnded ? 'Merci de m’avoir raconté ça. On pioche la suite ?' : FOLLOW_UPS[answerNumber - 1],
    }
    return newEntries.length > 0 ? { message, turnEnded, newEntries } : { message, turnEnded }
  },

  async getCollection(sessionId) {
    await delay(300)
    return getSessionOrThrow(sessionId).collection
  },

  async updateEntry(sessionId, entryId, update) {
    await delay(200)
    const entry = getSessionOrThrow(sessionId).collection.find((e) => e.id === entryId)
    if (!entry) throw new ApiError(404, `/sessions/${sessionId}/collection/${entryId}`)
    Object.assign(entry, update)
    return entry
  },

  async getSummary(sessionId) {
    await delay()
    const kept = getSessionOrThrow(sessionId).collection.filter((e) => e.status !== 'rejected')
    return {
      overview:
        'Tu as raconté plein de moments où tu prends des responsabilités et où tu te débrouilles. Merci pour tout ça, et reviens quand tu veux.',
      collection: kept,
      personalityCards: [
        {
          id: 'p1',
          title: 'On peut compter sur toi',
          description: 'Quand quelqu’un a besoin d’aide, tu es là.',
          evidence: kept[0]?.quote ?? 'je l’ai aidé à réparer son vélo',
        },
        {
          id: 'p2',
          title: 'Trouve une solution quand ça coince',
          description: 'Tu cherches, tu essaies, tu y arrives.',
          evidence: kept[1]?.quote ?? 'j’ai regardé des tutos et j’ai essayé',
        },
      ],
      suggestions: ['Animer des activités pour des jeunes', 'Réparer et entretenir des vélos', 'Accueillir du public'],
      crossings: [
        { kind: 'match', text: 'Le rapport parle d’aide aux autres, et tu m’as parlé de ton voisin.' },
        { kind: 'gap', text: 'Le rapport parle de chiffres, on n’en a pas parlé : à toi de voir.' },
      ],
      sensitiveMentions: ['je porte le voile'],
    }
  },

  async suggestWithMentions(sessionId, mentions) {
    await delay()
    getSessionOrThrow(sessionId)
    return {
      suggestions: [
        'Animer des activités pour des jeunes',
        'Réparer et entretenir des vélos',
        `Accueillir du public, en tenant compte de « ${mentions[0]} »`,
      ],
    }
  },
}
