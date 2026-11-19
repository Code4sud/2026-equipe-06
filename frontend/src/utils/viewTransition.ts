import { flushSync } from 'react-dom'

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Runs a state update inside a View Transition when the browser supports it:
 * the browser animates from the old screen to the new one (see index.css).
 * Elements sharing a `view-transition-name` morph from one place to the other.
 */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown }
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update()
    return
  }
  doc.startViewTransition(() => flushSync(update))
}
