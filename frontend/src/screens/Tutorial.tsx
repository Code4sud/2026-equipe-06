import { Flower, Star } from '../components/Shapes'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Tutorial.css'

interface TutorialProps {
  isNewUser: boolean
  onStart: () => void
}

const STEPS = [
  { color: 'yellow', title: 'Tu pioches', text: 'Chaque carte, c’est un thème. Tu choisis celle qui te parle.' },
  { color: 'pink', title: 'On discute', text: 'Quelques questions, rien de compliqué. Tu racontes, j’écoute.' },
  { color: 'purple', title: 'Je te fais un miroir', text: 'Je te dis ce que j’ai compris. Tu gardes, tu modifies ou tu jettes.' },
  { color: 'green', title: 'Ta collection grandit', text: 'À la fin, tu repars avec tes cartes à toi.' },
] as const

export function Tutorial({ isNewUser, onStart }: TutorialProps) {
  return (
    <main className="tutorial" onKeyDown={moveFocusWithArrows}>
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

      <button className="btn tutorial-start" onClick={onStart} autoFocus>
        Piocher
      </button>
    </main>
  )
}
