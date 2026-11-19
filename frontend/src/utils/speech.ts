import { api } from '../api'
import type { Tone } from '../types'

/**
 * After this, the text is shown without the voice. The voice usually comes in 1 to 3 s, but Mistral
 * sometimes takes longer: 5 s was too short and the sound was lost. Meanwhile the orb "thinks".
 */
const LOAD_TIMEOUT_MS = 12000

/**
 * Silence before the voice. When nothing plays, the sound card falls asleep (Linux especially) and
 * takes a few hundred milliseconds to wake up: without this, the start of the sentence was lost.
 */
const LEAD_IN_S = 0.3

export interface LoadedSpeech {
  /** Length of the audio, lead-in included, to pace the words on screen */
  durationMs: number
  /** Plays the audio; resolves when it ends (or right away if the browser refuses to play it) */
  play: () => Promise<void>
  stop: () => void
}

let sharedContext: AudioContext | null = null

/**
 * Requests in flight or done, by text: the same text is never asked twice (React runs effects twice
 * in development, and the summary paragraph can be asked again when coming back to it)
 */
const requests = new Map<string, Promise<Blob | null>>()

function fetchVoice(sessionId: string, text: string, tone: Tone): Promise<Blob | null> {
  const key = `${sessionId}|${tone}|${text}`
  let request = requests.get(key)
  if (!request) {
    request = api.speak(sessionId, text, tone).catch(() => null)
    requests.set(key, request)
    // A failed request can be tried again later
    void request.then((blob) => {
      if (!blob) requests.delete(key)
    })
  }
  return request
}

/**
 * One audio context for the whole game. Once running, it keeps the audio output open between
 * sentences, so the sound card does not fall asleep while the user answers.
 */
function audioContext(): AudioContext | null {
  if (sharedContext) return sharedContext
  try {
    sharedContext = new AudioContext()
  } catch {
    return null
  }
  return sharedContext
}

/** Fetches and decodes the assistant's voice for a text. null: no voice, the text is shown silently. */
export async function loadSpeech(sessionId: string, text: string, tone: Tone = 'neutral'): Promise<LoadedSpeech | null> {
  const context = audioContext()
  if (!context) return null

  const blob = await Promise.race([
    fetchVoice(sessionId, text, tone),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_TIMEOUT_MS)),
  ])
  if (!blob) {
    console.warn('Voice not available for this sentence: shown without sound')
    return null
  }

  let buffer: AudioBuffer
  try {
    buffer = await context.decodeAudioData(await blob.arrayBuffer())
  } catch {
    return null
  }

  let source: AudioBufferSourceNode | null = null
  let finish: () => void = () => {}
  const ended = new Promise<void>((resolve) => {
    finish = resolve
  })

  return {
    durationMs: (buffer.duration + LEAD_IN_S) * 1000,
    play: async () => {
      try {
        // The context may start suspended until the page has been clicked: the card click counts
        if (context.state !== 'running') await context.resume()
        if (context.state !== 'running') throw new Error('audio not allowed')
        source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.onended = () => finish()
        source.start(context.currentTime + LEAD_IN_S)
      } catch {
        // Autoplay refused: the text still shows, silently
        finish()
      }
      await ended
    },
    stop: () => {
      try {
        source?.stop()
      } catch {
        // Already stopped
      }
      finish()
    },
  }
}
