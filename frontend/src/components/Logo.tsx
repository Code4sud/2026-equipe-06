import { Flower, Star } from './Shapes'
import './Logo.css'

export function Logo() {
  return (
    <div className="logo">
      <h1 className="logo-title">Pioche ta voix</h1>
      <p className="logo-subtitle">Centre des possibles</p>
      <Star className="logo-star" color="var(--color-pink)" />
      <Flower className="logo-flower" color="var(--color-orange)" />
    </div>
  )
}
