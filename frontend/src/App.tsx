import { useState } from 'react'
import { api } from './api'
import { GameMenu } from './components/GameMenu'
import { CollectionPage } from './screens/CollectionPage'
import { Drawing } from './screens/Drawing'
import { Home } from './screens/Home'
import { Summary } from './screens/Summary'
import { Turn } from './screens/Turn'
import { Tutorial } from './screens/Tutorial'
import type { ActiveTurn, Card, Session, SessionState } from './types'
import { withViewTransition } from './utils/viewTransition'

type Screen = 'home' | 'tutorial' | 'collection' | SessionState

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [turn, setTurn] = useState<ActiveTurn | null>(null)
  // Kept here so going to the collection and back shows the same cards
  const [drawnCards, setDrawnCards] = useState<Card[] | null>(null)
  // Changing the key remounts the drawing screen, for a fresh draw with its animation
  const [drawKey, setDrawKey] = useState(0)

  /** Every screen change goes through a View Transition (see index.css) */
  function goTo(next: Screen) {
    withViewTransition(() => setScreen(next))
  }

  function handleLogin(newSession: Session) {
    withViewTransition(() => {
      setSession(newSession)
      setScreen('tutorial')
    })
  }

  function handleCardChosen(newTurn: ActiveTurn) {
    // For a turn, the chosen card morphs into the big card on the left;
    // the mirror is a plain screen change
    withViewTransition(() => {
      setTurn(newTurn)
      setDrawnCards(null)
      setScreen(newTurn.card.format === 'mirror' ? 'mirror' : 'in_turn')
    })
  }

  /** The card being played, if the user is in a conversation right now */
  const turnInProgress = turn && (screen === 'in_turn' || screen === 'mirror') ? turn : null

  function backHome() {
    withViewTransition(() => {
      setSession(null)
      setTurn(null)
      setDrawnCards(null)
      setScreen('home')
    })
  }

  /** Quitter: the card in progress stops (what was said is kept), then back to the home screen */
  async function quit() {
    if (session && turnInProgress) {
      try {
        await api.skipTurn(session.sessionId, turnInProgress.turnId)
      } catch {
        // Leaving must always work: at worst this card is not analyzed
      }
    }
    backHome()
  }

  /** Passer au bilan: ends the card in progress, then straight to the summary (no mirror) */
  async function finish() {
    if (!session) return
    await api.finishGame(session.sessionId, turnInProgress?.turnId)
    withViewTransition(() => {
      setTurn(null)
      setDrawnCards(null)
      setScreen('summary')
    })
  }

  const menu = <GameMenu onQuit={quit} onFinish={finish} />
  const quitOnlyMenu = <GameMenu onQuit={quit} />

  if (!session || screen === 'home') {
    return <Home onLogin={handleLogin} />
  }

  if (screen === 'tutorial') {
    // Resume where the session left off (drawing for a new user)
    // A card cannot be resumed in the middle: the backend closes it, and the game goes back to the draw
    const resumeAt = session.state === 'in_turn' || session.state === 'mirror' ? 'drawing' : session.state
    return <Tutorial isNewUser={session.isNew} onStart={() => goTo(resumeAt)} menu={quitOnlyMenu} />
  }

  if (screen === 'drawing') {
    return (
      <Drawing
        key={drawKey}
        sessionId={session.sessionId}
        cards={drawnCards}
        onCardsDrawn={setDrawnCards}
        onCardChosen={handleCardChosen}
        onOpenCollection={() => goTo('collection')}
        menu={menu}
        onRedraw={() => {
          setDrawnCards(null)
          setDrawKey((key) => key + 1)
        }}
      />
    )
  }

  if (screen === 'collection') {
    return <CollectionPage sessionId={session.sessionId} onBack={() => goTo('drawing')} menu={menu} />
  }

  // TODO: resuming a session in the middle of a turn (no ActiveTurn in memory yet)
  if (screen === 'in_turn' && turn) {
    return (
      <Turn
        key={turn.turnId}
        sessionId={session.sessionId}
        turn={turn}
        onTurnEnded={() => goTo('drawing')}
        menu={menu}
      />
    )
  }

  // Mirror: a turn on a screen of its own, with the card picking first; then the agent's summary
  if (screen === 'mirror' && turn) {
    return (
      <Turn
        key={turn.turnId}
        sessionId={session.sessionId}
        turn={turn}
        onTurnEnded={() => goTo('summary')}
        menu={menu}
      />
    )
  }

  if (screen === 'summary') {
    return (
<Summary sessionId={session.sessionId} onFinish={backHome} menu={quitOnlyMenu} />
    )
  }

  // TODO: resuming a session in the middle of a turn
  return (
    <main style={{ padding: 'var(--space-4)' }}>
      <p>Écran « {screen} » à venir.</p>
    </main>
  )
}

export default App
