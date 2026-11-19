// Real calls to the Flask backend (proxied on /api by Vite in dev, VITE_API_URL once deployed).
import type {
  Card,
  CollectionEntry,
  EntryUpdate,
  LeaveResponse,
  SendMessageResponse,
  Session,
  SessionDetails,
  StartTurnResponse,
  Summary,
  SuggestionsResponse,
  Tone,
} from '../types'

export class ApiError extends Error {
  status: number

  constructor(status: number, path: string) {
    super(`API error ${status} on ${path}`)
    this.status = status
  }
}

// Deployed: the backend lives on another domain (VITE_API_URL). Locally: empty, Vite proxies /api
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) throw new ApiError(res.status, path)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const httpApi = {
  requestCode: (email: string) => request<void>('/auth/code', post({ email })),

  createSession: (email: string, code: string) => request<Session>('/sessions', post({ email, code })),

  getSession: (sessionId: string) => request<SessionDetails>(`/sessions/${sessionId}`),

  drawCards: (sessionId: string) => request<Card[]>(`/sessions/${sessionId}/draws`, { method: 'POST' }),

  startTurn: (sessionId: string, cardId: string) =>
    request<StartTurnResponse>(`/sessions/${sessionId}/turns`, post({ cardId })),

  sendMessage: (sessionId: string, turnId: string, text: string, selectedEntryIds?: string[]) =>
    request<SendMessageResponse>(
      `/sessions/${sessionId}/turns/${turnId}/messages`,
      post({ text, selectedEntryIds }),
    ),

  /** Passer: the conversation on this card stops (what was said is still analyzed) */
  skipTurn: (sessionId: string, turnId: string) =>
    request<LeaveResponse>(`/sessions/${sessionId}/turns/${turnId}/skip`, { method: 'POST' }),

  /** Passer au bilan: ends the card in progress if any, then the game goes straight to the summary */
  finishGame: (sessionId: string, turnId?: string) =>
    request<LeaveResponse>(`/sessions/${sessionId}/finish`, post({ turnId })),

  /** The assistant's words read aloud (mp3), or null when the voice is not available */
  speak: async (sessionId: string, text: string, tone: Tone = 'neutral'): Promise<Blob | null> => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, tone }),
    })
    return res.ok ? res.blob() : null
  },

  getCollection: (sessionId: string) => request<CollectionEntry[]>(`/sessions/${sessionId}/collection`),

  updateEntry: (sessionId: string, entryId: string, update: EntryUpdate) =>
    request<CollectionEntry>(`/sessions/${sessionId}/collection/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),

  getSummary: (sessionId: string) => request<Summary>(`/sessions/${sessionId}/summary`),

  /** The suggestions again, taking into account the mentions the user agreed to share. Nothing is stored */
  suggestWithMentions: (sessionId: string, mentions: string[]) =>
    request<SuggestionsResponse>(`/sessions/${sessionId}/summary/suggestions`, post({ mentions })),
}

export type Api = typeof httpApi
