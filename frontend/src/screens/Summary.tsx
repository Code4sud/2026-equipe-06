import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry, Summary as SummaryData } from '../types'
import { focusSmoothly, moveFocusWithArrows } from '../utils/arrowNavigation'
import { loadSpeech } from '../utils/speech'
import { withViewTransition } from '../utils/viewTransition'
import '../styles/cardShine.css'
import './Summary.css'

type Step = 'review' | 'loading' | 'ready' | 'error'

/** How much the summary text may grow (short summary) or shrink (long one) to fill the screen */
const MAX_FIT = 1.6
const MIN_FIT = 0.6
/** The question about sensitive mentions: asked, being answered, answered yes, answered no */
type Consent = 'asking' | 'updating' | 'accepted' | 'declined'

interface SummaryProps {
  sessionId: string
  onFinish: () => void
  /** Quitter (see GameMenu) */
  menu?: ReactNode
}

/**
 * The end of the game: the user first keeps or removes each entry of the collection,
 * then reads the agent's summary built only on what was kept.
 */
export function Summary({ sessionId, onFinish, menu }: SummaryProps) {
  const [step, setStep] = useState<Step>('review')
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null)
  const [keptIds, setKeptIds] = useState<string[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)

  const [consent, setConsent] = useState<Consent>('asking')
  const [checkedMentions, setCheckedMentions] = useState<string[]>([])
  const [consentError, setConsentError] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Each step starts with the focus on its content, so the arrows work right away
  // (the game menu comes first in the page, it is skipped)
  useEffect(() => {
    if (step !== 'review' && step !== 'ready') return
    const first = mainRef.current?.querySelector<HTMLElement>(
      '.summary-review-grid button, .summary-personality, .summary-finish',
    )
    if (first) focusSmoothly(first)
  }, [step, entries])

  // On a computer the summary fills the screen without scrolling: the text starts big (a short
  // summary must not leave holes), and gets a notch smaller until it fits (--fit in Summary.css)
  useLayoutEffect(() => {
    const main = mainRef.current
    if (step !== 'ready' || !main) return
    const target = main
    function fit() {
      target.style.setProperty('--fit', '1')
      if (!window.matchMedia('(min-width: 64rem)').matches) return
      // The page, and each column (a column can overflow inside the page without the page growing)
      const overflows = () =>
        [target, ...target.querySelectorAll<HTMLElement>('.summary-column')].some(
          (element) => element.scrollHeight > element.clientHeight + 1,
        )
      let scale = MAX_FIT
      target.style.setProperty('--fit', String(scale))
      while (overflows() && scale > MIN_FIT) {
        scale -= 0.04
        target.style.setProperty('--fit', scale.toFixed(2))
      }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [step, summary, consent, consentError])

  // An arrow pressed while nothing has the focus brings it back into the screen
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const main = mainRef.current
      if (!main || !event.key.startsWith('Arrow') || main.contains(document.activeElement)) return
      main.querySelector<HTMLElement>('.summary-review-grid button, .summary-personality, .summary-finish')?.focus()
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // The summary paragraph is read aloud, with the assistant's voice
  const overview = step === 'ready' ? (summary?.overview ?? '') : ''
  useEffect(() => {
    if (!overview) return
    let cancelled = false
    let stop: (() => void) | undefined
    void loadSpeech(sessionId, overview).then((voice) => {
      if (!voice) return
      if (cancelled) {
        voice.stop()
        return
      }
      stop = voice.stop
      void voice.play()
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [overview, sessionId])

  async function loadSummary() {
    withViewTransition(() => setStep('loading'))
    try {
      const data = await api.getSummary(sessionId)
      withViewTransition(() => {
        setSummary(data)
        setStep('ready')
      })
    } catch {
      setStep('error')
    }
  }

  useEffect(() => {
    let cancelled = false
    api
      .getCollection(sessionId)
      .then((collection) => {
        if (cancelled) return
        if (collection.length === 0) {
          // Nothing to sort: straight to the summary
          void loadSummary()
          return
        }
        setEntries(collection)
        // Everything starts kept, except what was already removed (a summary reopened)
        setKeptIds(collection.filter((e) => e.status !== 'rejected').map((e) => e.id))
      })
      .catch(() => !cancelled && setStep('error'))
    return () => {
      cancelled = true
    }
    // loadSummary only uses sessionId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  function toggleEntry(entry: CollectionEntry) {
    setKeptIds((ids) => (ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id]))
  }

  async function confirmCollection() {
    if (!entries) return
    setStep('loading')
    try {
      await Promise.all(
        entries.map((entry) =>
          api.updateEntry(sessionId, entry.id, { status: keptIds.includes(entry.id) ? 'kept' : 'rejected' }),
        ),
      )
    } catch {
      setStep('error')
      return
    }
    await loadSummary()
  }

  function toggleMention(mention: string) {
    setCheckedMentions((list) => (list.includes(mention) ? list.filter((m) => m !== mention) : [...list, mention]))
  }

  async function acceptMentions() {
    setConsent('updating')
    setConsentError(false)
    try {
      const { suggestions } = await api.suggestWithMentions(sessionId, checkedMentions)
      withViewTransition(() => {
        setSummary((current) => (current ? { ...current, suggestions } : current))
        setConsent('accepted')
      })
    } catch {
      setConsent('asking')
      setConsentError(true)
    }
  }

  if (step === 'error') {
    return (
      <main className="summary summary-centered">
        {menu}
        <p className="summary-message" role="alert">
          On n’arrive pas à préparer ton bilan pour l’instant.
        </p>
        <button className="btn" onClick={() => void loadSummary()} autoFocus>
          Réessayer
        </button>
      </main>
    )
  }

  if (step === 'loading' || (step === 'review' && !entries)) {
    return (
      <main className="summary summary-centered" aria-busy="true">
        {menu}
        <p className="summary-message summary-loading">Je prépare ton bilan…</p>
      </main>
    )
  }

  if (step === 'review' && entries) {
    const removed = entries.length - keptIds.length
    return (
      <main className="summary" onKeyDown={moveFocusWithArrows} ref={mainRef}>
        {menu}
        <h1 className="pill-title">Ta collection</h1>
        <p className="summary-intro">
          Voilà ce que j’ai gardé de ce que tu m’as raconté. Retire ce qui ne te ressemble pas : seules les cartes que tu
          gardes comptent pour ton bilan.
        </p>

        <ul className="summary-review-grid">
          {entries.map((entry) => (
            <li key={entry.id} className={keptIds.includes(entry.id) ? undefined : 'is-removed'}>
              <CollectionCard
                entry={entry}
                selected={keptIds.includes(entry.id)}
                onToggle={toggleEntry}
                transitionName={`entry-${entry.id}`}
              />
            </li>
          ))}
        </ul>

        <button className="btn" onClick={() => void confirmCollection()}>
          {removed > 0
            ? `Voir mon bilan (${removed} carte${removed > 1 ? 's' : ''} retirée${removed > 1 ? 's' : ''})`
            : 'Voir mon bilan'}
        </button>
      </main>
    )
  }

  if (!summary) return null
  const matches = summary.crossings.filter((c) => c.kind === 'match')
  const gaps = summary.crossings.filter((c) => c.kind === 'gap')
  const showConsent = summary.sensitiveMentions.length > 0 && consent !== 'declined'

  return (
    // Everything on one screen on a computer: two columns, sizes that follow the height of the window
    <main className="summary summary-result" onKeyDown={moveFocusWithArrows} ref={mainRef}>
      {menu}
      <h1 className="pill-title">Ton bilan</h1>

      <div className="summary-board">
        <div className="summary-column">
          {summary.overview && <p className="summary-overview">{summary.overview}</p>}

          {summary.suggestions.length > 0 && (
            <section className="summary-section" aria-labelledby="summary-suggestions-title">
              <h2 id="summary-suggestions-title">Des pistes à explorer</h2>
              <ul className="summary-suggestions">
                {summary.suggestions.map((s) => (
                  <li key={s} tabIndex={0}>
                    {s}
                  </li>
                ))}
              </ul>
              {consent === 'accepted' && (
                <p className="summary-note">Ces pistes tiennent compte de ce que tu as choisi de partager.</p>
              )}
              <p className="summary-note">Ce sont des pistes de réflexion, pas un verdict : c’est toi qui décides.</p>
            </section>
          )}

          {/* Asked, never assumed: nothing about health, religion or origin is used without a yes (RGPD, art. 9) */}
          {showConsent && consent !== 'accepted' && (
            <section className="summary-section summary-consent" aria-labelledby="summary-consent-title">
              <h2 id="summary-consent-title">Tu veux qu’on en tienne compte ?</h2>
              <p>
                Tu as dit des choses sur toi que je n’ai pas gardées. Coche ce que tu veux que je prenne en compte pour
                tes pistes :
              </p>
              <ul className="summary-mentions">
                {summary.sensitiveMentions.map((mention) => (
                  <li key={mention}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checkedMentions.includes(mention)}
                        onChange={() => toggleMention(mention)}
                      />
                      « {mention} »
                    </label>
                  </li>
                ))}
              </ul>
              {consentError && (
                <p className="summary-note" role="alert">
                  Ça n’a pas marché, tu peux réessayer.
                </p>
              )}
              <div className="summary-consent-actions">
                <button
                  className="btn"
                  disabled={checkedMentions.length === 0 || consent === 'updating'}
                  onClick={() => void acceptMentions()}
                >
                  {consent === 'updating' ? 'Je mets tes pistes à jour…' : 'Oui, tiens-en compte'}
                </button>
                <button
                  className="btn-link"
                  disabled={consent === 'updating'}
                  onClick={() => withViewTransition(() => setConsent('declined'))}
                >
                  Non merci
                </button>
              </div>
              <p className="summary-note">Rien n’est enregistré : ça sert seulement à écrire tes pistes.</p>
            </section>
          )}

          <button className="btn summary-finish" onClick={onFinish}>
            Terminer
          </button>
        </div>

        <div className="summary-column">
          {summary.personalityCards.length > 0 && (
            <section className="summary-section" aria-labelledby="summary-cards-title">
              <h2 id="summary-cards-title">Ce qui te ressemble</h2>
              <ul className="summary-personality-grid">
                {summary.personalityCards.map((card) => (
                  <li key={card.id} className="summary-personality card-shine" tabIndex={0}>
                    <span className="summary-personality-title">{card.title}</span>
                    <span className="summary-personality-description">{card.description}</span>
                    <span className="summary-personality-evidence">Tu as dit : « {card.evidence} »</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.crossings.length > 0 && (
            <section className="summary-section" aria-labelledby="summary-crossings-title">
              <h2 id="summary-crossings-title">Avec ton rapport des possibles</h2>
              <div className="summary-crossings">
                {/* Focusable so the arrows go through every part of the summary, not over it */}
                {matches.length > 0 && (
                  <div tabIndex={0}>
                    <h3>Ce qui se rejoint</h3>
                    <ul>
                      {matches.map((c) => (
                        <li key={c.text}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div tabIndex={0}>
                    <h3>Ce qui reste à explorer</h3>
                    <ul>
                      {gaps.map((c) => (
                        <li key={c.text}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
