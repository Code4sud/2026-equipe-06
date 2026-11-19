// Decorative shapes from the brand identity, drawn in a 100x100 viewBox.

type Point = [number, number]

interface ShapeProps {
  color: string
  outline?: boolean
  strokeWidth?: number
  className?: string
}

const CENTER = 50
const MAX_RADIUS = 46

function toPath(points: Point[]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`
}

function polar(radius: number, angle: number): Point {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

/** Wavy round shape with `lobes` bumps (yellow blob, orange flower). */
function wavyPath(lobes: number, depth: number): string {
  const steps = 180
  const points = Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2
    const radius = MAX_RADIUS - depth + depth * Math.cos(lobes * angle)
    return polar(radius, angle)
  })
  return toPath(points)
}

/** Spiky star with `spikes` points. */
function starPath(spikes: number, innerRatio: number): string {
  const points = Array.from({ length: spikes * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? MAX_RADIUS : MAX_RADIUS * innerRatio
    return polar(radius, (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2)
  })
  return toPath(points)
}

/** Six-armed asterisk outline (works filled or as an outline). */
function asteriskPath(armHalfWidth: number, armLength: number): string {
  const points: Point[] = []
  for (let k = 0; k < 6; k++) {
    const angle = (k * Math.PI) / 3 - Math.PI / 2
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)]
    const [nx, ny] = [-dy, dx]
    points.push([CENTER + armLength * dx - armHalfWidth * nx, CENTER + armLength * dy - armHalfWidth * ny])
    points.push([CENTER + armLength * dx + armHalfWidth * nx, CENTER + armLength * dy + armHalfWidth * ny])
    // Inner corner between this arm and the next one (arms are 60° apart)
    points.push(polar(armHalfWidth * 2, angle + Math.PI / 6))
  }
  return toPath(points)
}

/** Polygon with rounded corners. */
function roundedPolygonPath(points: Point[], radius: number): string {
  const corners = points.map((point, i) => {
    const prev = points[(i - 1 + points.length) % points.length]
    const next = points[(i + 1) % points.length]
    const towards = (target: Point): Point => {
      const dx = target[0] - point[0]
      const dy = target[1] - point[1]
      const length = Math.hypot(dx, dy)
      return [point[0] + (dx / length) * radius, point[1] + (dy / length) * radius]
    }
    return { start: towards(prev), corner: point, end: towards(next) }
  })
  const fmt = ([x, y]: Point) => `${x.toFixed(2)},${y.toFixed(2)}`
  return (
    `M${fmt(corners[0].end)}` +
    corners
      .slice(1)
      .concat(corners[0])
      .map(({ start, corner, end }) => `L${fmt(start)}Q${fmt(corner)} ${fmt(end)}`)
      .join('') +
    'Z'
  )
}

function Shape({ d, color, outline = false, strokeWidth = 6, className }: ShapeProps & { d: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill={outline ? 'none' : color}
        stroke={outline ? color : 'none'}
        strokeWidth={outline ? strokeWidth : 0}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export const Blob = (props: ShapeProps) => <Shape d={wavyPath(5, 6)} {...props} />

export const Flower = (props: ShapeProps) => <Shape d={wavyPath(6, 12)} {...props} />

export const Star = (props: ShapeProps) => <Shape d={starPath(8, 0.42)} {...props} />

export const Triangle = (props: ShapeProps) => (
  <Shape d={roundedPolygonPath([[30, 4], [96, 42], [6, 92]], 16)} {...props} />
)

export const Asterisk = (props: ShapeProps) => <Shape d={asteriskPath(11, 46)} {...props} />
