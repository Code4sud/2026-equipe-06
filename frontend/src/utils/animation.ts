import type { CSSProperties } from 'react'

/** Delay of a "pop-in" or "rise-in" entrance (index.css), in seconds, to stagger elements */
export const delay = (seconds: number) => ({ '--delay': `${seconds}s` }) as CSSProperties
