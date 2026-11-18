import { useEffect, useState } from 'react'
import { api } from '../api'
import type { CollectionEntry } from '../types'
import { cardColorClass } from '../utils/cardColors'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import '../components/GameCard.css'
import './CollectionPage.css'

interface CollectionPageProps {
  sessionId: string
  onBack: () => void
}

/** Every card the agent kept, with the user's quote that made it keep it. */
export function CollectionPage({ sessionId, onBack }: CollectionPageProps) {
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .getCollection(sessionId)
      .then((collection) => !cancelled && setEntries(collection))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <main className="collection-page" onKeyDown={moveFocusWithArrows}>
      <header className="collection-page-header">
        <button className="btn-link" onClick={onBack} autoFocus>
          ← Retour
        </button>
        <h1 className="pill-title">Ta collection</h1>
      </header>

      {error && (
        <p className="collection-page-message" role="alert">
          On n’arrive pas à charger ta collection pour l’instant.
        </p>
      )}

      {entries?.length === 0 && (
        <p className="collection-page-message">
          Vide pour l’instant… Raconte, et tes cartes viendront toutes seules.
        </p>
      )}

      {entries && entries.length > 0 && (
        <ul className="collection-grid">
          {entries.map((entry) => (
            <li key={entry.id} className={`collection-entry ${cardColorClass(entry.card)}`} tabIndex={0}>
              <span className="collection-entry-theme">{entry.card.title}</span>
              <blockquote className="collection-entry-quote">« {entry.quote} »</blockquote>
              <span className="collection-entry-skill">{entry.skill}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
