/**
 * Game sounds (Kenney "Casino Audio" and "Interface Sounds", CC0): files in public/sounds/,
 * with a short fade in and out baked in. A sound with several variants picks one at random,
 * so a row of cards does not sound mechanical.
 */
const SOUNDS = {
  draw: ['card-draw-1', 'card-draw-2', 'card-draw-3', 'card-draw-4'],
  discard: ['card-discard-1', 'card-discard-2', 'card-discard-3', 'card-discard-4'],
  place: ['card-place-1', 'card-place-2', 'card-place-3'],
  fan: ['card-fan'],
  select: ['select'],
  deselect: ['deselect'],
  reward: ['reward'],
} as const

export type Sound = keyof typeof SOUNDS

const VOLUME = 0.3
/** Sounds that need their own volume */
const VOLUME_BY_SOUND: Partial<Record<Sound, number>> = { reward: 0.18, select: 0.18, deselect: 0.18 }

// Loaded once, then cloned on each play so close sounds can overlap
const loaded = Object.fromEntries(
  Object.entries(SOUNDS).map(([sound, files]) => [
    sound,
    files.map((file) => {
      const audio = new Audio(`${import.meta.env.BASE_URL}sounds/${file}.mp3`)
      audio.preload = 'auto'
      return audio
    }),
  ]),
) as Record<Sound, HTMLAudioElement[]>

export function playSound(sound: Sound) {
  const variants = loaded[sound]
  const audio = variants[Math.floor(Math.random() * variants.length)].cloneNode() as HTMLAudioElement
  audio.volume = VOLUME_BY_SOUND[sound] ?? VOLUME
  // The browser may refuse to play before any click on the page: the game goes on silently
  audio.play().catch(() => {})
}

/** One sound per card, `staggerMs` apart, in step with the card animations. Returns a cancel function. */
export function playSounds(sound: Sound, count: number, staggerMs: number) {
  const timers = Array.from({ length: count }, (_, i) => setTimeout(() => playSound(sound), i * staggerMs))
  return () => timers.forEach(clearTimeout)
}
