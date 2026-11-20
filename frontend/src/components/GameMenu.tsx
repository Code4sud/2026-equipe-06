import { useRef, useState } from 'react'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './GameMenu.css'

type Action = 'quit' | 'finish' | 'erase'

interface GameMenuProps {
  /** Quitter: after the confirmation. The game is kept, the user can come back with the e-mail */
  onQuit: () => Promise<void> | void
  /** Passer au bilan: absent where it makes no sense (the summary itself, the tutorial) */
  onFinish?: () => Promise<void> | void
  /** Effacer toutes mes données: after a second confirmation, from the Quitter dialog */
  onErase?: () => Promise<void> | void
}

/**
 * The commands available on every screen (docs/RULES_V2.md): Passer au bilan and Quitter.
 * Quitter always asks first.
 */
export function GameMenu({ onQuit, onFinish, onErase }: GameMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [failed, setFailed] = useState(false)
  // The Quitter dialog has a second step: confirming that everything is erased
  const [erasing, setErasing] = useState(false)

  function openDialog() {
    setErasing(false)
    dialogRef.current?.showModal()
  }

  async function run(action: Action) {
    setBusy(action)
    setFailed(false)
    try {
      await { quit: onQuit, finish: onFinish, erase: onErase }[action]?.()
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
        onClick={openDialog}
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
        {erasing ? (
          <>
            <h2 id="quit-title">Tout effacer ?</h2>
            <p>
              Ton e-mail, ce que tu as raconté et ta collection sont supprimés pour de bon. On ne pourra pas les
              retrouver.
            </p>
            {/* key: React gives new buttons, so autoFocus puts the focus on « Non » */}
            <div className="game-menu-dialog-actions" key="erase">
              <button type="button" className="btn" disabled={busy !== null} onClick={() => void run('erase')}>
                {busy === 'erase' ? 'On efface…' : 'Oui, tout effacer'}
              </button>
              <button type="button" className="btn" disabled={busy !== null} onClick={() => setErasing(false)} autoFocus>
                Non, je garde tout
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="quit-title">Tu veux vraiment quitter ?</h2>
            <p>Ce que tu as raconté est gardé : tu pourras reprendre plus tard avec ton e-mail.</p>
            <div className="game-menu-dialog-actions" key="quit">
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
            {onErase && (
              <button
                type="button"
                className="btn-link game-menu-erase"
                disabled={busy !== null}
                onClick={() => setErasing(true)}
              >
                Quitter et effacer toutes mes données
              </button>
            )}
          </>
        )}
      </dialog>
    </nav>
  )
}
