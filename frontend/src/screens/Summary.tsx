import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry, Summary as SummaryData } from '../types'
import { delay } from '../utils/animation'
import { focusSmoothly, moveFocusWithArrows } from '../utils/arrowNavigation'
import { loadSpeech } from '../utils/speech'
import {
  ENDED_BY_LABELS,
  ENGAGEMENT_LABELS,
  FAMILY_LABELS,
  METHOD_POINTS,
  STRENGTH_HINTS,
  STRENGTH_LABELS,
  plural,
  wordsPerAnswer,
} from '../utils/technicalLabels'
import { withViewTransition } from '../utils/viewTransition'
import '../styles/cardShine.css'
import './Summary.css'

type Step = 'review' | 'loading' | 'ready' | 'error'

// Only what can be acted on takes the focus: texts and cards on the summary pages are just read
const FIRST_FOCUS = '.summary-review-grid button, .summary-board input, .summary-next, .summary-download'

/** The pages of the summary, by title: three for the user, then two technical ones for a professional */
const PAGES = ['Toi', 'Tes talents', 'Et maintenant ?', 'Fiche technique', 'Déroulé et méthode'] as const

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
      // The cards taken off are erased from the database, not just left out of the summary
      await Promise.all(
        entries
          .filter((entry) => !keptIds.includes(entry.id))
          .map((entry) => api.deleteEntry(sessionId, entry.id)),
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
          Voilà ce que j’ai gardé de ce que tu m’as raconté. Retire ce que tu ne veux pas garder : les cartes retirées
          sont effacées pour de bon, et seules celles que tu gardes comptent pour ton bilan.
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
            ? `Effacer ${removed} carte${removed > 1 ? 's' : ''} et voir mon bilan`
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
  const technical = summary.technical

  return (
    // Short pages, each on one screen on a computer (sizes follow the window, see --fit)
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

      {page === 3 && (
        <div className="summary-board is-page-4 summary-tech">
          <div className="summary-column rise-in" style={delay(0.15)}>
            <p className="summary-note">
              Cette partie est écrite pour un professionnel (conseiller, psychologue) : elle reprend ce que tu as
              raconté avec le vocabulaire du référentiel des compétences ROME 4.0.
            </p>
            <section className="summary-section" aria-labelledby="summary-domains-title">
              <h2 id="summary-domains-title">Profil par domaine ROME</h2>
              {technical.domains.length === 0 ? (
                <p className="summary-note">Aucune compétence rattachée au ROME sur cette partie.</p>
              ) : (
                <ul className="summary-tech-list">
                  {technical.domains.map((line) => (
                    <li key={line.domain}>
                      <strong>{line.domain}</strong>
                      <span className="summary-tech-soft">
                        {plural(line.skills, 'compétence')} · {plural(line.stories, 'récit')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {technical.unmapped.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-unmapped-title">
                <h2 id="summary-unmapped-title">Sans équivalent ROME</h2>
                <ul className="summary-tech-list">
                  {technical.unmapped.map((item, index) => (
                    <li key={`${item.quote}-${index}`}>
                      <strong>{item.fact}</strong>
                      <span className="summary-tech-quote">« {item.quote} »</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className="summary-column rise-in" style={delay(0.3)}>
            <section className="summary-section" aria-labelledby="summary-rome-title">
              <h2 id="summary-rome-title">Compétences repérées</h2>
              {technical.skills.length === 0 ? (
                <p className="summary-note">Aucune carte gardée sur cette partie.</p>
              ) : (
                <ul className="summary-tech-skills">
                  {technical.skills.map((skill) => (
                    <li key={skill.code} className="summary-tech-skill">
                      <span className="summary-tech-skill-head">
                        <strong>{skill.label}</strong>
                        <span className="summary-tech-soft">
                          {skill.code} · {skill.category}
                        </span>
                      </span>
                      <span className="summary-tech-soft">
                        {skill.domain} › {skill.issue} › {skill.objective}
                      </span>
                      <span>
                        <span className={`summary-tech-strength is-${skill.strength}`}>
                          {STRENGTH_LABELS[skill.strength]}
                        </span>{' '}
                        {STRENGTH_HINTS[skill.strength]} ({plural(skill.evidence.length, 'récit')},{' '}
                        {plural(skill.cards, 'carte')}, {plural(skill.families, 'thème')})
                      </span>
                      <ul className="summary-tech-evidence">
                        {skill.evidence.map((item, index) => (
                          <li key={`${item.quote}-${index}`}>
                            <span className="summary-tech-quote">« {item.quote} »</span>{' '}
                            <span className="summary-tech-soft">
                              {item.cardTitle} ({FAMILY_LABELS[item.family]})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {page === 4 && (
        <div className="summary-board is-page-5 summary-tech">
          <div className="summary-column rise-in" style={delay(0.15)}>
            <section className="summary-section" aria-labelledby="summary-turns-title">
              <h2 id="summary-turns-title">Déroulé de la partie</h2>
              {technical.turns.length === 0 ? (
                <p className="summary-note">Le déroulé n’a pas été enregistré pour cette partie.</p>
              ) : (
                <div className="summary-tech-table-wrap">
                  <table className="summary-tech-table">
                    <thead>
                      <tr>
                        <th scope="col">Carte</th>
                        <th scope="col">Thème</th>
                        <th scope="col">Réponses</th>
                        <th scope="col">Mots / réponse</th>
                        <th scope="col">Échange</th>
                        <th scope="col">Fin</th>
                        <th scope="col">Gardées</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technical.turns.map((turn, index) => (
                        <tr key={`${turn.cardTitle}-${index}`}>
                          <td>{turn.cardTitle}</td>
                          <td>{FAMILY_LABELS[turn.family]}</td>
                          <td>{turn.answers}</td>
                          <td>{wordsPerAnswer(turn)}</td>
                          <td>{turn.engagement ? ENGAGEMENT_LABELS[turn.engagement] : '—'}</td>
                          <td>{ENDED_BY_LABELS[turn.endedBy]}</td>
                          <td>{turn.kept}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="summary-note">
                « Échange » est lu par l’assistant à la fin de chaque carte : il décrit la conversation, pas la personne.
              </p>
            </section>
            {technical.topics.length > 0 && (
              <section className="summary-section" aria-labelledby="summary-topics-title">
                <h2 id="summary-topics-title">Sujets à reprendre en entretien</h2>
                <p className="summary-tech-topics">{technical.topics.join(' · ')}</p>
              </section>
            )}
          </div>
          <div className="summary-column rise-in" style={delay(0.3)}>
            <section className="summary-section" aria-labelledby="summary-method-title">
              <h2 id="summary-method-title">Méthode et limites</h2>
              <ul className="summary-questions">
                {METHOD_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
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
