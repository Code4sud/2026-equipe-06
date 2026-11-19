import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import './CodeInput.css'

interface CodeInputProps {
  length: number
  /** Called with the digits typed so far, in order (complete when its length equals `length`) */
  onChange: (code: string) => void
  autoFocus?: boolean
  /** Accessible name of the group, e.g. "Code reçu par e-mail" */
  label: string
}

/** One box per digit: digits only, moves to the next box by itself, accepts a pasted code. */
export function CodeInput({ length, onChange, autoFocus, label }: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''))
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  function focusBox(index: number) {
    boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus()
  }

  function update(next: string[]) {
    setDigits(next)
    onChange(next.join(''))
  }

  /** Writes digits from a box onwards (one typed digit, or a whole pasted / autofilled code). */
  function fillFrom(index: number, text: string) {
    const typed = text.replace(/\D/g, '').slice(0, length - index)
    if (!typed) return
    const next = [...digits]
    typed.split('').forEach((digit, offset) => (next[index + offset] = digit))
    update(next)
    focusBox(index + typed.length)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index]) {
      // Empty box: go back and erase the previous digit
      event.preventDefault()
      if (index > 0) {
        const next = [...digits]
        next[index - 1] = ''
        update(next)
        focusBox(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    fillFrom(index, event.clipboardData.getData('text'))
  }

  return (
    <div className="code-input" role="group" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element
          }}
          className="code-input-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Chiffre ${index + 1} sur ${length}`}
          value={digit}
          autoFocus={autoFocus && index === 0}
          // Selecting the content lets a new digit replace the old one
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const value = event.target.value
            if (value === '') {
              const next = [...digits]
              next[index] = ''
              update(next)
            } else {
              fillFrom(index, value)
            }
          }}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
        />
      ))}
    </div>
  )
}
