import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { CollectionCard } from '../components/CollectionCard'
import type { CollectionEntry } from '../types'
import { delay } from '../utils/animation'
import { focusSmoothly, moveFocusWithArrows } from '../utils/arrowNavigation'
import { withViewTransition } from '../utils/viewTransition'
import './CollectionPage.css'

/** Number of slots shown at least, filled with empty dashed slots */
const MIN_SLOTS = 5

interface CollectionPageProps {
  sessionId: string
  onBack: () => void
  /** Passer au bilan and Quitter (see GameMenu) */
  menu?: ReactNode
}

/**
 * Every card the agent kept, with the user's quote that made it keep it. Entrée on a card opens it in
 * big; from there the user can erase it for good (it leaves the database, not only the screen).
 */
export function CollectionPage({ sessionId, onBack, menu }: CollectionPageProps) {
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null)
  const [error, setError] = useState(false)
  // The card opened in big, and whether its erasing is being confirmed
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  // Card to focus once the screen has been updated (after closing or erasing)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLDialogElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const openEntry = entries?.find((entry) => entry.id === openId) ?? null

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

  // In the same commit as the state change, so the View Transition sees the card move to the center
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (openEntry && !dialog.open) dialog.showModal()
    if (!openEntry && dialog.open) dialog.close()
  }, [openEntry])

  // The confirmation pops up over the open card
  useLayoutEffect(() => {
    const dialog = confirmRef.current
    if (!dialog) return
    if (confirming && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first button: the focus goes to "Non", so a second Entrée does not erase
      dialog.querySelector<HTMLElement>('.delete-cancel')?.focus()
    }
    if (!confirming && dialog.open) dialog.close()
  }, [confirming])

  function cancelDelete() {
    setConfirming(false)
    requestAnimationFrame(() => deleteButtonRef.current?.focus())
  }

  useEffect(() => {
    if (focusIndex === null || openId) return
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.collection-card')
    const card = cards?.length ? cards[Math.max(0, Math.min(focusIndex, cards.length - 1))] : backRef.current
    if (card) focusSmoothly(card)
    setFocusIndex(null)
  }, [focusIndex, openId, entries])

  function open(entry: CollectionEntry) {
    setConfirming(false)
    setDeleteError(false)
    withViewTransition(() => setOpenId(entry.id))
  }

  function close() {
    const index = entries?.findIndex((entry) => entry.id === openId) ?? 0
    // Back on the card that was open
    withViewTransition(() => {
      setOpenId(null)
      setFocusIndex(index)
    })
  }

  async function deleteOpenEntry() {
    if (!openEntry) return
    const index = entries?.findIndex((entry) => entry.id === openEntry.id) ?? 0
    setDeleting(true)
    setDeleteError(false)
    try {
      await api.deleteEntry(sessionId, openEntry.id)
    } catch {
      setDeleteError(true)
      setDeleting(false)
      return
    }
    withViewTransition(() => {
      setEntries((list) => list?.filter((entry) => entry.id !== openEntry.id) ?? list)
      setOpenId(null)
      setConfirming(false)
      setDeleting(false)
      // The focus goes to the card that takes its place
      setFocusIndex(index)
    })
  }

  return (
    <main className="collection-page" onKeyDown={moveFocusWithArrows}>
      {menu}
      <header className="collection-page-header">
        <button className="btn-link" onClick={onBack} autoFocus ref={backRef}>
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
        <ul className="collection-grid" ref={gridRef}>
          {entries.map((entry, index) => (
            <li key={entry.id} className="pop-in" style={delay(0.15 + index * 0.08)}>
              <CollectionCard
                entry={entry}
                onOpen={open}
                // The open card carries the name: it morphs from its place to the center of the screen
                transitionName={entry.id === openId ? undefined : `entry-${entry.id}`}
              />
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

      {/* The card in big over a darkened screen. Échap closes it too (onCancel) */}
      <dialog
        ref={dialogRef}
        className="collection-viewer"
        aria-label={openEntry ? `Carte « ${openEntry.card.title} »` : undefined}
        onCancel={(event) => {
          event.preventDefault()
          if (!deleting) close()
        }}
        onKeyDown={(event) => {
          moveFocusWithArrows(event)
          event.stopPropagation()
        }}
      >
        {openEntry && (
          <>
            <CollectionCard entry={openEntry} focusable={false} transitionName={`entry-${openEntry.id}`} />

            <div className="collection-viewer-actions">
              {deleteError && (
                <p className="collection-viewer-message" role="alert">
                  On n’arrive pas à supprimer cette carte. Réessaie !
                </p>
              )}
              <button type="button" className="btn" onClick={close} autoFocus>
                Retour
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(true)} ref={deleteButtonRef}>
                Supprimer la carte
              </button>
            </div>
          </>
        )}
      </dialog>

      {/* Same look as the Quitter confirmation (GameMenu.css) */}
      <dialog
        ref={confirmRef}
        className="game-menu-dialog"
        aria-labelledby="delete-title"
        onCancel={(event) => {
          event.preventDefault()
          if (!deleting) cancelDelete()
        }}
        onKeyDown={(event) => {
          moveFocusWithArrows(event)
          event.stopPropagation()
        }}
      >
        {confirming && (
          <>
            <h2 id="delete-title">Supprimer cette carte ?</h2>
            <p>Elle sera effacée pour de bon et ne comptera plus pour ton bilan.</p>
            <div className="game-menu-dialog-actions">
              <button type="button" className="btn" disabled={deleting} onClick={() => void deleteOpenEntry()}>
                {deleting ? 'Je l’efface…' : 'Oui, supprimer'}
              </button>
              <button type="button" className="btn delete-cancel" disabled={deleting} onClick={cancelDelete}>
                Non, je la garde
              </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  )
}
