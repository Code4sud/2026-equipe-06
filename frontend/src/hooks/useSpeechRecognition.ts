import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typing of the Web Speech API (not in TypeScript's DOM lib everywhere)
interface RecognitionResultList {
  length: number
  [index: number]: { 0: { transcript: string }; isFinal: boolean }
}

interface RecognitionEvent {
  results: RecognitionResultList
}

interface RecognitionErrorEvent {
  error: string
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => Recognition

const RecognitionImpl: RecognitionConstructor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionConstructor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition

/**
 * Speech to text with the browser's Web Speech API.
 * TEMPORARY: to be replaced by the backend (POST /api/stt, local Whisper) for sovereignty:
 * in Chrome, the audio is sent to Google's servers. Not available in Firefox.
 */
export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)

  const start = useCallback(() => {
    if (!RecognitionImpl || recognitionRef.current) return
    const recognition = new RecognitionImpl()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      setTranscript(text.trim())
    }
    recognition.onerror = (event) => setError(event.error)
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    recognitionRef.current = recognition
    setError(null)
    setTranscript('')
    recognition.start()
    setListening(true)
  }, [])

  /** Stops listening and throws away what was heard. */
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onresult = null
      recognition.abort()
    }
    setTranscript('')
  }, [])

  // Release the microphone when leaving the screen
  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported: RecognitionImpl !== undefined, listening, transcript, error, start, cancel }
}
