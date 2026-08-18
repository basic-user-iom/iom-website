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
  formatLookJson,
  persistLook,
  NAMED_VIEW_IDS,
  NAMED_VIEW_LABELS,
  type CameraLook,
  type NamedViewId,
  type SavedLook,
  type TextureSetId,
  type TextureTargetLook,
} from './lookStudio'

type Props = {
  look: SavedLook
  onChange: (look: SavedLook) => void
  captureCamera: () => CameraLook | null
  placeMode: boolean
  onPlaceMode: (value: boolean) => void
  placeHotspotId: string | null
  onPlaceHotspotId: (id: string | null) => void
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
  placeMode,
  onPlaceMode,
  placeHotspotId,
  onPlaceHotspotId,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')

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

  const save = async () => {
    const camera = captureCamera() ?? look.camera
    const payload = { ...look, camera, savedAt: new Date().toISOString() }
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
        Try textures, sun, shadows, materials and hotspot placement. Save stores the current camera
        view too — paste the JSON back when you want it baked in.
      </p>

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
          <p className="pov-studio__hint">Select a hotspot, then click the object surface.</p>
        ) : null}
        <div className="pov-studio__hots">
          {HOTSPOTS.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className={placeHotspotId === hotspot.id ? 'pov-chip is-active' : 'pov-chip'}
              onClick={() => onPlaceHotspotId(hotspot.id)}
            >
              {hotspot.label} {hotspot.title}
            </button>
          ))}
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
      <p className="pov-studio__hint">Includes the startup camera and any assigned views.</p>
      {status ? <p className="pov-studio__status">{copied ? status : status}</p> : null}
    </aside>
  )
}
