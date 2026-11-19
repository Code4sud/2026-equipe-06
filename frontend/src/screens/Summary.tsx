import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry, Summary as SummaryData } from '../types'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import { withViewTransition } from '../utils/viewTransition'
import '../styles/cardShine.css'
import './Summary.css'

type Step = 'review' | 'loading' | 'ready' | 'error'
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
      <main className="summary" onKeyDown={moveFocusWithArrows}>
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
    <main className="summary" onKeyDown={moveFocusWithArrows}>
      {menu}
      <h1 className="pill-title">Ton bilan</h1>

      {summary.overview && <p className="summary-overview">{summary.overview}</p>}

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

      {summary.suggestions.length > 0 && (
        <section className="summary-section" aria-labelledby="summary-suggestions-title">
          <h2 id="summary-suggestions-title">Des pistes à explorer</h2>
          <ul className="summary-suggestions">
            {summary.suggestions.map((s) => (
              <li key={s}>{s}</li>
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
            Pendant la partie, tu as dit des choses sur toi que je n’ai pas gardées. Si tu veux, j’en tiens compte pour
            tes pistes. Coche ce que tu veux partager :
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

      <button className="btn" onClick={onFinish}>
        Terminer
      </button>
    </main>
  )
}
