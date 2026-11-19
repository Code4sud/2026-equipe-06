import type { ReactNode } from 'react'
import { Flower, Star } from '../components/Shapes'
import { KeyboardHint } from '../components/KeyboardHint'
import { delay } from '../utils/animation'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Tutorial.css'

interface TutorialProps {
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

export function Tutorial({ onStart, menu }: TutorialProps) {
  return (
    <main className="tutorial" onKeyDown={moveFocusWithArrows}>
      {menu}
      <div className="tutorial-decor" aria-hidden="true">
        <Flower className="tutorial-flower floating pop-in" color="var(--color-orange)" />
        <Star className="tutorial-star floating pop-in" color="var(--color-pink)" />
      </div>

      {/* Same screen for everyone: coming back starts a new game, only the collection is kept */}
      <h1 className="pill-title pop-in">Comment ça marche ?</h1>

      <ol className="tutorial-steps">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className={`tutorial-step tutorial-step-${step.color} pop-in`}
            style={delay(0.25 + index * 0.12)}
          >
            <span className="tutorial-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <p className="tutorial-reassurance rise-in" style={delay(0.8)}>
        Ici, pas de note et pas de mauvaise réponse. Rien n’est gardé sans ton accord.
      </p>
      {/* The commands are recalled at the start (docs/RULES_V2.md) */}
      <p className="tutorial-commands rise-in" style={delay(0.9)}>
        À tout moment, tu peux passer une carte, aller directement au bilan ou quitter.
      </p>

      <button className="btn tutorial-start pop-in" style={delay(1.15)} onClick={onStart} autoFocus>
        Piocher
      </button>

      <KeyboardHint
        className="rise-in"
        style={delay(1.3)}
        items={[
          { keys: ['←', '↑', '→', '↓'], label: 'te déplacer' },
          { keys: ['Entrée'], label: 'valider' },
          { keys: ['abc'], label: 'pendant la discussion, tape pour écrire au lieu de parler' },
        ]}
      />
    </main>
  )
}
