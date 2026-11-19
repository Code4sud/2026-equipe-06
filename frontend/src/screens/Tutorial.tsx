import type { ReactNode } from 'react'
import { Flower, Star } from '../components/Shapes'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Tutorial.css'

interface TutorialProps {
  isNewUser: boolean
  onStart: () => void
  /** Quitter (see GameMenu) */
  menu?: ReactNode
}

const STEPS = [
  { color: 'yellow', title: 'Tu pioches', text: 'Chaque carte, c’est un thème. Tu choisis celle qui te parle.' },
  {
    color: 'pink',
    title: 'On discute',
    text: 'Tu racontes, j’écoute. Ce que tu as fait rejoint ta collection, avec tes mots.',
  },
  {
    color: 'purple',
    title: 'Ton miroir',
    text: 'À la fin, c’est toi qui dis ce que tu retiens de toi, à partir de tes cartes.',
  },
  {
    color: 'green',
    title: 'Ton bilan',
    text: 'Tu gardes ou tu retires chaque carte, et tu repars avec des pistes à explorer.',
  },
] as const

export function Tutorial({ isNewUser, onStart, menu }: TutorialProps) {
  return (
    <main className="tutorial" onKeyDown={moveFocusWithArrows}>
      {menu}
      <div className="tutorial-decor" aria-hidden="true">
        <Flower className="tutorial-flower floating" color="var(--color-orange)" />
        <Star className="tutorial-star floating" color="var(--color-pink)" />
      </div>

      <h1 className="pill-title">{isNewUser ? 'Comment ça marche ?' : 'Content de te revoir !'}</h1>
      {!isNewUser && <p className="tutorial-lead">Petit rappel avant de reprendre :</p>}

      <ol className="tutorial-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className={`tutorial-step tutorial-step-${step.color}`}>
            <span className="tutorial-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <p className="tutorial-reassurance">
        Ici, pas de note et pas de mauvaise réponse. Rien n’est gardé sans ton accord.
      </p>
      {/* The commands are recalled at the start (docs/RULES_V2.md) */}
      <p className="tutorial-commands">
        À tout moment, tu peux passer une carte, aller directement au bilan ou quitter.
      </p>

      <button className="btn tutorial-start" onClick={onStart} autoFocus>
        Piocher
      </button>
    </main>
  )
}
