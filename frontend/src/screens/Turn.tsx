import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { api } from '../api'
import { AssistantOrb, type OrbState } from '../components/AssistantOrb'
import { CollectionCard } from '../components/CollectionCard'
import { useCardTilt } from '../hooks/useCardTilt'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { ActiveTurn, CollectionEntry } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { focusSmoothly, moveFocusWithArrows } from '../utils/arrowNavigation'
import { prefersReducedMotion, withViewTransition } from '../utils/viewTransition'
import '../styles/cardShine.css'
import '../components/GameCard.css'
import './Turn.css'

interface TurnProps {
  sessionId: string
  turn: ActiveTurn
  onTurnEnded: () => void
}

/**
 * speaking: the assistant's words appear · answering: the user answers · thinking: waiting for the backend
 * picking (mirror only): the user picks the cards of the collection that look like them
 */
type Phase = 'speaking' | 'answering' | 'picking' | 'thinking' | 'ended'
type InputMode = 'voice' | 'text'

const WORD_INTERVAL_MS = 160
const PAUSE_AFTER_SPEAKING_MS = 400
const TOAST_DURATION_MS = 2800


function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Turn({ sessionId, turn, onTurnEnded }: TurnProps) {
  const speech = useSpeechRecognition()
  const cardTilt = useCardTilt()
  const [assistantText, setAssistantText] = useState(turn.firstMessage.text)
  const [phase, setPhase] = useState<Phase>('speaking')
  const [turnEnded, setTurnEnded] = useState(false)
  // Mirror: the backend asks to pick cards from the collection
  const [pickRequested, setPickRequested] = useState(turn.pickFromCollection ?? false)
  const [collection, setCollection] = useState<CollectionEntry[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Mirror: the picked cards, which stay on screen during the exchange
  const [keptIds, setKeptIds] = useState<string[]>([])
  const [revealedWords, setRevealedWords] = useState(0)
  const [mode, setMode] = useState<InputMode>(speech.supported ? 'voice' : 'text')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  // "+1 carte dans ta collection": the id restarts the animation when cards come in a row
  const [toast, setToast] = useState<{ id: number; count: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const pickRef = useRef<HTMLDivElement>(null)
  const isMirror = turn.card.format === 'mirror'

  const words = useMemo(() => assistantText.split(/\s+/).filter(Boolean), [assistantText])
  const { supported: voiceSupported, start: startListening, cancel: cancelListening } = speech

  // The assistant "speaks": its words appear one by one, then the user can answer
  useEffect(() => {
    if (phase !== 'speaking') return
    const finish = () => setPhase(turnEnded ? 'ended' : pickRequested ? 'picking' : 'answering')
    if (prefersReducedMotion()) {
      setRevealedWords(words.length)
      const timer = setTimeout(finish, 0)
      return () => clearTimeout(timer)
    }
    setRevealedWords(0)
    let count = 0
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setInterval(() => {
      count += 1
      setRevealedWords(count)
      if (count >= words.length) {
        clearInterval(timer)
        endTimer = setTimeout(finish, PAUSE_AFTER_SPEAKING_MS)
      }
    }, WORD_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      clearTimeout(endTimer)
    }
  }, [phase, words, turnEnded, pickRequested])

  // Voice is the main way to answer: listen as soon as it is the user's turn
  useEffect(() => {
    if (phase === 'answering' && mode === 'voice' && voiceSupported) startListening()
  }, [phase, mode, voiceSupported, startListening])

  // Microphone refused or broken: fall back to the keyboard
  useEffect(() => {
    if (speech.error === 'not-allowed' || speech.error === 'audio-capture') setMode('text')
  }, [speech.error])

  // Text mode: focus the field, cursor at the end
  useEffect(() => {
    if (phase !== 'answering' || mode !== 'text') return
    const input = inputRef.current
    input?.focus()
    input?.setSelectionRange(input.value.length, input.value.length)
  }, [phase, mode])

  // Mirror: load the collection when it is time to pick
  useEffect(() => {
    if (phase !== 'picking' || collection) return
    let cancelled = false
    api
      .getCollection(sessionId)
      .then((entries) => !cancelled && setCollection(entries))
      .catch(() => !cancelled && setError('On n’arrive pas à charger ta collection. Réessaie !'))
    return () => {
      cancelled = true
    }
  }, [phase, collection, sessionId])

  // Mirror: select the first card once the collection is shown
  useEffect(() => {
    if (phase !== 'picking' || !collection) return
    const firstCard = pickRef.current?.querySelector<HTMLElement>('button')
    if (firstCard) focusSmoothly(firstCard)
  }, [phase, collection])

  // Hide the toast after a while
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // In voice mode, what was typed before switching back to the mic comes first
  const voiceAnswer = [draft, speech.transcript].filter(Boolean).join(' ')

  async function submit(answer: string, selectedEntryIds?: string[]) {
    const previousPhase = phase
    const begin = () => {
      cancelListening()
      setDraft('')
      setError(null)
      setPhase('thinking')
      if (selectedEntryIds) setKeptIds(selectedEntryIds)
    }
    // Validating the mirror pick: the picked cards glide to their row, the others fade out
    if (selectedEntryIds) withViewTransition(begin)
    else begin()
    try {
      const response = await api.sendMessage(sessionId, turn.turnId, answer, selectedEntryIds)
      const added = response.newEntries?.length ?? 0
      if (added > 0) setToast((current) => ({ id: (current?.id ?? 0) + 1, count: added }))
      setTurnEnded(response.turnEnded)
      setPickRequested(response.pickFromCollection ?? false)
      setAssistantText(response.message.text)
      setPhase('speaking')
    } catch {
      setError('Ta réponse n’est pas partie. Réessaie !')
      if (previousPhase === 'picking') {
        setKeptIds([])
        setPhase('picking')
        return
      }
      // Give the answer back as text so nothing is lost
      setDraft(answer)
      setMode('text')
      setPhase('answering')
    }
  }

  function sendAnswer(text: string) {
    const answer = text.trim()
    if (answer && phase === 'answering') submit(answer)
  }

  function sendSelection() {
    if (phase === 'picking') submit('', selectedIds)
  }

  function toggleEntry(entry: CollectionEntry) {
    setSelectedIds((current) =>
      current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id],
    )
  }

  function switchToVoice() {
    setMode('voice')
  }

  // Listened on the whole page, so it works even when nothing has the focus
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const main = mainRef.current
      if (!main) return

      // Arrow pressed while the focus is outside the screen: bring it back in
      if (event.key.startsWith('Arrow') && !main.contains(document.activeElement)) {
        main.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus()
        event.preventDefault()
        return
      }

      // Typing while the mic listens switches to the keyboard: stop listening, keep what was heard
      const typing = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
      const pressingButton = event.key === ' ' && event.target instanceof HTMLButtonElement
      const inField = event.target instanceof HTMLInputElement
      if (mode === 'voice' && phase === 'answering' && typing && !pressingButton && !inField) {
        cancelListening()
        setDraft(voiceAnswer ? `${voiceAnswer} ${event.key}` : event.key)
        setMode('text')
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, phase, voiceAnswer, cancelListening])

  const keptEntries = collection?.filter((entry) => keptIds.includes(entry.id)) ?? []

  const orbState: OrbState =
    phase === 'speaking' ? 'speaking' : phase === 'thinking' ? 'thinking' : speech.listening ? 'listening' : 'idle'

  return (
    <main
      ref={mainRef}
      className={[
        'turn',
        isMirror && 'turn-mirror',
        phase === 'picking' && 'is-picking',
        cardColorClass(turn.card),
      ]
        .filter(Boolean)
        .join(' ')}
      onKeyDown={moveFocusWithArrows}
    >
      {/* Mirror: a screen of its own, without the card on the left */}
      {!isMirror && (
        <aside
          className="turn-card card-shine floating"
          style={{ viewTransitionName: 'chosen-card' }}
          aria-label="Carte choisie"
          ref={cardTilt.ref}
          onPointerMove={cardTilt.onPointerMove}
          onPointerLeave={cardTilt.onPointerLeave}
        >
          <span className="turn-card-title">{turn.card.title}</span>
          <span className="turn-card-brand">ptv</span>
        </aside>
      )}

      <section className="turn-stage">
        {/* Mirror: the picked cards stay on screen during the exchange */}
        {phase !== 'picking' && keptEntries.length > 0 && (
          <ul className="turn-kept" aria-label="Les cartes que tu as choisies">
            {keptEntries.map((entry) => (
              <li key={entry.id}>
                <CollectionCard entry={entry} transitionName={`entry-${entry.id}`} focusable={false} />
              </li>
            ))}
          </ul>
        )}

        <AssistantOrb state={orbState} />

        {/* What the assistant just said, big, word by word (screen readers get the whole sentence) */}
        <p className="turn-assistant-text" aria-hidden="true">
          {words.map((word, index) => (
            <span key={index} className={index < revealedWords ? 'word is-visible' : 'word'}>
              {word}{' '}
            </span>
          ))}
        </p>
        <p className="visually-hidden" aria-live="polite">
          {assistantText}
        </p>

        <div className="turn-answer">
          {error && (
            <p className="turn-error" role="alert">
              {error}
            </p>
          )}

          {phase === 'ended' && (
            <button className="btn turn-main-button" onClick={onTurnEnded} autoFocus>
              {isMirror ? 'Voir mon bilan' : 'Piocher la suite'}
            </button>
          )}

          {phase === 'picking' && collection && (
            <div className="turn-pick" ref={pickRef}>
              {collection.length === 0 ? (
                <p className="turn-hint">Ta collection est vide, ce n’est pas grave : on continue.</p>
              ) : (
                <ul className="turn-pick-grid">
                  {collection.map((entry, index) => (
                    // --index: the cards appear one after the other
                    <li key={entry.id} style={{ '--index': index } as CSSProperties}>
                      <CollectionCard
                        entry={entry}
                        selected={selectedIds.includes(entry.id)}
                        onToggle={toggleEntry}
                        transitionName={`entry-${entry.id}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn turn-main-button" onClick={sendSelection}>
                {collection.length === 0
                  ? 'Continuer'
                  : `Valider ${selectedIds.length > 0 ? `mes ${selectedIds.length} carte${selectedIds.length > 1 ? 's' : ''}` : 'sans choisir'}`}
              </button>
            </div>
          )}

          {phase === 'answering' && mode === 'voice' && (
            <div className="turn-voice">
              <span className={`turn-mic${speech.listening ? ' is-listening' : ''}`} aria-hidden="true">
                <MicIcon />
              </span>
              <p className="turn-transcript" aria-live="polite">
                {voiceAnswer || (speech.listening ? 'Je t’écoute…' : 'Le micro est en pause.')}
              </p>
              <div className="turn-voice-actions">
                {/* Never disabled: it must be able to hold the focus before anything is said */}
                <button
                  className="btn turn-main-button"
                  onClick={() => sendAnswer(voiceAnswer)}
                  aria-disabled={!voiceAnswer}
                  autoFocus
                >
                  C’est bon
                </button>
                {!speech.listening && (
                  <button className="btn" onClick={startListening}>
                    Reparler
                  </button>
                )}
              </div>
              <p className="turn-hint">Tu peux aussi taper ta réponse au clavier.</p>
            </div>
          )}

          {phase === 'answering' && mode === 'text' && (
            <form
              className="turn-form"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                sendAnswer(draft)
              }}
            >
              <input
                ref={inputRef}
                className="turn-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écris ta réponse…"
                aria-label="Ta réponse"
              />
              {/* Below the field: ↓ reaches them, ← → stay for moving the cursor in the text */}
              <div className="turn-form-actions">
                <button className="btn" type="submit" aria-disabled={!draft.trim()}>
                  Envoyer
                </button>
                {voiceSupported && (
                  <button
                    className="btn turn-mic-button"
                    type="button"
                    onClick={switchToVoice}
                    aria-label="Répondre à voix haute"
                  >
                    <MicIcon />
                  </button>
                )}
              </div>
            </form>
          )}

          {phase === 'answering' && mode === 'text' && !voiceSupported && (
            <p className="turn-hint">Le micro n’est pas disponible sur ce navigateur : écris ta réponse.</p>
          )}
        </div>
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
