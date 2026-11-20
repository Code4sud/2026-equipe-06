import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { api } from '../api'

/** Formats the browsers can record, with the extension the backend expects for each */
const FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' }, // Chrome, Edge
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' }, // Firefox
  { mimeType: 'audio/mp4', extension: 'mp4' }, // Safari
]

/** How often what has been said so far is turned into text while the user speaks */
const LIVE_INTERVAL_MS = 2000
/** After this, no more text while speaking (each update sends the whole recording again) */
const LIVE_MAX_MS = 90_000

const supported =
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function'

function pickFormat() {
  return FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null
}

function extensionOf(mimeType: string) {
  return FORMATS.find((format) => mimeType.startsWith(format.mimeType.split(';')[0]))?.extension ?? 'webm'
}

/**
 * not-allowed: the microphone was refused · audio-capture: no microphone, or it is busy
 * network: the recording could not be turned into text
 */
export type SpeechError = 'not-allowed' | 'audio-capture' | 'network'

/**
 * Speech to text through the backend (Voxtral, Mistral): the answer is recorded in the browser. While
 * the user speaks, the recording so far is turned into text every 2 s (`transcript`), and the element
 * given as `levelRef` gets the voice level in its `--level` CSS variable (0 to 1). `stop` gives the
 * final text. Works in every browser that can record (Firefox included), and the audio does not go to
 * Google as it did with the Web Speech API.
 */
export function useSpeechRecognition(sessionId: string, levelRef?: RefObject<HTMLElement | null>) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  // What has been heard so far, a little behind the voice
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<SpeechError | null>(null)
  // One microphone stream for the whole turn: asking again at each answer would make Firefox ask again
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Bumped by each start, stop and cancel: what is still pending for an older recording is dropped
  const attemptRef = useRef(0)
  // Stops the live text and the level meter of the current recording
  const stopLiveRef = useRef<() => void>(() => {})

  /** The recording so far, as a file the backend can read (the first chunk holds the header) */
  const recordedAudio = useCallback((recorder: MediaRecorder) => {
    const mimeType = recorder.mimeType || pickFormat()?.mimeType || 'audio/webm'
    return { audio: new Blob(chunksRef.current, { type: mimeType }), filename: `answer.${extensionOf(mimeType)}` }
  }, [])

  /** Text while speaking and voice level, until the returned function is called */
  const startLive = useCallback(
    (recorder: MediaRecorder, stream: MediaStream, attempt: number) => {
      const startedAt = Date.now()
      let inFlight = false
      let sentChunks = 0
      const liveTimer = setInterval(() => {
        if (Date.now() - startedAt > LIVE_MAX_MS) return clearInterval(liveTimer)
        const chunkCount = chunksRef.current.length
        if (inFlight || chunkCount === sentChunks) return
        inFlight = true
        sentChunks = chunkCount
        const { audio, filename } = recordedAudio(recorder)
        api
          .transcribe(sessionId, audio, filename)
          .then((text) => {
            if (attempt === attemptRef.current && text.trim()) setTranscript(text.trim())
          })
          // A missed update is not a problem: the next one or the final text catches up
          .catch(() => {})
          .finally(() => {
            inFlight = false
          })
      }, LIVE_INTERVAL_MS)

      // Voice level, written straight on the element (no React render 60 times a second)
      let context: AudioContext | null = null
      let frame = 0
      try {
        context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        context.createMediaStreamSource(stream).connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        const tick = () => {
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          for (const sample of samples) sum += sample * sample
          // Speech is around 0.02 to 0.2 in RMS: spread it over 0 to 1
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 6)
          levelRef?.current?.style.setProperty('--level', level.toFixed(3))
          frame = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        // No level meter: the rings still show that the mic listens
      }

      return () => {
        clearInterval(liveTimer)
        cancelAnimationFrame(frame)
        void context?.close()
        levelRef?.current?.style.setProperty('--level', '0')
      }
    },
    [sessionId, recordedAudio, levelRef],
  )

  const start = useCallback(async () => {
    if (!supported || recorderRef.current) return
    const attempt = ++attemptRef.current
    setError(null)
    let stream: MediaStream
    try {
      stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: true }))
    } catch (err) {
      if (attempt === attemptRef.current)
        setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')
      return
    }
    if (attempt !== attemptRef.current) {
      // Cancelled or left while waiting: a stream opened for nothing is closed
      if (stream !== streamRef.current) stream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = stream
    const format = pickFormat()
    const recorder = new MediaRecorder(stream, format ? { mimeType: format.mimeType } : undefined)
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorderRef.current = recorder
    setTranscript('')
    // Chunks every second, so the live text can send what has been said so far
    recorder.start(1000)
    stopLiveRef.current = startLive(recorder, stream, attempt)
    setListening(true)
  }, [startLive])

  /** Stops the recording and gives what was heard as text ('' when nothing was said). */
  const stop = useCallback(async (): Promise<string> => {
    attemptRef.current += 1
    stopLiveRef.current()
    const recorder = recorderRef.current
    if (!recorder) return ''
    recorderRef.current = null
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.stop()
    await stopped
    setListening(false)

    const { audio, filename } = recordedAudio(recorder)
    chunksRef.current = []
    if (audio.size === 0) return ''

    setTranscribing(true)
    try {
      const text = (await api.transcribe(sessionId, audio, filename)).trim()
      setTranscript('')
      return text
    } catch (err) {
      setError('network')
      throw err
    } finally {
      setTranscribing(false)
    }
  }, [sessionId, recordedAudio])

  /** Stops listening and throws away what was heard. */
  const cancel = useCallback(() => {
    attemptRef.current += 1
    stopLiveRef.current()
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.stop()
    }
    chunksRef.current = []
    setTranscript('')
    setListening(false)
  }, [])

  // Release the microphone when leaving the screen
  useEffect(
    () => () => {
      attemptRef.current += 1
      stopLiveRef.current()
      recorderRef.current?.stop()
      recorderRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    },
    [],
  )

  return { supported, listening, transcribing, transcript, error, start, stop, cancel }
}
