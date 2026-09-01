import { useEffect, useRef, useState } from 'react'
import {
  LINAR_SIDES,
  LINAR_VIEWS,
  type LinarApplication,
  type LinarBacking,
  type LinarLightPlacement,
  type LinarSide,
  type LinarViewId,
} from './types'

type Props = {
  viewPreset: LinarViewId
  side: LinarSide
  musicEnabled: boolean
  musicVolume: number
  viewAvailable: boolean
  tourActive: boolean
  cinematicActive: boolean
  lightEnabled: boolean
  backlightEnabled: boolean
  lightPlacement: LinarLightPlacement
  lightRadius: number
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
  onLightNear: () => void
  onLightFar: () => void
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
  lightEnabled,
  backlightEnabled,
  lightPlacement,
  lightRadius,
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
  onLightNear,
  onLightFar,
  onResetLight,
  onUserInteract,
  onShare,
}: Props) {
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>('idle')
  const shareResetTimerRef = useRef<number | null>(null)
  const viewMenuRef = useRef<HTMLDetailsElement | null>(null)

  useEffect(
    () => () => {
      if (shareResetTimerRef.current != null) {
        window.clearTimeout(shareResetTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if ((tourActive || cinematicActive) && viewMenuRef.current) {
      viewMenuRef.current.open = false
    }
  }, [cinematicActive, tourActive])

  const copyShareLink = async () => {
    if (shareFeedback === 'copying') return
    if (shareResetTimerRef.current != null) {
      window.clearTimeout(shareResetTimerRef.current)
    }
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

  const shareLabel =
    shareFeedback === 'copying'
      ? 'COPYING'
      : shareFeedback === 'copied'
        ? 'COPIED'
        : shareFeedback === 'failed'
          ? 'RETRY'
          : 'SHARE'
  const shareAriaLabel =
    shareFeedback === 'copying'
      ? 'Copying share link'
      : shareFeedback === 'copied'
        ? 'Share link copied'
        : shareFeedback === 'failed'
          ? 'Copy failed; share URL shown for manual copying'
          : 'Copy share link'
  const opaqueBacking = backing === 'felt'
  const backlightAvailable = application !== 'freestanding' && !opaqueBacking
  const backlightUnavailableReason =
    application === 'freestanding'
      ? 'Rear backlight is available in Wall and Ceiling applications.'
      : opaqueBacking
        ? 'Wool felt is opaque. Remove it or use acoustic fleece to use rear light.'
        : undefined

  return (
    <div
      className="linar-viewport-tools"
      aria-label={viewAvailable ? 'Share, view and sound controls' : 'Share and sound controls'}
    >
      <button
        type="button"
        className={
          shareFeedback === 'copied'
            ? 'linar-viewport-tools__button is-active'
            : 'linar-viewport-tools__button'
        }
        disabled={shareFeedback === 'copying'}
        data-tour-id="share"
        aria-label={shareAriaLabel}
        onClick={() => {
          void copyShareLink()
        }}
      >
        {shareLabel}
      </button>
      <span className="linar-sr-only" role="status" aria-live="polite">
        {shareFeedback === 'copied'
          ? 'Share link copied to clipboard.'
          : shareFeedback === 'failed'
            ? 'Automatic copy failed. The share URL is available for manual copying.'
            : ''}
      </span>

      <button
        type="button"
        className={
          tourActive
            ? 'linar-viewport-tools__button is-active'
            : 'linar-viewport-tools__button'
        }
        disabled={!viewAvailable}
        aria-pressed={tourActive}
        aria-label={
          !viewAvailable
            ? 'Guided product tour unavailable without the 3D preview'
            : tourActive
              ? 'Stop guided product tour'
              : 'Start guided product tour'
        }
        onClick={onToggleTour}
      >
        {tourActive ? 'STOP' : 'TOUR'}
      </button>

      <button
        type="button"
        className={
          cinematicActive
            ? 'linar-viewport-tools__button is-active'
            : 'linar-viewport-tools__button'
        }
        disabled={!viewAvailable}
        aria-pressed={cinematicActive}
        aria-label={cinematicActive ? 'Restart startup cinematic' : 'Replay startup cinematic'}
        onClick={onReplayCinematic}
      >
        INTRO
      </button>

      <button
        type="button"
        data-tour-id="light"
        className={
          lightEnabled
            ? 'linar-viewport-tools__button is-active'
            : 'linar-viewport-tools__button'
        }
        disabled={!viewAvailable}
        aria-pressed={lightEnabled}
        aria-label={
          lightEnabled
            ? 'Turn off the interactive orb light'
            : 'Turn on the interactive orb light'
        }
        onClick={() => {
          onUserInteract()
          onToggleLight()
        }}
      >
        ORB
      </button>

      {application !== 'freestanding' ? (
        <button
          type="button"
          className={[
            'linar-viewport-tools__button',
            backlightEnabled ? 'is-active' : '',
            !backlightAvailable ? 'is-unavailable' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          disabled={!viewAvailable || !backlightAvailable}
          aria-pressed={backlightEnabled}
          aria-label={
            backlightUnavailableReason ??
            (backlightEnabled
              ? 'Turn off the diffuse rear backlight'
              : 'Turn on the diffuse rear backlight')
          }
          title={backlightUnavailableReason}
          onClick={() => {
            onUserInteract()
            onToggleBacklight()
          }}
        >
          BACKLIGHT
        </button>
      ) : null}

      {lightEnabled ? (
        <>
          {application !== 'freestanding' ? (
            <div
              className="linar-viewport-light-tools linar-viewport-light-tools--placement"
              role="group"
              aria-label="Light placement controls"
            >
              <button
                type="button"
                className={
                  lightPlacement === 'room'
                    ? 'linar-viewport-tools__button linar-viewport-light-tools__button is-active'
                    : 'linar-viewport-tools__button linar-viewport-light-tools__button'
                }
                disabled={!viewAvailable}
                aria-pressed={lightPlacement === 'room'}
                aria-label="Place light on room side"
                onClick={() => {
                  onUserInteract()
                  onLightPlacementChange('room')
                }}
              >
                ROOM
              </button>
              <button
                type="button"
                className={
                  lightPlacement === 'behind'
                    ? 'linar-viewport-tools__button linar-viewport-light-tools__button is-active'
                    : 'linar-viewport-tools__button linar-viewport-light-tools__button'
                }
                disabled={!viewAvailable || opaqueBacking}
                aria-pressed={lightPlacement === 'behind'}
                aria-label={
                  !opaqueBacking
                    ? 'Place light behind panel'
                    : 'Behind-panel light unavailable with opaque wool felt'
                }
                title={
                  opaqueBacking
                    ? 'Remove the wool felt or use acoustic fleece to place the light behind the panel.'
                    : backing === 'acoustic-fleece'
                      ? 'Rear transmission through acoustic fleece is a non-certified visual estimate.'
                      : undefined
                }
                onClick={() => {
                  onUserInteract()
                  onLightPlacementChange('behind')
                }}
              >
                BEHIND
              </button>
            </div>
          ) : null}
          <div
            className="linar-viewport-light-tools linar-viewport-light-tools--distance"
            role="group"
            aria-label="Light distance controls"
          >
            <button
              type="button"
              className="linar-viewport-tools__button linar-viewport-light-tools__button"
              disabled={!viewAvailable}
              aria-label="Use the balanced post-intro near light preset"
              onClick={() => {
                onUserInteract()
                onLightNear()
              }}
            >
              NEAR
            </button>
            <button
              type="button"
              className="linar-viewport-tools__button linar-viewport-light-tools__button"
              disabled={!viewAvailable || lightRadius >= 0.995}
              aria-label="Move light farther away"
              onClick={() => {
                onUserInteract()
                onLightFar()
              }}
            >
              FAR
            </button>
            <button
              type="button"
              className="linar-viewport-tools__button linar-viewport-light-tools__button linar-viewport-light-tools__reset"
              disabled={!viewAvailable}
              aria-label="Reset light position and distance"
              onClick={() => {
                onUserInteract()
                onResetLight()
              }}
            >
              RESET LIGHT
            </button>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={
          musicEnabled
            ? 'linar-viewport-tools__button is-active'
            : 'linar-viewport-tools__button'
        }
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
            if (event.currentTarget.open) onUserInteract()
          }}
        >
          <summary className="linar-viewport-tools__button">VIEW</summary>
          <div className="linar-viewport-menu__panel">
          <p className="linar-viewport-menu__hint">Drag to rotate. Scroll or pinch to zoom.</p>

          <fieldset className="linar-viewport-menu__group">
            <legend>Surface side</legend>
            <div className="linar-viewport-menu__choices">
              {LINAR_SIDES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === side ? 'is-active' : ''}
                  aria-pressed={item.id === side}
                  onClick={() => {
                    onUserInteract()
                    onSideChange(item.id)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="linar-viewport-menu__group">
            <legend>Inspection</legend>
            <div className="linar-viewport-menu__choices linar-viewport-menu__choices--views">
              {LINAR_VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === viewPreset ? 'is-active' : ''}
                  aria-pressed={item.id === viewPreset}
                  onClick={() => {
                    onUserInteract()
                    onViewPreset(item.id)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="linar-viewport-menu__reset"
            onClick={() => {
              onUserInteract()
              onResetView()
            }}
          >
            Reset view
          </button>

          <div className="linar-viewport-menu__sound">
            <div className="linar-control__head">
              <label htmlFor="linar-music-volume">Bach · Cello Suite No. 1</label>
              <span>{musicVolume}%</span>
            </div>
            <input
              id="linar-music-volume"
              className="linar-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={musicVolume}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={musicVolume}
              aria-valuetext={`${musicVolume} percent`}
              onInput={(event) => {
                onUserInteract()
                onMusicVolumeChange(Number(event.currentTarget.value))
              }}
            />
          </div>
          </div>
        </details>
      ) : null}

      {shareFeedback === 'failed' ? (
        <div className="linar-share-manual">
          <label htmlFor="linar-share-url">Copy this configuration URL</label>
          <input
            id="linar-share-url"
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
    </div>
  )
}
