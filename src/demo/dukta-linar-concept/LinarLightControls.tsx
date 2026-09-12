import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { LinarApplication, LinarBacking, LinarLightPlacement, LinarLightState } from './types'
import {
  formatLinarLightSurfaceClearance,
  LINAR_LIGHT_MAX_HEIGHT_PERCENT,
  LINAR_LIGHT_MIN_HEIGHT_PERCENT,
  linarLightHeightPercent,
  linarLightOrbitDegrees,
  linarLightSurfaceClearanceM,
  linarLightValueForHeightPercent,
  linarLightValueForOrbitDegrees,
  linarLightValueForSurfaceClearanceM,
} from './lightRig'
import './lightControls.css'

type Props = {
  light: LinarLightState
  application: LinarApplication
  backing: LinarBacking
  onChange: (patch: Partial<LinarLightState>) => void
  onPlacement: (placement: LinarLightPlacement) => void
  onToggle: () => void
  onReset: () => void
  onFind: () => void
}

function LightRange({
  id, label, value, min, max, display, unit, onChange,
  numberValue = value, numberMin = min, numberMax = max, onNumberChange = onChange,
}: {
  id: string; label: string; value: number; min: number; max: number
  display: string; unit: string; onChange: (value: number) => void
  numberValue?: number; numberMin?: number; numberMax?: number
  onNumberChange?: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  return (
    <div className="linar-viewport-light-range">
      <div className="linar-control__head">
        <label htmlFor={id}>{label}</label>
        <span className="linar-light-number">
          <input
            type="number" aria-label={label + ' (' + unit + ')'}
            min={numberMin} max={numberMax} step={1}
            value={draft ?? Math.round(numberValue)}
            onFocus={() => { cancelled.current = false; setDraft(String(Math.round(numberValue))) }}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={(event) => {
              const raw = event.currentTarget.value.trim()
              const next = Number(raw)
              if (!cancelled.current && raw !== '' && Number.isFinite(next)) {
                onNumberChange(Math.max(numberMin, Math.min(numberMax, next)))
              }
              setDraft(null)
              cancelled.current = false
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                cancelled.current = true
                event.currentTarget.blur()
                event.stopPropagation()
              } else if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
      </div>
      <input id={id} className="linar-slider" type="range" min={min} max={max}
        step={1} value={value} aria-valuetext={display}
        onInput={(event) => onChange(Number(event.currentTarget.value))} />
    </div>
  )
}

function LightPositionMap({ light, mounted, onChange }: {
  light: LinarLightState; mounted: boolean; onChange: Props['onChange']
}) {
  const drag = useRef<{ pointer: number; originU: number } | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const cancel = () => {
    const origin = drag.current
    drag.current = null
    if (origin) onChangeRef.current({ u: origin.originU })
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', cancel)
    }
  }, [])
  const sign = mounted && light.placement === 'behind' ? -1 : 1
  const limit = mounted ? Math.PI / 2 : Math.PI
  const point = (u: number) => ({
    x: 120 + Math.sin(u * limit) * 67,
    y: 91 + Math.cos(u * limit) * 67 * sign,
  })
  const orb = point(light.u)
  const path = Array.from({ length: 65 }, (_, i) => {
    const p = point(i / 32 - 1)
    return (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)
  }).join(' ')
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * 240 - 120
    const y = (event.clientY - rect.top) / rect.height * 200 - 91
    if (Math.hypot(x, y) < 18) return
    onChange({ u: linarLightValueForOrbitDegrees(Math.atan2(x, y * sign) * 180 / Math.PI, mounted) })
  }
  const finish = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    if (drag.current?.pointer !== event.pointerId) return
    if (commit) { move(event); drag.current = null } else cancel()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return (
    <div className="linar-light-map-wrap">
      <div className="linar-light-map" role="group" aria-label="Panel orientation and light direction. Use the Around panel slider for keyboard control."
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || drag.current) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointer: event.pointerId, originU: light.u }
          move(event)
        }}
        onPointerMove={(event) => { if (drag.current?.pointer === event.pointerId) move(event) }}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onLostPointerCapture={() => cancel()}
      >
        <svg viewBox="0 0 240 200" aria-hidden="true">
          <circle className="linar-light-map__inactive" cx="120" cy="91" r="67" />
          <path className="linar-light-map__track" d={path} />
          <path className="linar-light-map__ticks" d="M120 18v3 M120 161v3 M47 91h3 M190 91h3" />
          <line className="linar-light-map__beam" x1={orb.x} y1={orb.y} x2="120" y2="91" />
          {/* Schematic panel edge: alternating incisions retain a continuous central bridge. */}
          <g className="linar-light-map__panel">
            <rect className="linar-light-map__panel-face" x="76" y="83" width="88" height="16" rx="1" />
            <path className="linar-light-map__panel-edge" d="M77 96.5h86" />
            {Array.from({ length: 21 }, (_, index) => {
              const x = 80 + index * 4
              const fromBack = index % 2 === 0
              return <line key={index} className="linar-light-map__panel-cut"
                x1={x} x2={x} y1={fromBack ? 83.5 : 92} y2={fromBack ? 90 : 98.5} />
            })}
          </g>
          <text className="linar-light-map__label linar-light-map__label--panel" x="120" y="73">LINAR</text>
          <text className="linar-light-map__label" x="120" y="12">BACK</text>
          <text className="linar-light-map__label" x="120" y="186">FRONT / ROOM</text>
          <circle className="linar-light-map__halo" cx={orb.x} cy={orb.y} r="13" />
          <circle className="linar-light-map__orb-ring" cx={orb.x} cy={orb.y} r="9" />
          <circle className="linar-light-map__orb" cx={orb.x} cy={orb.y} r="5" />
        </svg>
      </div>
      <p className="linar-viewport-menu__hint">Click the path or drag the dot. Diagram stays aligned with the panel.</p>
    </div>
  )
}

