import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { ActiveTurn, Message } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import '../components/GameCard.css'
import './Turn.css'

interface TurnProps {
  sessionId: string
  turn: ActiveTurn
  onTurnEnded: () => void
}

const TOAST_DURATION_MS = 2800

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Turn({ sessionId, turn, onTurnEnded }: TurnProps) {
  const [messages, setMessages] = useState<Message[]>([turn.firstMessage])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // "+1 carte dans ta collection": the id restarts the animation when cards come in a row
  const [toast, setToast] = useState<{ id: number; count: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'end' })
  }, [messages, waiting])

  // Hide the toast after a while
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  async function send(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || waiting) return

    setMessages((current) => [...current, { author: 'user', text }])
    setDraft('')
    setWaiting(true)
    setError(null)
    try {
      const response = await api.sendMessage(sessionId, turn.turnId, text)
      setMessages((current) => [...current, response.message])
      const added = response.newEntries?.length ?? 0
      if (added > 0) setToast((current) => ({ id: (current?.id ?? 0) + 1, count: added }))
      if (response.turnEnded) setEnded(true)
    } catch {
      // Give the text back so nothing is lost
      setMessages((current) => current.slice(0, -1))
      setDraft(text)
      setError('Ton message n’est pas parti. Réessaie !')
    } finally {
      setWaiting(false)
      inputRef.current?.focus()
    }
  }

  return (
    <main className={`turn ${cardColorClass(turn.card)}`} onKeyDown={moveFocusWithArrows}>
      <aside className="turn-card floating" aria-label="Carte choisie">
        <span className="turn-card-title">{turn.card.title}</span>
        <span className="turn-card-brand">ptv</span>
      </aside>

      <section className="turn-chat">
        <div className="turn-messages" role="log" aria-live="polite">
          {messages.map((message, index) => (
            <p key={index} className={`bubble bubble-${message.author}`}>
              {message.text}
            </p>
          ))}
          {waiting && (
            <p className="bubble bubble-assistant bubble-typing" aria-label="En train d’écrire">
              <span />
              <span />
              <span />
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="turn-error" role="alert">
            {error}
          </p>
        )}

        {ended ? (
          <button className="btn turn-next" onClick={onTurnEnded} autoFocus>
            Piocher la suite
          </button>
        ) : (
          <form className="turn-form" onSubmit={send}>
            {/* TODO: microphone button (speech to text) */}
            <input
              ref={inputRef}
              className="turn-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écris ta réponse…"
              aria-label="Ta réponse"
              autoFocus
            />
            <button className="btn" type="submit" disabled={waiting || !draft.trim()}>
              Envoyer
            </button>
          </form>
        )}
      </section>

      <div className="turn-toast-zone" role="status">
        {toast && (
          <p key={toast.id} className="turn-toast">
            +{toast.count} carte{toast.count > 1 ? 's' : ''} dans ta collection
          </p>
        )}
      </div>
    </main>
  )
}
