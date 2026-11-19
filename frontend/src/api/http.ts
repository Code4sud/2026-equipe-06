// Real calls to the Flask backend (proxied on /api by Vite in dev, VITE_API_URL once deployed).
import type {
  Card,
  CollectionEntry,
  EntryUpdate,
  SendMessageResponse,
  Session,
  SessionDetails,
  StartTurnResponse,
  Summary,
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

  getCollection: (sessionId: string) => request<CollectionEntry[]>(`/sessions/${sessionId}/collection`),

  updateEntry: (sessionId: string, entryId: string, update: EntryUpdate) =>
    request<CollectionEntry>(`/sessions/${sessionId}/collection/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),

  getSummary: (sessionId: string) => request<Summary>(`/sessions/${sessionId}/summary`),
}

export type Api = typeof httpApi
