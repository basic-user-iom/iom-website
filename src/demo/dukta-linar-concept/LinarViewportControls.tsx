import { useEffect, useRef, useState } from 'react'
import {
  LINAR_SIDES,
  LINAR_VIEWS,
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
  shareUrl: string
  onViewPreset: (id: LinarViewId) => void
  onSideChange: (side: LinarSide) => void
  onResetView: () => void
  onToggleMusic: () => void
  onMusicVolumeChange: (value: number) => void
  onToggleTour: () => void
  onReplayCinematic: () => void
  onToggleLight: () => void
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
  shareUrl,
  onViewPreset,
  onSideChange,
  onResetView,
  onToggleMusic,
  onMusicVolumeChange,
  onToggleTour,
  onReplayCinematic,
  onToggleLight,
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
            ? 'Disable interactive light; drag the glowing orb to move it'
            : 'Enable interactive light'
        }
        onClick={() => {
          onUserInteract()
          onToggleLight()
        }}
      >
        LIGHT
      </button>

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
