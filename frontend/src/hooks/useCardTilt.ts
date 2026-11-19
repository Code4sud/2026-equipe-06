import { useCallback, useRef, type PointerEvent } from 'react'
import { prefersReducedMotion } from '../utils/viewTransition'

/** Maximum tilt in degrees, kept very light */
const MAX_TILT_DEG = 7

const POINTER_VARIABLES = ['--tilt-x', '--tilt-y', '--glare-x', '--glare-y', '--shine-angle']

/**
 * Light 3D tilt, reflection and metallic border bands that follow the pointer.
 * Writes CSS variables straight on the `ref` element (no re-render on every move); put `ref` on the element
 * that tilts, and the handlers on the element that receives the pointer.
 * See styles/cardShine.css and GameCard.css for what the variables drive.
 */
export function useCardTilt(enabled = true) {
  const element = useRef<HTMLElement | null>(null)
  // Callback ref: fits a button, a div or a span alike
  const ref = useCallback((node: HTMLElement | null) => {
    element.current = node
  }, [])

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const target = element.current
      if (!target || !enabled || prefersReducedMotion()) return
      const rect = event.currentTarget.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      target.style.setProperty('--tilt-x', `${-(y - 0.5) * 2 * MAX_TILT_DEG}deg`)
      target.style.setProperty('--tilt-y', `${(x - 0.5) * 2 * MAX_TILT_DEG}deg`)
      target.style.setProperty('--glare-x', `${x * 100}%`)
      target.style.setProperty('--glare-y', `${y * 100}%`)
      // The metallic bands of the border turn as the pointer moves
      target.style.setProperty('--shine-angle', `${35 + (x - 0.5) * 120 + (y - 0.5) * 60}deg`)
    },
    [enabled],
  )

  const onPointerLeave = useCallback(() => {
    // Back to the values from the CSS (flat card, or the keyboard selection pose)
    for (const name of POINTER_VARIABLES) element.current?.style.removeProperty(name)
  }, [])

  return { ref, onPointerMove, onPointerLeave }
}
