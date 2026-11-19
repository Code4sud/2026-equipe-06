import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry, Summary as SummaryData } from '../types'
import { delay } from '../utils/animation'
import { focusSmoothly, moveFocusWithArrows } from '../utils/arrowNavigation'
import { loadSpeech } from '../utils/speech'
import { withViewTransition } from '../utils/viewTransition'
import '../styles/cardShine.css'
import './Summary.css'

type Step = 'review' | 'loading' | 'ready' | 'error'

// Only what can be acted on takes the focus: texts and cards on the summary pages are just read
const FIRST_FOCUS = '.summary-review-grid button, .summary-board input, .summary-next, .summary-download'

/** The three pages of the summary, by title */
const PAGES = ['Toi', 'Tes talents', 'Et maintenant ?'] as const

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
  const [page, setPage] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  function goToPage(next: number) {
    withViewTransition(() => setPage(Math.max(0, Math.min(PAGES.length - 1, next))))
  }

  /** The PDF is made in the browser; its library is loaded only now (it is heavy) */
  async function downloadReport() {
    if (!summary) return
    setDownloading(true)
    setDownloadError(false)
    try {
      const { renderReport } = await import('../pdf/report')
      const url = URL.createObjectURL(await renderReport(summary))
      const link = document.createElement('a')
      link.href = url
      link.download = 'mon-rapport-pioche-ta-voix.pdf'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

  // Each step starts with the focus on its content, so the arrows work right away
  // (the game menu comes first in the page, it is skipped)
  useEffect(() => {
    if (step !== 'review' && step !== 'ready') return
    const first = mainRef.current?.querySelector<HTMLElement>(FIRST_FOCUS)
    if (first) focusSmoothly(first)
  }, [step, entries, page])

  // On a computer the summary fills the screen without scrolling: the text starts big (a short
  // summary must not leave holes), and gets a notch smaller until it fits (--fit in Summary.css)
  useLayoutEffect(() => {
    const main = mainRef.current
    if (step !== 'ready' || !main) return
    const target = main
    function fit() {
      target.style.setProperty('--fit', '1')
      if (!window.matchMedia('(min-width: 64rem)').matches) return
      // The page, the board and each column: any of them can overflow inside the page without the page growing
      const overflows = () =>
        [target, ...target.querySelectorAll<HTMLElement>('.summary-board, .summary-column')].some(
          // A few pixels of margin: the tilted cards stick out a little without anything being hidden
          (element) => element.scrollHeight > element.clientHeight + 8,
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
  }, [step, summary, consent, consentError, page])

  // An arrow pressed while nothing has the focus brings it back into the screen
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const main = mainRef.current
      if (!main || !event.key.startsWith('Arrow') || main.contains(document.activeElement)) return
      main.querySelector<HTMLElement>(FIRST_FOCUS)?.focus()
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
        <p className="summary-message summary-loading rise-in">Je prépare ton bilan…</p>
      </main>
    )
  }

  if (step === 'review' && entries) {
    const removed = entries.length - keptIds.length
    return (
      <main className="summary" onKeyDown={moveFocusWithArrows} ref={mainRef}>
        {menu}
        <h1 className="pill-title pop-in">Ta collection</h1>
        <p className="summary-intro rise-in" style={delay(0.2)}>
          Voilà ce que j’ai gardé de ce que tu m’as raconté. Retire ce qui ne te ressemble pas : seules les cartes que tu
          gardes comptent pour ton bilan.
        </p>

        <ul className="summary-review-grid">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={keptIds.includes(entry.id) ? 'pop-in' : 'pop-in is-removed'}
              style={delay(0.3 + index * 0.08)}
            >
              <CollectionCard
                entry={entry}
                selected={keptIds.includes(entry.id)}
                onToggle={toggleEntry}
                transitionName={`entry-${entry.id}`}
              />
            </li>
          ))}
        </ul>

        <button className="btn rise-in" style={delay(0.5)} onClick={() => void confirmCollection()}>
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
  const showConsent = summary.sensitiveMentions.length > 0 && consent !== 'declined' && consent !== 'accepted'
  const lastPage = PAGES.length - 1

  return (
    // Three short pages, each on one screen on a computer (sizes follow the window, see --fit)
    <main className="summary summary-result" onKeyDown={moveFocusWithArrows} ref={mainRef}>
      {menu}
      <header className="summary-result-header">
        {/* key: the title pops again on each page */}
        <h1 key={page} className="pill-title pop-in">
          {PAGES[page]}
        </h1>
        <p className="summary-page-count">
          Ton bilan · {page + 1} / {PAGES.length}
        </p>
      </header>

      {page === 0 && (
        <div className="summary-board is-page-1">
          <div className="summary-column rise-in" style={delay(0.15)}>
            {summary.overview && <p className="summary-overview">{summary.overview}</p>}
            {summary.mirrorWords.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-words-title">
                <h2 id="summary-words-title">Toi, tu as dit</h2>
                {summary.mirrorWords.map((words) => (
                  <blockquote key={words} className="summary-words">
                    « {words} »
                  </blockquote>
                ))}
              </section>
            )}
          </div>
          <div className="summary-column rise-in" style={delay(0.3)}>
            {summary.personalityCards.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-cards-title">
                <h2 id="summary-cards-title">Ce qui te ressemble</h2>
                {/* Same cards as in the rest of the game: 5:7, shine, a family color */}
                <ul className={`summary-cards${summary.personalityCards.length > 4 ? ' is-many' : ''}`}>
                  {summary.personalityCards.map((card, index) => (
                    <li key={card.id} className="pop-in" style={delay(0.4 + index * 0.1)}>
                      <div className="collection-card card-shine game-card-purple summary-personality is-static">
                        <span className="collection-card-theme">{card.title}</span>
                        <span className="collection-card-quote">{card.description}</span>
                        <span className="summary-personality-evidence">« {card.evidence} »</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {page === 1 && (
        <div className="summary-board is-page-2">
          <div className="summary-column rise-in" style={delay(0.15)}>
            <section className="summary-section" aria-labelledby="summary-skills-title">
              <h2 id="summary-skills-title">Ce que tu as gardé</h2>
              {summary.collection.length === 0 ? (
                <p className="summary-note">Tu n’as gardé aucune carte cette fois : ce n’est pas grave.</p>
              ) : (
                <ul className={`summary-cards${summary.collection.length > 4 ? ' is-many' : ''}`}>
                  {summary.collection.map((entry, index) => (
                    <li key={entry.id} className="pop-in" style={delay(0.3 + index * 0.08)}>
                      <CollectionCard entry={entry} focusable={false} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="summary-column rise-in" style={delay(0.3)}>
            {summary.crossings.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-crossings-title">
                <h2 id="summary-crossings-title">Avec ton rapport des possibles</h2>
                <div className="summary-crossings">
                  {matches.length > 0 && (
                    <div>
                      <h3>Ce qui se rejoint</h3>
                      <ul>
                        {matches.map((c) => (
                          <li key={c.text}>{c.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gaps.length > 0 && (
                    <div>
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
      )}

      {page === 2 && (
        <div className="summary-board is-page-3">
          <div className="summary-column rise-in" style={delay(0.15)}>
            <section className="summary-section" aria-labelledby="summary-leads-title">
              <h2 id="summary-leads-title">Des pistes à explorer</h2>
              <ul className="summary-leads">
                {summary.suggestions.map((lead) => (
                  <li key={lead.title} className="summary-lead">
                    <span className="summary-lead-title">{lead.title}</span>
                    {lead.why && <span>{lead.why}</span>}
                    {lead.firstStep && (
                      <span className="summary-lead-step">
                        <strong>Premier pas : </strong>
                        {lead.firstStep}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {consent === 'accepted' && (
                <p className="summary-note">Ces pistes tiennent compte de ce que tu as choisi de partager.</p>
              )}
              <p className="summary-note">Ce sont des pistes de réflexion, pas un verdict : c’est toi qui décides.</p>
            </section>
          </div>
          <div className="summary-column rise-in" style={delay(0.3)}>
            {summary.advisorQuestions.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-questions-title">
                <h2 id="summary-questions-title">À demander à ton conseiller</h2>
                <ul className="summary-questions">
                  {summary.advisorQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Asked, never assumed: nothing about health, religion or origin is used without a yes (RGPD, art. 9) */}
            {showConsent && (
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
          </div>
        </div>
      )}

      <nav className="summary-pager rise-in" style={delay(0.5)} aria-label="Pages du bilan">
        <button className="btn-link" disabled={page === 0} onClick={() => goToPage(page - 1)}>
          ← Précédent
        </button>
        <span className="summary-dots" aria-hidden="true">
          {PAGES.map((name, index) => (
            <span key={name} className={index === page ? 'is-current' : undefined} />
          ))}
        </span>
        {page < lastPage ? (
          <button className="btn summary-next" onClick={() => goToPage(page + 1)}>
            Suivant →
          </button>
        ) : (
          <span className="summary-pager-end">
            {downloadError && (
              <span className="summary-note" role="alert">
                Le PDF n’a pas pu être créé, réessaie.
              </span>
            )}
            <button className="btn summary-download" disabled={downloading} onClick={() => void downloadReport()}>
              {downloading ? 'Je prépare ton rapport…' : 'Télécharger mon rapport'}
            </button>
            <button className="btn summary-finish" onClick={onFinish}>
              Terminer
            </button>
          </span>
        )}
      </nav>
    </main>
  )
}
