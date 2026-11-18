import { useState } from 'react'
import { CollectionPage } from './screens/CollectionPage'
import { Drawing } from './screens/Drawing'
import { Home } from './screens/Home'
import { Turn } from './screens/Turn'
import { Tutorial } from './screens/Tutorial'
import type { ActiveTurn, Card, Session, SessionState } from './types'

type Screen = 'home' | 'tutorial' | 'collection' | SessionState

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [turn, setTurn] = useState<ActiveTurn | null>(null)
  // Kept here so going to the collection and back shows the same cards
  const [drawnCards, setDrawnCards] = useState<Card[] | null>(null)

  function handleLogin(newSession: Session) {
    setSession(newSession)
    setScreen('tutorial')
  }

  function handleCardChosen(newTurn: ActiveTurn) {
    setTurn(newTurn)
    setDrawnCards(null)
    setScreen(newTurn.card.format === 'mirror' ? 'mirror' : 'in_turn')
  }

  if (!session || screen === 'home') {
    return <Home onLogin={handleLogin} />
  }

  if (screen === 'tutorial') {
    // Resume where the session left off (drawing for a new user)
    return <Tutorial isNewUser={session.isNew} onStart={() => setScreen(session.state)} />
  }

  if (screen === 'drawing') {
    return (
      <Drawing
        sessionId={session.sessionId}
        cards={drawnCards}
        onCardsDrawn={setDrawnCards}
        onCardChosen={handleCardChosen}
        onOpenCollection={() => setScreen('collection')}
      />
    )
  }

  if (screen === 'collection') {
    return <CollectionPage sessionId={session.sessionId} onBack={() => setScreen('drawing')} />
  }

  // TODO: resuming a session in the middle of a turn (no ActiveTurn in memory yet)
  if (screen === 'in_turn' && turn) {
    return (
      <Turn key={turn.turnId} sessionId={session.sessionId} turn={turn} onTurnEnded={() => setScreen('drawing')} />
    )
  }

  // TODO: mirror and summary screens
  return (
    <main style={{ padding: 'var(--space-4)' }}>
      <p>Écran « {screen} » à venir.</p>
    </main>
  )
}

export default App
