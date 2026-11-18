import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { GameCard } from '../components/GameCard'
import type { ActiveTurn, Card } from '../types'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Drawing.css'

// Keep in sync with the timings in GameCard.css
const DEAL_DURATION_MS = 500
const DEAL_STAGGER_MS = 120

interface DrawingProps {
  sessionId: string
  /** Cards drawn earlier, kept by App so coming back from the collection does not draw again */
  cards: Card[] | null
  onCardsDrawn: (cards: Card[]) => void
  onCardChosen: (turn: ActiveTurn) => void
  onOpenCollection: () => void
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Drawing({ sessionId, cards, onCardsDrawn, onCardChosen, onOpenCollection }: DrawingProps) {
  // Cards already drawn on mount: show them face up right away, without the animation
  const [alreadyDrawn] = useState(() => cards !== null)
  const [revealed, setRevealed] = useState(alreadyDrawn)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const firstCardRef = useRef<HTMLButtonElement>(null)

  // Draw the cards (only if none are kept)
  useEffect(() => {
    if (cards) return
    let cancelled = false
    api
      .drawCards(sessionId)
      .then((drawn) => !cancelled && onCardsDrawn(drawn))
      .catch(() => !cancelled && setError('Impossible de piocher pour l’instant.'))
    return () => {
      cancelled = true
    }
  }, [sessionId, attempt, cards, onCardsDrawn])

  // Flip the cards once they have all been dealt
  useEffect(() => {
    if (!cards || revealed) return
    const dealTime = prefersReducedMotion() ? 0 : DEAL_DURATION_MS + cards.length * DEAL_STAGGER_MS
    const timer = setTimeout(() => setRevealed(true), dealTime)
    return () => clearTimeout(timer)
  }, [cards, revealed])

  // Select the first card so the keyboard works right away
  useEffect(() => {
    if (revealed) firstCardRef.current?.focus()
  }, [revealed])

  async function chooseCard(card: Card) {
    setChosenId(card.id)
    setError(null)
    try {
      const { turnId, message } = await api.startTurn(sessionId, card.id)
      onCardChosen({ turnId, card, firstMessage: message })
    } catch {
      setError('Oups, cette carte n’a pas voulu se lancer. Réessaie !')
      setChosenId(null)
    }
  }

  function retry() {
    setError(null)
    setAttempt((n) => n + 1)
  }

  // The backend imposes the mirror card alone when the game is over
  const isMirror = cards?.some((card) => card.format === 'mirror') ?? false

  return (
    <main className="drawing" onKeyDown={moveFocusWithArrows}>
      <h1 className="pill-title">{!revealed ? 'On pioche…' : isMirror ? 'Dernière carte !' : 'Choisis une carte'}</h1>

      {cards && (
        <div className="drawing-cards">
          {cards.map((card, index) => (
            <GameCard
              key={card.id}
              card={card}
              index={index}
              revealed={revealed}
              instant={alreadyDrawn}
              disabled={!revealed || chosenId !== null}
              dimmed={chosenId !== null && chosenId !== card.id}
              chosen={chosenId === card.id}
              onSelect={chooseCard}
              buttonRef={index === 0 ? firstCardRef : undefined}
            />
          ))}
        </div>
      )}

      {revealed && (
        <button className="btn" onClick={onOpenCollection} disabled={chosenId !== null}>
          Voir ma collection
        </button>
      )}

      {error && (
        <div className="drawing-error" role="alert">
          <p>{error}</p>
          {!cards && (
            <button className="btn" onClick={retry} autoFocus>
              Réessayer
            </button>
          )}
        </div>
      )}
    </main>
  )
}
