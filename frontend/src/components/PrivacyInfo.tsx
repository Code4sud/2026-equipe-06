import { useRef } from 'react'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './PrivacyInfo.css'

/**
 * « Tes données »: what the game keeps, why, who handles it and how to erase it (GDPR art. 13).
 * A link at the bottom of the home screen, opening a dialog.
 */
export function PrivacyInfo() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  function open() {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // The button is at the bottom: focus it without scrolling past the text (phones)
    closeRef.current?.focus({ preventScroll: true })
    dialog.scrollTop = 0
  }

  return (
    <>
      {/* data-own-enter: Enter opens this link instead of starting the game (see Home) */}
      <button type="button" className="btn-link privacy-link" onClick={open} data-own-enter>
        Tes données
      </button>

      <dialog
        ref={dialogRef}
        className="privacy-dialog"
        aria-labelledby="privacy-title"
        onKeyDown={(event) => {
          moveFocusWithArrows(event)
          event.stopPropagation()
        }}
      >
        <h2 id="privacy-title">Tes données</h2>

        <div className="privacy-grid">
          <section>
            <h3>Ce qu’on garde</h3>
            <ul>
              <li>Ton e-mail, pour te reconnaître et t’envoyer ton code.</li>
              <li>
                Ce que tu racontes pendant la partie. Si tu parles au micro, ta voix est transformée en texte :
                l’enregistrement n’est pas gardé.
              </li>
              <li>Ta collection de cartes.</li>
              <li>
                Tout est effacé <strong>6 mois après ta dernière visite</strong>.
              </li>
            </ul>
          </section>

          <section>
            <h3>Pourquoi</h3>
            <p>
              Pour t’aider à repérer ce que tu sais faire et préparer la suite avec ton conseiller. C’est tout : pas de
              pub, pas de revente, pas de note sur toi. Tu joues si tu veux, et c’est ton accord qui nous permet de
              garder ces données.
            </p>
          </section>

          <section>
            <h3>Ce qu’on ne retient pas</h3>
            <p>
              Ta santé, tes origines, ta religion, ta famille : si tu en parles, ça n’entre ni dans tes cartes ni dans
              ton bilan. À la fin, on te demande si tu veux qu’on en tienne compte pour tes pistes.
            </p>
          </section>

          <section>
            <h3>Qui s’en occupe</h3>
            <ul>
              <li>Mistral AI (France) fait parler l’IA et transforme ta voix en texte.</li>
              <li>Brevo (France) envoie l’e-mail avec ton code.</li>
              <li>Le site et la base de données sont hébergés en Europe (Render, MongoDB Atlas).</li>
            </ul>
          </section>

          <section className="privacy-wide">
            <h3>Tes droits</h3>
            <ul>
              <li>Tu peux supprimer une carte de ta collection quand tu veux.</li>
              <li>
                Tu peux tout effacer : connecte-toi, puis <strong>Quitter</strong> →{' '}
                <strong>Quitter et effacer toutes mes données</strong>.
              </li>
              <li>Ton bilan se télécharge en PDF : il est à toi.</li>
              <li>
                Si quelque chose ne va pas, tu peux t’adresser à la CNIL (cnil.fr).
              </li>
            </ul>
          </section>
        </div>

        <button ref={closeRef} type="button" className="btn privacy-close" onClick={() => dialogRef.current?.close()}>
          J’ai compris
        </button>
      </dialog>
    </>
  )
}
