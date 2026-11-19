import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry } from '../types'
import { delay } from '../utils/animation'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './CollectionPage.css'

/** Number of slots shown at least, filled with empty dashed slots */
const MIN_SLOTS = 5

interface CollectionPageProps {
  sessionId: string
  onBack: () => void
  /** Passer au bilan and Quitter (see GameMenu) */
  menu?: ReactNode
}

/** Every card the agent kept, with the user's quote that made it keep it. */
export function CollectionPage({ sessionId, onBack, menu }: CollectionPageProps) {
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
      {menu}
      <header className="collection-page-header">
        <button className="btn-link" onClick={onBack} autoFocus>
          ← Retour
        </button>
        <h1 className="pill-title pop-in">Ta collection</h1>
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

      {entries && (
        <ul className="collection-grid">
          {entries.map((entry, index) => (
            <li key={entry.id} className="pop-in" style={delay(0.15 + index * 0.08)}>
              <CollectionCard entry={entry} />
            </li>
          ))}
          {/* Empty dashed slots so a small collection still looks like it is waiting to be filled */}
          {Array.from({ length: Math.max(0, MIN_SLOTS - entries.length) }, (_, index) => (
            <li
              key={`slot-${index}`}
              className="collection-slot rise-in"
              style={delay(0.2 + (entries.length + index) * 0.08)}
              aria-hidden="true"
            />
          ))}
        </ul>
      )}
    </main>
  )
}
