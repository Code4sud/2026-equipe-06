import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { GameCard } from '../components/GameCard'
import { KeyboardHint } from '../components/KeyboardHint'
import { delay } from '../utils/animation'
import type { ActiveTurn, Card } from '../types'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import { prefersReducedMotion } from '../utils/viewTransition'
import './Drawing.css'

// Keep in sync with the timings in GameCard.css
const DEAL_DURATION_MS = 500
const DEAL_STAGGER_MS = 120
const DISCARD_DURATION_MS = 450
const DISCARD_STAGGER_MS = 120

/** Time for every other card to leave: the last one starts after (n - 2) delays */
const discardTime = (cardCount: number) =>
  cardCount < 2 ? 0 : DISCARD_DURATION_MS + (cardCount - 2) * DISCARD_STAGGER_MS

interface DrawingProps {
  sessionId: string
  /** Cards drawn earlier, kept by App so coming back from the collection does not draw again */
  cards: Card[] | null
  onCardsDrawn: (cards: Card[]) => void
  onCardChosen: (turn: ActiveTurn) => void
  onOpenCollection: () => void
  /** Joker chosen: throw every card away and draw new ones */
  onRedraw: () => void
  /** Passer au bilan and Quitter (see GameMenu) */
  menu?: ReactNode
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Front-only 5th card, always last: the backend sends 4 cards and never this one */
const JOKER_CARD: Card = {
  id: 'joker',
  family: 'dreams',
  format: 'joker',
  title: 'Aucune ne te parle ? Repioche !',
}

export function Drawing({
  sessionId,
  cards: drawnCards,
  onCardsDrawn,
  onCardChosen,
  onOpenCollection,
  onRedraw,
  menu,
}: DrawingProps) {
  // The backend imposes the mirror card alone when the game is over (no joker then)
  const isMirror = drawnCards?.some((card) => card.format === 'mirror') ?? false
  const cards = useMemo(
    () => (drawnCards && !isMirror ? [...drawnCards, JOKER_CARD] : drawnCards),
    [drawnCards, isMirror],
  )

  // Cards already drawn on mount: show them face up right away, without the animation
  const [alreadyDrawn] = useState(() => drawnCards !== null)
  const [revealed, setRevealed] = useState(alreadyDrawn)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [redrawing, setRedrawing] = useState(false)
  const firstCardRef = useRef<HTMLButtonElement>(null)

  // Draw the cards (only if none are kept)
  useEffect(() => {
    if (drawnCards) return
    let cancelled = false
    api
      .drawCards(sessionId)
      .then((drawn) => !cancelled && onCardsDrawn(drawn))
      .catch(() => !cancelled && setError('Impossible de piocher pour l’instant.'))
    return () => {
      cancelled = true
    }
  }, [sessionId, attempt, drawnCards, onCardsDrawn])

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

  async function redraw() {
    setRedrawing(true)
    const count = cards?.length ?? 0
    // Every card leaves, one after the other; the last one starts after (count - 1) delays
    await wait(prefersReducedMotion() ? 0 : DISCARD_DURATION_MS + Math.max(0, count - 1) * DISCARD_STAGGER_MS)
    onRedraw()
  }

  async function chooseCard(card: Card) {
    if (card.format === 'joker') {
      redraw()
      return
    }
    setChosenId(card.id)
    setError(null)
    try {
      // The other cards are discarded while the turn starts
      const [{ turnId, message, pickFromCollection }] = await Promise.all([
        api.startTurn(sessionId, card.id),
        wait(prefersReducedMotion() ? 0 : discardTime(cards?.length ?? 0)),
      ])
      // App then changes screen with a transition (the chosen card morphs into the next screen)
      onCardChosen({ turnId, card, firstMessage: message, pickFromCollection })
    } catch {
      setError('Oups, cette carte n’a pas voulu se lancer. Réessaie !')
      setChosenId(null)
    }
  }

  function retry() {
    setError(null)
    setAttempt((n) => n + 1)
  }

  const chosenIndex = cards?.findIndex((card) => card.id === chosenId) ?? -1
  const middle = ((cards?.length ?? 1) - 1) / 2

  function discardDirection(card: Card, index: number): -1 | 1 | undefined {
    if (redrawing) return index < middle ? -1 : 1
    if (chosenId === null || chosenId === card.id) return undefined
    return index < chosenIndex ? -1 : 1
  }

  return (
    <main className={`drawing${chosenId || redrawing ? ' is-leaving' : ''}`} onKeyDown={moveFocusWithArrows}>
      {menu}
      <h1 className="pill-title pop-in">{!revealed ? 'On pioche…' : isMirror ? 'Dernière carte !' : 'Choisis une carte'}</h1>

      {cards && (
        <div className="drawing-cards">
          {cards.map((card, index) => (
            <GameCard
              key={card.id}
              card={card}
              index={index}
              revealed={revealed}
              instant={alreadyDrawn}
              disabled={!revealed || chosenId !== null || redrawing}
              discardDirection={discardDirection(card, index)}
              discardOrder={!redrawing && chosenIndex !== -1 && index > chosenIndex ? index - 1 : index}
              chosen={chosenId === card.id}
              onSelect={chooseCard}
              buttonRef={index === 0 ? firstCardRef : undefined}
            />
          ))}
        </div>
      )}

      {revealed && (
        <button className="btn rise-in" onClick={onOpenCollection} disabled={chosenId !== null || redrawing}>
          Voir ma collection
        </button>
      )}

      {revealed && (
        <KeyboardHint
          className="rise-in"
          style={delay(0.3)}
          items={[{ keys: ['←', '↑', '→', '↓'], label: 'te déplacer' }]}
        />
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