const PRESETS = [
  { id: 'front', label: 'Frontal', degrees: 0, height: 75, distance: 0.8, intensity: 50 },
  { id: 'left', label: 'From left', degrees: -55, height: 70, distance: 0.6, intensity: 50 },
  { id: 'right', label: 'From right', degrees: 55, height: 70, distance: 0.6, intensity: 50 },
  { id: 'grazing', label: 'Grazing', degrees: -78, height: 55, distance: 0.15, intensity: 60 },
] as const

export function LinarLightControls({ light, application, backing, onChange, onPlacement, onToggle, onReset, onFind }: Props) {
  const mounted = application !== 'freestanding'
  const height = Math.round(linarLightHeightPercent(light.v))
  const angle = Math.round(linarLightOrbitDegrees(light.u, mounted))
  const distanceCm = linarLightSurfaceClearanceM(light.radius) * 100
  const heightLabel = application === 'ceiling' ? 'Along panel' : 'Height'
  return (
    <>
      <div className="linar-viewport-light-panel__head">
        <div><strong>Movable light</strong><span>Explore light and shadow</span></div>
        <button type="button" className={light.enabled ? 'is-active' : ''} aria-label="Movable light" aria-pressed={light.enabled} onClick={onToggle}>{light.enabled ? 'ON' : 'OFF'}</button>
      </div>
      <fieldset className="linar-viewport-menu__group">
        <legend>Start with a position</legend>
        <div className="linar-light-presets">
          {PRESETS.map((preset) => {
            const active = light.enabled && Math.abs(angle - preset.degrees) < 1 &&
              Math.abs(height - preset.height) < 1 && Math.abs(distanceCm - preset.distance * 100) < 1 &&
              Math.abs(light.intensity - preset.intensity) < 1
            return <button type="button" key={preset.id} className={active ? 'is-active' : ''} aria-pressed={active}
              title={preset.id === 'grazing' ? 'Low-angle light to explore the surface and shadows' : undefined}
              onClick={() => onChange({
                enabled: true, u: linarLightValueForOrbitDegrees(preset.degrees, mounted),
                v: linarLightValueForHeightPercent(preset.height),
                radius: linarLightValueForSurfaceClearanceM(preset.distance), intensity: preset.intensity,
              })}>
              <span aria-hidden="true">{preset.id === 'front' ? '↓' : preset.id === 'left' ? '↘' : preset.id === 'right' ? '↙' : '→'}</span>
              {preset.id === 'front' && mounted && light.placement === 'behind' ? 'Centred' : preset.label}
            </button>
          })}
        </div>
      </fieldset>
      {light.enabled ? (
        <>
          {mounted ? (
            <fieldset className="linar-viewport-menu__group">
              <legend>Light side</legend>
              <div className="linar-viewport-menu__choices">
                {(['room', 'behind'] as const).map((placement) => (
                  <button type="button" key={placement} className={light.placement === placement ? 'is-active' : ''}
                    aria-pressed={light.placement === placement} disabled={placement === 'behind' && backing === 'felt'}
                    aria-describedby={placement === 'behind' && backing === 'felt' ? 'linar-orb-behind-unavailable' : undefined}
                    onClick={() => onPlacement(placement)}>{placement === 'room' ? 'Room side' : 'Behind panel'}</button>
                ))}
              </div>
              {backing === 'felt' ? <p id="linar-orb-behind-unavailable" className="linar-viewport-menu__hint">Behind-panel light is unavailable with opaque wool felt.</p> : null}
            </fieldset>
          ) : null}
          <LightPositionMap key={application + ':' + light.placement} light={light} mounted={mounted} onChange={onChange} />
          <LightRange id="linar-light-position" label="Around panel" value={angle} min={mounted ? -90 : -180} max={mounted ? 90 : 180}
            unit="°" display={angle + ' degrees'} onChange={(value) => onChange({ u: linarLightValueForOrbitDegrees(value, mounted) })} />
          <LightRange id="linar-light-height" label={heightLabel} value={height} min={LINAR_LIGHT_MIN_HEIGHT_PERCENT} max={LINAR_LIGHT_MAX_HEIGHT_PERCENT}
            unit="%" display={height + '% of panel length'} onChange={(value) => onChange({ v: linarLightValueForHeightPercent(value) })} />
          <LightRange id="linar-light-distance" label="Distance from panel" value={Math.round(light.radius * 100)} min={-100} max={100}
            unit="cm" display={formatLinarLightSurfaceClearance(light.radius)} numberValue={distanceCm} numberMin={4} numberMax={420}
            onChange={(value) => onChange({ radius: value / 100 })}
            onNumberChange={(value) => onChange({ radius: linarLightValueForSurfaceClearanceM(value / 100) })} />
          <LightRange id="linar-light-brightness" label="Brightness" value={Math.round(light.intensity)} min={10} max={100}
            unit="%" display={Math.round(light.intensity) + '% visual'} onChange={(value) => onChange({ intensity: value })} />
          <p className="linar-viewport-menu__hint">In the scene, drag Around or {application === 'ceiling' ? 'Along' : 'Height'} beside the light. Scroll always zooms the view. Esc cancels a drag.</p>
          <div className="linar-light-actions">
            <button type="button" className="linar-viewport-menu__reset" onClick={onFind}>Find light</button>
            <button type="button" className="linar-viewport-menu__reset" onClick={onReset}>Reset light</button>
          </div>
          <p className="linar-viewport-menu__hint linar-light-note">Visual study. Distance is approximate for curved panels.</p>
        </>
      ) : <p className="linar-viewport-menu__hint">Choose a position above to switch the light on and start exploring.</p>}
    </>
  )
}
