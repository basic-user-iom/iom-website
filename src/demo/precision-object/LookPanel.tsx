import { useRef, useState } from 'react'
import { HOTSPOTS } from './productConfig'
import {
  HDR_OPTIONS,
  MATERIAL_GROUPS,
  ACCENT_PITCH_LIMIT,
  SUN_PITCH_LIMIT,
  TEXTURE_SETS,
  classifyTextureFiles,
  customMapCache,
  DEFAULT_HAND_CALIBRATION,
  formatInitialCameraJson,
  formatScrollCameraJson,
  formatHotspotCameraJson,
  formatHandsCalibrationJson,
  formatLookJson,
  persistLook,
  NAMED_VIEW_IDS,
  NAMED_VIEW_LABELS,
  type CameraLook,
  type HandLook,
  type ModelLook,
  type NamedViewId,
  type SavedLook,
  type TextureSetId,
  type TextureTargetLook,
} from './lookStudio'
import { wrapHandDeg } from './cetWatchHands'

type GizmoMode = 'translate' | 'rotate'

type Props = {
  look: SavedLook
  onChange: (look: SavedLook) => void
  captureCamera: () => CameraLook | null
  captureModel: () => ModelLook | null
  placeMode: boolean
  onPlaceMode: (value: boolean) => void
  placeHotspotId: string | null
  onPlaceHotspotId: (id: string | null) => void
  gizmoOn: boolean
  onGizmoOn: (value: boolean) => void
  gizmoMode: GizmoMode
  onGizmoMode: (mode: GizmoMode) => void
  cameraPan: boolean
  onCameraPan: (value: boolean) => void
  handsHeld: boolean
  onHandsHeld: (value: boolean) => void
  onClose: () => void
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="pov-studio__row">
      <span>
        {label}
        <em>{value.toFixed(2)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function parseHandDegInput(raw: string): number | null {
  const parsed = Number.parseFloat(
    raw.replace(/\u2212/g, '-').replace(/[°\s]/g, '').replace(',', '.'),
  )
  return Number.isFinite(parsed) ? wrapHandDeg(parsed) : null
}

function DegSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value.toFixed(1)

  const commitDraft = () => {
    if (draft == null) return
    const next = parseHandDegInput(draft)
    setDraft(null)
    if (next == null || next === value) return
    onChange(next)
  }

  return (
    <div className="pov-studio__row">
      <span>
        {label}
        <span className="pov-studio__deg">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${label} degrees`}
            value={shown}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(null)
              }
            }}
          />
          <span aria-hidden="true">°</span>
        </span>
      </span>
      <input
        type="range"
        min={-180}
        max={180}
        step={0.5}
        value={value}
        aria-label={label}
        onChange={(event) => {
          setDraft(null)
          onChange(Number(event.target.value))
        }}
      />
    </div>
  )
}

function TextureBlock({
  title,
  target,
  value,
  onChange,
}: {
  title: string
  target: 'stand' | 'watch'
  value: TextureTargetLook
  onChange: (next: TextureTargetLook) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <section className="pov-studio__block">
      <header>
        <h3>{title}</h3>
        <button
          type="button"
          className={value.enabled ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={value.enabled}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
        >
          {value.enabled ? 'On' : 'Off'}
        </button>
      </header>
      <label className="pov-studio__row">
        <span>Set</span>
        <select
          value={value.setId}
          onChange={(event) =>
            onChange({ ...value, setId: event.target.value as TextureSetId, enabled: true })
          }
        >
          {TEXTURE_SETS.map((set) => (
            <option key={set.id} value={set.id}>
              {set.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="pov-chip" onClick={() => inputRef.current?.click()}>
        Load maps
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length === 0) return
          const { urls, names } = classifyTextureFiles(files)
          customMapCache[target] = urls
          onChange({ ...value, setId: 'custom', customFiles: names, enabled: true })
          event.target.value = ''
        }}
      />
      {value.customFiles ? (
        <p className="pov-studio__hint">
          Custom: {Object.values(value.customFiles).filter(Boolean).join(', ')}
        </p>
      ) : null}
      <SliderRow
        label="Repeat"
        min={0.4}
        max={8}
        step={0.05}
        value={value.repeat}
        onChange={(repeat) => onChange({ ...value, repeat })}
      />
      <SliderRow
        label="Normal"
        min={0}
        max={3}
        step={0.02}
        value={value.normalScale}
        onChange={(normalScale) => onChange({ ...value, normalScale })}
      />
      {title === 'Stand' ? (
        <SliderRow
          label="Displacement"
          min={0}
          max={0.08}
          step={0.002}
          value={value.displacementScale}
          onChange={(displacementScale) => onChange({ ...value, displacementScale })}
        />
      ) : null}
      <button
        type="button"
        className={value.useAlbedo ? 'pov-chip is-active' : 'pov-chip'}
        aria-pressed={value.useAlbedo}
        onClick={() => onChange({ ...value, useAlbedo: !value.useAlbedo })}
      >
        {value.useAlbedo ? 'Albedo on' : 'Albedo off'}
      </button>
    </section>
  )
}

export function LookPanel({
  look,
  onChange,
  captureCamera,
  captureModel,
  placeMode,
  onPlaceMode,
  placeHotspotId,
  onPlaceHotspotId,
  gizmoOn,
  onGizmoOn,
  gizmoMode,
  onGizmoMode,
  cameraPan,
  onCameraPan,
  handsHeld,
  onHandsHeld,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')

  const setAsFirstView = () => {
    const camera = captureCamera()
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const next = {
      ...look,
      camera,
      views: { ...look.views, hero: camera },
    }
    persistLook(next)
    onChange(next)
    setStatus('First view saved. Copy camera and paste the JSON in chat to bake it into the site default.')
  }

  const copyInitialCamera = async () => {
    const camera = captureCamera() ?? look.camera
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const text = formatInitialCameraJson(camera)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus('Copied initial camera. Paste this JSON in chat to bake it into DEFAULT_LOOK.')
    } catch {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'precision-object-initial-camera.json'
      a.click()
      URL.revokeObjectURL(url)
      setCopied(false)
      setStatus('Clipboard blocked. Downloaded precision-object-initial-camera.json.')
    }
  }

  const setAsScrollDownView = () => {
    const camera = captureCamera()
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const next = { ...look, scrollCamera: camera }
    persistLook(next)
    onChange(next)
    setStatus('Scroll-down view saved. Save look or copy camera to bake it in.')
  }

  const copyScrollCamera = async () => {
    const camera = captureCamera() ?? look.scrollCamera
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const text = formatScrollCameraJson(camera)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus('Copied scroll-down camera. Paste this JSON in chat to bake it into DEFAULT_LOOK.scrollCamera.')
    } catch {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'precision-object-scroll-down-camera.json'
      a.click()
      URL.revokeObjectURL(url)
      setCopied(false)
      setStatus('Clipboard blocked. Downloaded precision-object-scroll-down-camera.json.')
    }
  }

  const assignView = (id: NamedViewId) => {
    const camera = captureCamera()
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    onChange({
      ...look,
      views: { ...look.views, [id]: camera },
    })
    setStatus(`Assigned ${NAMED_VIEW_LABELS[id]}. Save look to keep it.`)
  }

  const selectedHotspot = look.hotspots.find((item) => item.id === placeHotspotId)

  const assignHotspotCamera = () => {
    const id = placeHotspotId
    if (!id) {
      setStatus('Select a hotspot first.')
      return
    }
    const camera = captureCamera()
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const fallback = HOTSPOTS.find((item) => item.id === id)
    onChange({
      ...look,
      hotspots: look.hotspots.some((item) => item.id === id)
        ? look.hotspots.map((item) => (item.id === id ? { ...item, camera } : item))
        : [...look.hotspots, { id, position: fallback?.position ?? [0, 0, 0], camera }],
    })
    const label = fallback ? `${fallback.label} ${fallback.title}` : id
    setStatus(`Assigned camera to ${label}. Save look to keep it.`)
  }

  const copyHotspotCamera = async () => {
    const id = placeHotspotId
    if (!id) {
      setStatus('Select a hotspot first.')
      return
    }
    const camera = captureCamera() ?? selectedHotspot?.camera
    if (!camera) {
      setStatus('Could not capture the camera.')
      return
    }
    const text = formatHotspotCameraJson(id, camera)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus('Copied hotspot camera. Paste this JSON in chat to bake it into DEFAULT_LOOK.hotspots.')
    } catch {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `precision-object-hotspot-${id}-camera.json`
      a.click()
      URL.revokeObjectURL(url)
      setCopied(false)
      setStatus('Clipboard blocked. Downloaded hotspot camera JSON.')
    }
  }

  const toggleHotspotAutoRotate = () => {
    const id = placeHotspotId
    if (!id) {
      setStatus('Select a hotspot first.')
      return
    }
    const on = !selectedHotspot?.autoRotate
    const fallback = HOTSPOTS.find((item) => item.id === id)
    onChange({
      ...look,
      hotspots: look.hotspots.some((item) => item.id === id)
        ? look.hotspots.map((item) => (item.id === id ? { ...item, autoRotate: on } : item))
        : [...look.hotspots, { id, position: fallback?.position ?? [0, 0, 0], autoRotate: on }],
    })
  }

  const hands: HandLook = look.hands ?? DEFAULT_HAND_CALIBRATION

  const commitHands = (next: HandLook, persist = true) => {
    const payload = { ...look, hands: next }
    if (persist) persistLook(payload)
    onChange(payload)
  }

  const copyHands = async () => {
    const next = look.hands ?? DEFAULT_HAND_CALIBRATION
    persistLook({ ...look, hands: next })
    const text = formatHandsCalibrationJson(next)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus('Copied hands. Paste this JSON in chat to bake it into DEFAULT_LOOK.hands.')
    } catch {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'precision-object-hand-calibration.json'
      a.click()
      URL.revokeObjectURL(url)
      setCopied(false)
      setStatus('Clipboard blocked. Downloaded precision-object-hand-calibration.json.')
    }
  }

  const save = async () => {
    const camera = captureCamera() ?? look.camera
    const model = captureModel() ?? look.model
    const payload = { ...look, camera, model, savedAt: new Date().toISOString() }
    persistLook(payload)
    onChange(payload)
    const text = formatLookJson(payload)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatus('Saved and copied. Paste this JSON in chat for the final look.')
    } catch {
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'precision-object-look.json'
      a.click()
      URL.revokeObjectURL(url)
      setCopied(false)
      setStatus('Saved locally and downloaded precision-object-look.json.')
    }
  }

  return (
    <aside className="pov-studio" aria-label="Look studio">
      <div className="pov-studio__bar">
        <p>Look studio</p>
        <button type="button" className="pov-detail__close" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="pov-studio__lead">
        Try textures, sun, shadows, materials, watch pose and hotspot cameras. Save stores the
        current camera, watch transform and any assigned views.
      </p>

      <section className="pov-studio__block">
        <header>
          <h3>Watch pose</h3>
          <button
            type="button"
            className={gizmoOn ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={gizmoOn}
            onClick={() => onGizmoOn(!gizmoOn)}
          >
            Gizmo
          </button>
        </header>
        <p className="pov-studio__hint">
          Drag the gizmo on the watch to move or rotate it. Orbit pauses while you drag. Save look
          stores the transform.
        </p>
        <div className="pov-studio__hots">
          <button
            type="button"
            className={gizmoMode === 'translate' ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={gizmoMode === 'translate'}
            onClick={() => onGizmoMode('translate')}
          >
            Translate
          </button>
          <button
            type="button"
            className={gizmoMode === 'rotate' ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={gizmoMode === 'rotate'}
            onClick={() => onGizmoMode('rotate')}
          >
            Rotate
          </button>
        </div>
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Hands / Clock</h3>
          <div className="pov-studio__hots">
            <button
              type="button"
              className={handsHeld ? 'pov-chip is-active' : 'pov-chip'}
              aria-pressed={handsHeld}
              onClick={() => onHandsHeld(!handsHeld)}
            >
              Hold hands
            </button>
            <button type="button" className="pov-chip" onClick={() => void copyHands()}>
              Copy hands
            </button>
          </div>
        </header>
        <p className="pov-studio__hint">
          Hold hands freezes live ticking and zone-sweep so you can line up against a real clock.
          Type a degree and Enter, or use the slider / ±5°. Set Zone to Berlin, then Copy.
        </p>
        <DegSlider
          label="12 o'clock"
          value={hands.twelveXDeg}
          onChange={(twelveXDeg) => commitHands({ ...hands, twelveXDeg })}
        />
        <div className="pov-studio__hots">
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, twelveXDeg: DEFAULT_HAND_CALIBRATION.twelveXDeg })}
          >
            Snap 12
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, twelveXDeg: wrapHandDeg(hands.twelveXDeg - 5) })}
          >
            −5°
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, twelveXDeg: wrapHandDeg(hands.twelveXDeg + 5) })}
          >
            +5°
          </button>
        </div>
        <DegSlider
          label="Hour offset"
          value={hands.hourOffsetDeg}
          onChange={(hourOffsetDeg) => commitHands({ ...hands, hourOffsetDeg })}
        />
        <div className="pov-studio__hots">
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, hourOffsetDeg: wrapHandDeg(hands.hourOffsetDeg - 5) })}
          >
            −5°
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, hourOffsetDeg: wrapHandDeg(hands.hourOffsetDeg + 5) })}
          >
            +5°
          </button>
        </div>
        <DegSlider
          label="Minute offset"
          value={hands.minuteOffsetDeg}
          onChange={(minuteOffsetDeg) => commitHands({ ...hands, minuteOffsetDeg })}
        />
        <div className="pov-studio__hots">
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, minuteOffsetDeg: wrapHandDeg(hands.minuteOffsetDeg - 5) })}
          >
            −5°
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, minuteOffsetDeg: wrapHandDeg(hands.minuteOffsetDeg + 5) })}
          >
            +5°
          </button>
        </div>
        <DegSlider
          label="Seconds offset"
          value={hands.secondOffsetDeg}
          onChange={(secondOffsetDeg) => commitHands({ ...hands, secondOffsetDeg })}
        />
        <div className="pov-studio__hots">
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, secondOffsetDeg: wrapHandDeg(hands.secondOffsetDeg - 5) })}
          >
            −5°
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() => commitHands({ ...hands, secondOffsetDeg: wrapHandDeg(hands.secondOffsetDeg + 5) })}
          >
            +5°
          </button>
          <button
            type="button"
            className="pov-chip"
            onClick={() =>
              commitHands({
                ...hands,
                hourOffsetDeg: 0,
                minuteOffsetDeg: 0,
                secondOffsetDeg: 0,
              })
            }
          >
            Reset offsets
          </button>
        </div>
      </section>

      <TextureBlock
        title="Stand"
        target="stand"
        value={look.stand}
        onChange={(stand) => onChange({ ...look, stand })}
      />
      <TextureBlock
        title="Watch metal"
        target="watch"
        value={look.watch}
        onChange={(watch) => onChange({ ...look, watch })}
      />

      <section className="pov-studio__block">
        <h3>HDR</h3>
        <div className="pov-studio__hots">
          {HDR_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={look.hdrId === option.id ? 'pov-chip is-active' : 'pov-chip'}
              aria-pressed={look.hdrId === option.id}
              onClick={() => onChange({ ...look, hdrId: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="pov-studio__block">
        <h3>Sun</h3>
        <p className="pov-studio__hint">
          Rotates the HDR and the shadow-casting sun together. Pitch tilts elevation only — it
          cannot stand the horizon on its side.
        </p>
        <SliderRow
          label="Yaw"
          min={0}
          max={Math.PI * 2}
          step={0.01}
          value={look.sun.yaw}
          onChange={(yaw) => onChange({ ...look, sun: { ...look.sun, yaw } })}
        />
        <SliderRow
          label="Pitch"
          min={-SUN_PITCH_LIMIT}
          max={SUN_PITCH_LIMIT}
          step={0.01}
          value={look.sun.pitch}
          onChange={(pitch) => onChange({ ...look, sun: { ...look.sun, pitch } })}
        />
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Fill lights</h3>
          <button
            type="button"
            className={look.lights.enabled ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={look.lights.enabled}
            onClick={() =>
              onChange({ ...look, lights: { ...look.lights, enabled: !look.lights.enabled } })
            }
          >
            {look.lights.enabled ? 'On' : 'Off'}
          </button>
        </header>
        <p className="pov-studio__hint">Brighten the object without casting extra shadows.</p>
        <SliderRow
          label="Fill"
          min={0}
          max={1.5}
          step={0.02}
          value={look.lights.fill}
          onChange={(fill) => onChange({ ...look, lights: { ...look.lights, fill } })}
        />
        <SliderRow
          label="Rim"
          min={0}
          max={1.5}
          step={0.02}
          value={look.lights.rim}
          onChange={(rim) => onChange({ ...look, lights: { ...look.lights, rim } })}
        />
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Accent</h3>
          <button
            type="button"
            className={look.lights.accent.enabled ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={look.lights.accent.enabled}
            onClick={() =>
              onChange({
                ...look,
                lights: {
                  ...look.lights,
                  accent: { ...look.lights.accent, enabled: !look.lights.accent.enabled },
                },
              })
            }
          >
            {look.lights.accent.enabled ? 'On' : 'Off'}
          </button>
        </header>
        <p className="pov-studio__hint">
          Extra directional on the object only — no extra shadows. Yaw orbits around the watch; pitch
          tilts up or down. Raise yaw toward 2.0 to light the crown side.
        </p>
        <SliderRow
          label="Intensity"
          min={0}
          max={1.8}
          step={0.02}
          value={look.lights.accent.intensity}
          onChange={(intensity) =>
            onChange({
              ...look,
              lights: { ...look.lights, accent: { ...look.lights.accent, intensity } },
            })
          }
        />
        <SliderRow
          label="Yaw"
          min={0}
          max={Math.PI * 2}
          step={0.01}
          value={look.lights.accent.yaw}
          onChange={(yaw) =>
            onChange({
              ...look,
              lights: { ...look.lights, accent: { ...look.lights.accent, yaw } },
            })
          }
        />
        <SliderRow
          label="Pitch"
          min={-ACCENT_PITCH_LIMIT}
          max={ACCENT_PITCH_LIMIT}
          step={0.01}
          value={look.lights.accent.pitch}
          onChange={(pitch) =>
            onChange({
              ...look,
              lights: { ...look.lights, accent: { ...look.lights.accent, pitch } },
            })
          }
        />
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Shadows</h3>
          <button
            type="button"
            className={look.shadows.enabled ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={look.shadows.enabled}
            onClick={() =>
              onChange({ ...look, shadows: { ...look.shadows, enabled: !look.shadows.enabled } })
            }
          >
            {look.shadows.enabled ? 'On' : 'Off'}
          </button>
        </header>
        <button
          type="button"
          className={look.shadows.contact ? 'pov-chip is-active' : 'pov-chip'}
          aria-pressed={look.shadows.contact}
          onClick={() =>
            onChange({ ...look, shadows: { ...look.shadows, contact: !look.shadows.contact } })
          }
        >
          Contact blob
        </button>
        <SliderRow
          label="Intensity"
          min={0}
          max={1}
          step={0.02}
          value={look.shadows.intensity}
          onChange={(intensity) => onChange({ ...look, shadows: { ...look.shadows, intensity } })}
        />
        <SliderRow
          label="Softness"
          min={0}
          max={1}
          step={0.02}
          value={look.shadows.softness}
          onChange={(softness) => onChange({ ...look, shadows: { ...look.shadows, softness } })}
        />
        <p className="pov-studio__hint">Softness is the HDR sun penumbra on the stand. 0 is hard; 1 is a wide edge.</p>
      </section>

      <section className="pov-studio__block">
        <h3>Materials</h3>
        <p className="pov-studio__hint">
          Roughness and metalness are the finish on each group. Watch PBR maps keep normals only, so
          these sliders stay visible — including Dark metal.
        </p>
        {look.materials.length === 0 ? (
          <p className="pov-studio__hint">Materials appear after the object loads.</p>
        ) : (
          look.materials.map((mat) => {
            const glass = MATERIAL_GROUPS.find((g) => g.id === mat.id)?.glass
            return (
              <div key={mat.id} className="pov-studio__mat">
                <p>{mat.label}</p>
                <label className="pov-studio__row">
                  <span>Color</span>
                  <input
                    type="color"
                    value={mat.color}
                    onChange={(event) =>
                      onChange({
                        ...look,
                        materials: look.materials.map((item) =>
                          item.id === mat.id ? { ...item, color: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </label>
                <SliderRow
                  label="Metalness"
                  min={0}
                  max={1}
                  step={0.01}
                  value={mat.metalness}
                  onChange={(metalness) =>
                    onChange({
                      ...look,
                      materials: look.materials.map((item) =>
                        item.id === mat.id ? { ...item, metalness } : item,
                      ),
                    })
                  }
                />
                <SliderRow
                  label="Roughness"
                  min={0}
                  max={1}
                  step={0.01}
                  value={mat.roughness}
                  onChange={(roughness) =>
                    onChange({
                      ...look,
                      materials: look.materials.map((item) =>
                        item.id === mat.id ? { ...item, roughness } : item,
                      ),
                    })
                  }
                />
                <SliderRow
                  label="Env"
                  min={0}
                  max={3}
                  step={0.02}
                  value={mat.envMapIntensity}
                  onChange={(envMapIntensity) =>
                    onChange({
                      ...look,
                      materials: look.materials.map((item) =>
                        item.id === mat.id ? { ...item, envMapIntensity } : item,
                      ),
                    })
                  }
                />
                {glass ? (
                  <>
                    <SliderRow
                      label="Transmission"
                      min={0}
                      max={1}
                      step={0.01}
                      value={mat.transmission ?? 0.96}
                      onChange={(transmission) =>
                        onChange({
                          ...look,
                          materials: look.materials.map((item) =>
                            item.id === mat.id ? { ...item, transmission } : item,
                          ),
                        })
                      }
                    />
                    <SliderRow
                      label="IOR"
                      min={1}
                      max={2.2}
                      step={0.01}
                      value={mat.ior ?? 1.5}
                      onChange={(ior) =>
                        onChange({
                          ...look,
                          materials: look.materials.map((item) =>
                            item.id === mat.id ? { ...item, ior } : item,
                          ),
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
            )
          })
        )}
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Hotspots</h3>
          <button
            type="button"
            className={placeMode ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={placeMode}
            onClick={() => onPlaceMode(!placeMode)}
          >
            Place
          </button>
        </header>
        {placeMode ? (
          <p className="pov-studio__hint">Select a hotspot, then click the watch mesh — not the floor.</p>
        ) : (
          <p className="pov-studio__hint">
            Select a hotspot, orbit to a frame, then Assign camera. Opening that hotspot later flies
            to this camera.
          </p>
        )}
        <div className="pov-studio__hots">
          {HOTSPOTS.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className={placeHotspotId === hotspot.id ? 'pov-chip is-active' : 'pov-chip'}
              onClick={() => onPlaceHotspotId(hotspot.id)}
            >
              {hotspot.label} {hotspot.title}
              {look.hotspots.find((item) => item.id === hotspot.id)?.camera ? ' · cam' : ''}
            </button>
          ))}
        </div>
        <div className="pov-studio__hots">
          <button type="button" className="pov-chip" onClick={assignHotspotCamera}>
            Assign camera
          </button>
          <button type="button" className="pov-chip" onClick={() => void copyHotspotCamera()}>
            Copy camera
          </button>
          <button
            type="button"
            className={selectedHotspot?.autoRotate ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={Boolean(selectedHotspot?.autoRotate)}
            onClick={toggleHotspotAutoRotate}
          >
            Rotate on inspect
          </button>
        </div>
      </section>

      <section className="pov-studio__block">
        <header>
          <h3>Camera</h3>
          <button
            type="button"
            className={cameraPan ? 'pov-chip is-active' : 'pov-chip'}
            aria-pressed={cameraPan}
            onClick={() => onCameraPan(!cameraPan)}
          >
            Fly / Pan camera
          </button>
        </header>
        <p className="pov-studio__hint">Ctrl + drag or Ctrl + WASD to move view</p>
      </section>

      <section className="pov-studio__block">
        <h3>Initial camera</h3>
        <p className="pov-studio__hint">
          First view after landing and after Explore. Orbit to the shot, then set or copy. Scroll-down
          is the frame when the visitor reaches the second 3D screen.
        </p>
        <div className="pov-studio__hots pov-studio__hots--pair">
          <button
            type="button"
            className={look.camera ? 'pov-chip is-active' : 'pov-chip'}
            onClick={setAsFirstView}
          >
            Set as first view
          </button>
          <button type="button" className="pov-chip" onClick={() => void copyInitialCamera()}>
            Copy camera
          </button>
        </div>
        <div className="pov-studio__hots pov-studio__hots--pair">
          <button
            type="button"
            className={look.scrollCamera ? 'pov-chip is-active' : 'pov-chip'}
            onClick={setAsScrollDownView}
          >
            Set as scroll-down view
          </button>
          <button type="button" className="pov-chip" onClick={() => void copyScrollCamera()}>
            Copy scroll-down camera
          </button>
        </div>
      </section>

      <section className="pov-studio__block">
        <h3>Views</h3>
        <p className="pov-studio__hint">
          Orbit to a frame, then assign it. Toolbar chips jump to these. Reset restores Hero; if
          Hero is not assigned, it restores Front.
        </p>
        <div className="pov-studio__hots">
          {NAMED_VIEW_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={look.views?.[id] ? 'pov-chip is-active' : 'pov-chip'}
              onClick={() => assignView(id)}
            >
              Assign to {NAMED_VIEW_LABELS[id]}
            </button>
          ))}
        </div>
      </section>

      <label className="pov-studio__notes">
        Notes
        <textarea
          rows={2}
          value={look.notes}
          onChange={(event) => onChange({ ...look, notes: event.target.value })}
          placeholder="What you want in the final look"
        />
      </label>

      <button type="button" className="pov-btn pov-btn--primary pov-studio__save" onClick={() => void save()}>
        Save look
      </button>
      <p className="pov-studio__hint">
        Includes the startup camera, scroll-down camera, assigned views, watch pose, hotspot cameras,
        rotate-on-inspect and hand calibration.
      </p>
      {status ? <p className="pov-studio__status">{copied ? status : status}</p> : null}
    </aside>
  )
}
