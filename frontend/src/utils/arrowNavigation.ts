import type { KeyboardEvent } from 'react'
import { prefersReducedMotion } from './viewTransition'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [tabindex="0"]'

type Direction = 'up' | 'down' | 'left' | 'right'

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** Focuses an element and scrolls it into view smoothly (instead of the default jump). */
export function focusSmoothly(element: HTMLElement) {
  element.focus({ preventScroll: true })
  element.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
}

/**
 * Spatial navigation: the arrow keys move focus to the closest focusable element
 * in that direction (cards in a row, a button below them, a grid…).
 * Left/Right are left to text inputs to move the cursor.
 */
export function moveFocusWithArrows(event: KeyboardEvent<HTMLElement>) {
  const direction = KEY_DIRECTIONS[event.key]
  if (!direction) return
  const inTextField = event.target instanceof HTMLInputElement
  if (inTextField && (direction === 'left' || direction === 'right')) return

  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (items.length === 0) return

  const current = document.activeElement as HTMLElement | null
  if (!current || !items.includes(current)) {
    focusSmoothly(items[0])
    event.preventDefault()
    return
  }

  const next = closestInDirection(current, items, direction)
  if (next) focusSmoothly(next)
  event.preventDefault()
}

function closestInDirection(current: HTMLElement, items: HTMLElement[], direction: Direction) {
  const from = current.getBoundingClientRect()
  const fromX = from.left + from.width / 2
  const fromY = from.top + from.height / 2

  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const item of items) {
    if (item === current) continue
    const rect = item.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    // Only elements fully past the current one's edge count (ignores lifted or tilted neighbours)
    const isInDirection = {
      up: y < from.top,
      down: y > from.bottom,
      left: x < from.left,
      right: x > from.right,
    }[direction]
    if (!isInDirection) continue

    // Distance along the direction, with sideways offset weighing more
    const vertical = direction === 'up' || direction === 'down'
    const along = vertical ? Math.abs(y - fromY) : Math.abs(x - fromX)
    const across = vertical ? Math.abs(x - fromX) : Math.abs(y - fromY)
    const score = along + across * 2

    if (score < bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}
