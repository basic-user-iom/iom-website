import { useEffect, useRef, useState } from 'react'
import {
  LINAR_SIDES,
  LINAR_VIEWS,
  type LinarApplication,
  type LinarBacking,
  type LinarLightPlacement,
  type LinarLightState,
  type LinarSide,
  type LinarViewId,
} from './types'
import {
  formatLinarLightSurfaceClearance,
  LINAR_LIGHT_MAX_HEIGHT_PERCENT,
  LINAR_LIGHT_MIN_HEIGHT_PERCENT,
  linarLightHeightPercent,
  linarLightOrbitDegrees,
  linarLightValueForHeightPercent,
  linarLightValueForOrbitDegrees,
} from './lightRig'

type Props = {
  viewPreset: LinarViewId
  side: LinarSide
  musicEnabled: boolean
  musicVolume: number
  viewAvailable: boolean
  tourActive: boolean
  cinematicActive: boolean
  lightState: LinarLightState
  backlightEnabled: boolean
  application: LinarApplication
  backing: LinarBacking
  shareUrl: string
  onViewPreset: (id: LinarViewId) => void
  onSideChange: (side: LinarSide) => void
  onResetView: () => void
  onToggleMusic: () => void
  onMusicVolumeChange: (value: number) => void
  onToggleTour: () => void
  onReplayCinematic: () => void
  onToggleLight: () => void
  onToggleBacklight: () => void
  onLightPlacementChange: (placement: LinarLightPlacement) => void
  onLightChange: (patch: Partial<LinarLightState>) => void
  onResetLight: () => void
  onUserInteract: () => void
  onShare: () => Promise<boolean>
}

type ShareFeedback = 'idle' | 'copying' | 'copied' | 'failed'

function LightRange({
  id,
  label,
  value,
  min,
  max,
  display,
  onInput,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  display: string
  onInput: (value: number) => void
}) {
  return (
    <div className="linar-viewport-light-range">
      <div className="linar-control__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        className="linar-slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={display}
        onInput={(event) => onInput(Number(event.currentTarget.value))}
      />
    </div>
  )
}

