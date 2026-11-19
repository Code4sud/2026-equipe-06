import { Blob, Flower } from './Shapes'
import './AssistantOrb.css'

export type OrbState = 'idle' | 'speaking' | 'thinking' | 'listening'

interface AssistantOrbProps {
  state: OrbState
}

/** Animated shape standing for the assistant, in the colors of the current card. */
export function AssistantOrb({ state }: AssistantOrbProps) {
  return (
    <div className={`orb is-${state}`} aria-hidden="true">
      <Blob className="orb-halo" color="var(--card-back)" />
      <Flower className="orb-body" color="var(--card-color)" />
    </div>
  )
}
