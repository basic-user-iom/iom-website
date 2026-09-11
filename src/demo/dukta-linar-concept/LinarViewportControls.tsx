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
import { LinarLightControls } from './LinarLightControls'

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
  onFindLight: () => void
  onResetLight: () => void
  onUserInteract: () => void
  onShare: () => Promise<boolean>
}

type ShareFeedback = 'idle' | 'copying' | 'copied' | 'failed'

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
  onFindLight,
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
            <LinarLightControls
              light={lightState}
              application={application}
              backing={backing}
              onChange={changeLight}
              onToggle={() => { onUserInteract(); onToggleLight() }}
              onPlacement={(placement) => { onUserInteract(); onLightPlacementChange(placement) }}
              onReset={() => { onUserInteract(); onResetLight() }}
              onFind={() => {
                onUserInteract()
                if (lightingMenuRef.current) lightingMenuRef.current.open = false
                onFindLight()
              }}
            />
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
