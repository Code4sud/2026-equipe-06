import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { CodeInput } from '../components/CodeInput'
import { Logo } from '../components/Logo'
import { Asterisk, Blob, Star, Triangle } from '../components/Shapes'
import type { Session } from '../types'
import { moveFocusWithArrows } from '../utils/arrowNavigation'
import './Home.css'

type Step = 'start' | 'email' | 'code'

// Same length as the code sent by the backend (CODE_LENGTH in router.py)
const CODE_LENGTH = 6

// Local development (Vite dev server): no code to ask for, straight in after the e-mail
const SKIP_CODE = import.meta.env.DEV

interface HomeProps {
  onLogin: (session: Session) => void
}

export function Home({ onLogin }: HomeProps) {
  const [step, setStep] = useState<Step>('start')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Enter starts, wherever the focus is (the start line is also a button, for touch screens)
  useEffect(() => {
    if (step !== 'start') return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter') return
      event.preventDefault()
      setStep('email')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step])

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (SKIP_CODE) {
        onLogin(await api.createSession(email, ''))
        return
      }
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
    setStep(step === 'code' ? 'email' : 'start')
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
        {/* Same start for everyone: no "first time" or "coming back" */}
        {step === 'start' && (
          <button className="home-start" onClick={() => setStep('email')} autoFocus>
            Appuie sur <kbd>Entrée</kbd> pour commencer
          </button>
        )}

        {step === 'email' && (
          <form className="home-form rise-in" onSubmit={submitEmail}>
            <label className="field">
              <span>C’est quoi ton e-mail ?</span>
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
              {loading ? '…' : SKIP_CODE ? 'C’est parti' : 'Recevoir mon code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="home-form rise-in" onSubmit={submitCode}>
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

        {step !== 'start' && (
          <button className="btn-link" onClick={goBack}>
            ← Retour
          </button>
        )}
      </div>
    </main>
  )
}
