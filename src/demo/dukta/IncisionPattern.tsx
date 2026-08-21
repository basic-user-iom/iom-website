import type { ReactNode } from 'react'
import type { SystemId } from './data/systems'

type Props = {
  kind: SystemId
  openness?: number
  density?: number
  className?: string
  underlay?: string
}

export function IncisionPattern({
  kind,
  openness = 0.42,
  density = 1,
  className,
  underlay,
}: Props) {
  const cols = Math.max(8, Math.round(18 * density))
  const rows = Math.max(6, Math.round(12 * density))
  const gap = 0.35 + openness * 0.95
  const colW = 100 / cols
  const rowH = 100 / rows
  const cuts: ReactNode[] = []

  if (kind === 'foli') {
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (r % 2 === 1 && c % 2 === 0) continue
        cuts.push(
          <ellipse
            key={`${c}-${r}`}
            cx={c * colW + colW / 2}
            cy={r * rowH + rowH / 2}
            rx={gap * 0.9}
            ry={rowH * 0.28}
            fill="currentColor"
          />,
        )
      }
    }
  } else if (kind === 'duna') {
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        cuts.push(
          <rect
            key={`v-${c}-${r}`}
            x={c * colW + (colW - gap * 0.65) / 2}
            y={r * rowH + ((c + r) % 2 === 0 ? 1 : 0)}
            width={gap * 0.65}
            height={rowH * 0.55}
            fill="currentColor"
          />,
        )
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        cuts.push(
          <rect
            key={`h-${c}-${r}`}
            x={c * colW + ((r + c) % 2 === 0 ? 1 : 0)}
            y={r * rowH + (rowH - gap * 0.5) / 2}
            width={colW * 0.55}
            height={gap * 0.5}
            fill="currentColor"
          />,
        )
      }
    }
  } else {
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const stagger = c % 2 === 0 ? 0 : rowH * 0.35
        if (kind === 'sonar' && (c + r) % 2 === 0) continue
        if (kind === 'linar' && r % 3 === 1) continue
        if ((kind === 'janus' || kind === 'janus-tex') && r % 4 === 2) continue
        const h =
          kind === 'sonar' ? rowH * 0.5 : kind === 'linar' ? rowH * 0.78 : rowH * 0.7
        cuts.push(
          <rect
            key={`${c}-${r}`}
            x={c * colW + (colW - gap) / 2}
            y={r * rowH + stagger * 0.2}
            width={gap}
            height={h}
            fill="currentColor"
          />,
        )
      }
    }
  }

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {underlay ? <rect width="100" height="100" fill={underlay} /> : null}
      <g>{cuts}</g>
    </svg>
  )
}
