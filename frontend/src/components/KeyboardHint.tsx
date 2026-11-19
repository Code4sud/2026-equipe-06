import type { CSSProperties } from 'react'

interface KeyboardHintProps {
  /** Each line: the keys, then what they do ("choisir une carte") */
  items: { keys: string[]; label: string }[]
  className?: string
  style?: CSSProperties
}

/** A short reminder of how to use the app with the keyboard (hidden on touch screens). */
export function KeyboardHint({ items, className, style }: KeyboardHintProps) {
  return (
    <ul className={['keyboard-hint', className].filter(Boolean).join(' ')} style={style} aria-label="Au clavier">
      {items.map((item) => (
        <li key={item.label}>
          {item.keys.map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