export function LinarViewportControls({
  viewPreset,
  side,
  musicEnabled,
  musicVolume,
  viewAvailable,
  tourActive,
  cinematicActive,
  lightState,
  backlightEnabled,
  application,
  backing,
  shareUrl,
  onViewPreset,
  onSideChange,
  onResetView,
  onToggleMusic,
  onMusicVolumeChange,
  onToggleTour,
  onReplayCinematic,
  onToggleLight,
  onToggleBacklight,
  onLightPlacementChange,
  onLightChange,
  onResetLight,
  onUserInteract,
  onShare,
}: Props) {
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>('idle')
  const shareResetTimerRef = useRef<number | null>(null)
  const viewMenuRef = useRef<HTMLDetailsElement | null>(null)
  const lightingMenuRef = useRef<HTMLDetailsElement | null>(null)

  useEffect(
    () => () => {
      if (shareResetTimerRef.current != null) window.clearTimeout(shareResetTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!cinematicActive) return
    if (viewMenuRef.current) viewMenuRef.current.open = false
    if (lightingMenuRef.current) lightingMenuRef.current.open = false
  }, [cinematicActive])

  const copyShareLink = async () => {
    if (shareFeedback === 'copying') return
    if (shareResetTimerRef.current != null) window.clearTimeout(shareResetTimerRef.current)
    setShareFeedback('copying')
    const copied = await onShare()
    setShareFeedback(copied ? 'copied' : 'failed')
    if (copied) {
      shareResetTimerRef.current = window.setTimeout(() => {
        setShareFeedback('idle')
        shareResetTimerRef.current = null
      }, 2400)
    }
  }

  const shareLabel = shareFeedback === 'copying' ? 'COPYING' : shareFeedback === 'copied' ? 'COPIED' : shareFeedback === 'failed' ? 'RETRY' : 'SHARE'
  const opaqueBacking = backing === 'felt'
  const backlightAvailable = application !== 'freestanding' && !opaqueBacking
  const backlightUnavailableReason =
    application === 'freestanding'
      ? 'Rear light is available in Wall and Ceiling applications.'
      : opaqueBacking
        ? 'Wool felt is opaque. Remove it or use acoustic fleece to use rear light.'
        : undefined
  const mountedLight = application !== 'freestanding'
  const positionLimit = mountedLight ? 90 : 180
  const positionValue = Math.round(linarLightOrbitDegrees(lightState.u, mountedLight))
  const heightValue = Math.round(linarLightHeightPercent(lightState.v))
  const distanceValue = Math.round(lightState.radius * 100)

  const changeLight = (patch: Partial<LinarLightState>) => {
    onUserInteract()
    onLightChange(patch)
  }

  return (
    <div className="linar-viewport-tools" aria-label="Share, lighting, view and sound controls">
      <button
        type="button"
        className={shareFeedback === 'copied' ? 'linar-viewport-tools__button is-active' : 'linar-viewport-tools__button'}
        disabled={shareFeedback === 'copying'}
        data-tour-id="share"
        aria-label={shareFeedback === 'copied' ? 'Share link copied' : 'Copy share link'}
        onClick={() => void copyShareLink()}
      >
        {shareLabel}
      </button>
      <span className="linar-sr-only" role="status" aria-live="polite">
        {shareFeedback === 'copied' ? 'Share link copied to clipboard.' : shareFeedback === 'failed' ? 'Automatic copy failed. The URL is shown for manual copying.' : ''}
      </span>

      <button
        type="button"
        className={tourActive ? 'linar-viewport-tools__button is-active' : 'linar-viewport-tools__button'}
        disabled={!viewAvailable}
        aria-pressed={tourActive}
        onClick={onToggleTour}
      >
        {tourActive ? 'EXIT TOUR' : 'TOUR'}
      </button>

      <button
        type="button"
        className={cinematicActive ? 'linar-viewport-tools__button is-active' : 'linar-viewport-tools__button'}
        disabled={!viewAvailable}
        aria-pressed={cinematicActive}
        onClick={onReplayCinematic}
      >
        INTRO
      </button>

      {application !== 'freestanding' ? (
        <button
          type="button"
          className={['linar-viewport-tools__button', backlightEnabled ? 'is-active' : '', !backlightAvailable ? 'is-unavailable' : ''].filter(Boolean).join(' ')}
          disabled={!viewAvailable || !backlightAvailable}
          aria-pressed={backlightEnabled}
          aria-label={backlightUnavailableReason ?? (backlightEnabled ? 'Turn off rear light' : 'Turn on rear light')}
          title={backlightUnavailableReason}
          onClick={() => {
            onUserInteract()
            onToggleBacklight()
          }}
        >
          REAR LIGHT
        </button>
      ) : null}

      {viewAvailable ? (
        <details
          ref={lightingMenuRef}
          className="linar-viewport-menu linar-viewport-menu--lighting"
          data-tour-id="advanced-lighting"
          onToggle={(event) => {
            if (!event.currentTarget.open) return
            viewMenuRef.current && (viewMenuRef.current.open = false)
          }}
        >
          <summary className={lightState.enabled ? 'linar-viewport-tools__button is-active' : 'linar-viewport-tools__button'}>LIGHTING</summary>
          <div className="linar-viewport-menu__panel linar-viewport-light-panel">
            <div className="linar-viewport-light-panel__head">
              <div>
                <strong>Movable orb</strong>
                <span>Visual lighting study</span>
              </div>
              <button
                type="button"
                className={lightState.enabled ? 'is-active' : ''}
                aria-pressed={lightState.enabled}
                onClick={() => {
                  onUserInteract()
                  onToggleLight()
                }}
              >
                {lightState.enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {lightState.enabled ? (
              <>
                {application !== 'freestanding' ? (
                  <fieldset className="linar-viewport-menu__group">
                    <legend>Side</legend>
                    <div className="linar-viewport-menu__choices">
                      {(['room', 'behind'] as const).map((placement) => (
                        <button
                          key={placement}
                          type="button"
                          className={lightState.placement === placement ? 'is-active' : ''}
                          disabled={placement === 'behind' && opaqueBacking}
                          aria-pressed={lightState.placement === placement}
                          aria-describedby={placement === 'behind' && opaqueBacking ? 'linar-orb-behind-unavailable' : undefined}
                          onClick={() => {
                            onUserInteract()
                            onLightPlacementChange(placement)
                          }}
                        >
                          {placement === 'room' ? 'Room side' : 'Behind panel'}
                        </button>
                      ))}
                    </div>
                    {opaqueBacking ? (
                      <p id="linar-orb-behind-unavailable" className="linar-viewport-menu__hint">
                        Behind-panel placement is unavailable because wool felt is opaque.
                      </p>
                    ) : null}
                  </fieldset>
                ) : null}
                <LightRange id="linar-light-position" label="Position" value={positionValue} min={-positionLimit} max={positionLimit} display={`${positionValue}°`} onInput={(value) => changeLight({ u: linarLightValueForOrbitDegrees(value, mountedLight) })} />
                <LightRange id="linar-light-height" label="Height" value={heightValue} min={LINAR_LIGHT_MIN_HEIGHT_PERCENT} max={LINAR_LIGHT_MAX_HEIGHT_PERCENT} display={`${heightValue}%`} onInput={(value) => changeLight({ v: linarLightValueForHeightPercent(value) })} />
                <LightRange id="linar-light-distance" label="Distance from surface" value={distanceValue} min={-100} max={100} display={formatLinarLightSurfaceClearance(lightState.radius)} onInput={(value) => changeLight({ radius: value / 100 })} />
                <LightRange id="linar-light-brightness" label="Brightness" value={Math.round(lightState.intensity)} min={10} max={100} display={`${Math.round(lightState.intensity)}% visual`} onInput={(value) => changeLight({ intensity: value })} />
                <p className="linar-viewport-menu__hint">Position moves around the panel without changing height. Height follows the panel-local vertical axis. Scroll over the orb for distance from the surface; Shift-drag also changes it.</p>
                <button type="button" className="linar-viewport-menu__reset" onClick={() => {
                  onUserInteract()
                  onResetLight()
                }}>Reset light</button>
              </>
            ) : (
              <p className="linar-viewport-menu__hint">Enable the orb to reveal its direct manipulation handle and controls.</p>
            )}
          </div>
        </details>
      ) : null}

      <button
        type="button"
        className={musicEnabled ? 'linar-viewport-tools__button is-active' : 'linar-viewport-tools__button'}
        aria-pressed={musicEnabled}
        aria-label={musicEnabled ? 'Mute music' : 'Unmute music'}
        onClick={() => {
          onUserInteract()
          onToggleMusic()
        }}
      >
        {musicEnabled ? 'MUTE' : 'UNMUTE'}
      </button>

      {viewAvailable ? (
        <details
          ref={viewMenuRef}
          className="linar-viewport-menu"
          onToggle={(event) => {
            if (!event.currentTarget.open) return
            lightingMenuRef.current && (lightingMenuRef.current.open = false)
          }}
        >
          <summary className="linar-viewport-tools__button">VIEW</summary>
          <div className="linar-viewport-menu__panel">
            <p className="linar-viewport-menu__hint">Drag to rotate. Scroll or pinch to zoom.</p>
            <fieldset className="linar-viewport-menu__group">
              <legend>Surface side</legend>
              <div className="linar-viewport-menu__choices">
                {LINAR_SIDES.map((item) => (
                  <button key={item.id} type="button" className={item.id === side ? 'is-active' : ''} aria-pressed={item.id === side} onClick={() => {
                    onUserInteract()
                    onSideChange(item.id)
                  }}>{item.label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="linar-viewport-menu__group">
              <legend>Inspection</legend>
              <div className="linar-viewport-menu__choices linar-viewport-menu__choices--views">
                {LINAR_VIEWS.map((item) => (
                  <button key={item.id} type="button" className={item.id === viewPreset ? 'is-active' : ''} aria-pressed={item.id === viewPreset} onClick={() => {
                    onUserInteract()
                    onViewPreset(item.id)
                  }}>{item.label}</button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="linar-viewport-menu__reset" onClick={() => {
              onUserInteract()
              onResetView()
            }}>Reset view</button>
            <div className="linar-viewport-menu__sound">
              <div className="linar-control__head"><label htmlFor="linar-music-volume">Bach · Cello Suite No. 1</label><span>{musicVolume}%</span></div>
              <input id="linar-music-volume" className="linar-slider" type="range" min={0} max={100} step={1} value={musicVolume} aria-valuetext={`${musicVolume} percent`} onInput={(event) => {
                onUserInteract()
                onMusicVolumeChange(Number(event.currentTarget.value))
              }} />
            </div>
          </div>
        </details>
      ) : null}

      {shareFeedback === 'failed' ? (
        <div className="linar-share-manual">
          <label htmlFor="linar-share-url">Copy this configuration URL</label>
          <input id="linar-share-url" type="text" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />
        </div>
      ) : null}
    </div>
  )
}
