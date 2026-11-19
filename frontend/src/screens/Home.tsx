import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { CodeInput } from '../components/CodeInput'
import { Logo } from '../components/Logo'
import { Asterisk, Blob, Star, Triangle } from '../components/Shapes'
import type { Session } from '../types'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Home.css'

type Step = 'choice' | 'email' | 'code'

const CODE_LENGTH = 6

interface HomeProps {
  onLogin: (session: Session) => void
}

export function Home({ onLogin }: HomeProps) {
  const [step, setStep] = useState<Step>('choice')
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function chooseMode(firstTime: boolean) {
    setIsFirstTime(firstTime)
    setStep('email')
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.requestCode(email)
      setStep('code')
    } catch {
      setError('Oups, ça n’a pas marché. Réessaie !')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.length < CODE_LENGTH || loading) return
    setLoading(true)
    setError(null)
    try {
      onLogin(await api.createSession(email, code))
    } catch {
      setError('Ce code ne marche pas. Vérifie et réessaie !')
      setLoading(false)
    }
  }

  function goBack() {
    setError(null)
    setStep(step === 'code' ? 'email' : 'choice')
  }

  return (
    <main className="home" onKeyDown={moveFocusWithArrows}>
      <div className="home-decor" aria-hidden="true">
        <Blob className="home-blob floating" color="var(--color-yellow)" />
        <Triangle className="home-triangle floating" color="var(--color-purple)" outline strokeWidth={8} />
        <Asterisk className="home-asterisk floating" color="var(--color-pink)" />
        <Star className="home-star floating" color="var(--color-green)" outline strokeWidth={8} />
      </div>

      <div className="home-logo floating">
        <Logo />
      </div>

      <div className="home-panel">
        {step === 'choice' && (
          <>
            <button className="btn" onClick={() => chooseMode(true)} autoFocus>
              C’est ma première fois
            </button>
            <button className="btn" onClick={() => chooseMode(false)}>
              Je reviens
            </button>
          </>
        )}

        {step === 'email' && (
          <form className="home-form" onSubmit={submitEmail}>
            <label className="field">
              <span>{isFirstTime ? 'Bienvenue ! C’est quoi ton e-mail ?' : 'Content de te revoir ! Ton e-mail ?'}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </label>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? '…' : 'Recevoir mon code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="home-form" onSubmit={submitCode}>
            <div className="field">
              <span>On t’a envoyé un code à {email}</span>
              <CodeInput length={CODE_LENGTH} onChange={setCode} label="Code reçu par e-mail" autoFocus />
            </div>
            {/* aria-disabled instead of disabled: stays reachable with ↓ from the boxes */}
            <button className="btn" type="submit" aria-disabled={code.length < CODE_LENGTH || loading}>
              {loading ? '…' : 'C’est parti'}
            </button>
          </form>
        )}

        {error && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}

        {step !== 'choice' && (
          <button className="btn-link" onClick={goBack}>
            ← Retour
          </button>
        )}
      </div>
    </main>
  )
}
