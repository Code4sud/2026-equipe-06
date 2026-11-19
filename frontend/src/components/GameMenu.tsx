import { useRef, useState } from 'react'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './GameMenu.css'

interface GameMenuProps {
  /** Quitter: after the confirmation. The game is kept, the user can come back with the e-mail */
  onQuit: () => Promise<void> | void
  /** Passer au bilan: absent where it makes no sense (the summary itself, the tutorial) */
  onFinish?: () => Promise<void> | void
}

/**
 * The commands available on every screen (docs/RULES_V2.md): Passer au bilan and Quitter.
 * Quitter always asks first.
 */
export function GameMenu({ onQuit, onFinish }: GameMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState<'quit' | 'finish' | null>(null)
  const [failed, setFailed] = useState(false)

  async function run(action: 'quit' | 'finish') {
    setBusy(action)
    setFailed(false)
    try {
      await (action === 'quit' ? onQuit() : onFinish?.())
    } catch {
      setFailed(true)
    } finally {
      // The screen usually changes before this, but if the call failed the buttons come back
      setBusy(null)
      dialogRef.current?.close()
    }
  }

  return (
    <nav className="game-menu" aria-label="Commandes de la partie">
      {onFinish && (
        <button type="button" className="game-menu-button" disabled={busy !== null} onClick={() => void run('finish')}>
          {busy === 'finish' ? 'On y va…' : 'Passer au bilan'}
        </button>
      )}
      <button
        type="button"
        className="game-menu-button"
        disabled={busy !== null}
        onClick={() => dialogRef.current?.showModal()}
      >
        Quitter
      </button>

      {failed && (
        <p className="game-menu-error" role="alert">
          Ça n’a pas marché, réessaie.
        </p>
      )}

      {/* Arrows move between the dialog's buttons only: the screen behind cannot take the focus */}
      <dialog
        ref={dialogRef}
        className="game-menu-dialog"
        aria-labelledby="quit-title"
        onKeyDown={(event) => {
          moveFocusWithArrows(event)
          event.stopPropagation()
        }}
      >
        <h2 id="quit-title">Tu veux vraiment quitter ?</h2>
        <p>Ce que tu as raconté est gardé : tu pourras reprendre plus tard avec ton e-mail.</p>
        <div className="game-menu-dialog-actions">
          <button type="button" className="btn" disabled={busy !== null} onClick={() => void run('quit')}>
            {busy === 'quit' ? 'À bientôt…' : 'Oui, quitter'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            Non, je reste
          </button>
        </div>
      </dialog>
    </nav>
  )
}
