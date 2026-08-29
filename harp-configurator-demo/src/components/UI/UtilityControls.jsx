import { useState } from 'react'
import { DEBUG } from '../../config/debug.js'
import { CAMERA_VIEWS } from '../../config/productConfig.js'
import { getShareUrl } from '../../utils/shareConfig.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { Icons } from './Icons.jsx'

export function UtilityControls({ onInfo }) {
  const reset = useConfigurator((state) => state.reset)
  const values = useConfigurator((state) => state.values)
  const requestView = useViewer((state) => state.requestView)
  const closeHotspot = useViewer((state) => state.closeHotspot)
  const cameraEdit = useViewer((state) => state.cameraEdit)
  const setCameraEdit = useViewer((state) => state.setCameraEdit)
  const [copied, setCopied] = useState(false)

  const onReset = () => {
    reset()
    closeHotspot()
    requestView('hero')
  }

  const onShare = async () => {
    const url = getShareUrl(values)
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Marini Made Harps — configuration study',
          url,
        })
        return
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch (error) {
      console.warn('[harp-configurator] clipboard unavailable', error)
    }
  }

  const onFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      await document.documentElement.requestFullscreen()
    } catch (error) {
      console.warn('[harp-configurator] fullscreen unavailable', error)
    }
  }

  return (
    <div className="utility-controls">
      <button type="button" className="icon-btn" onClick={onReset} aria-label="Reset configuration and view">
        <Icons.Reset />
        <span>Reset</span>
      </button>
      <button type="button" className="icon-btn" onClick={onShare} aria-label="Share this configuration">
        <Icons.Share />
        <span>{copied ? 'Copied' : 'Share'}</span>
      </button>
      <button type="button" className="icon-btn" onClick={onFullscreen} aria-label="Toggle fullscreen">
        <Icons.Fullscreen />
        <span>Full</span>
      </button>
      {DEBUG && (
        <button
          type="button"
          className={`icon-btn ${cameraEdit ? 'is-active' : ''}`}
          onClick={() => setCameraEdit(!cameraEdit)}
          aria-pressed={cameraEdit}
          aria-label="Correct camera views"
        >
          <Icons.Camera />
          <span>Cam</span>
        </button>
      )}
      <button type="button" className="icon-btn" onClick={onInfo} aria-label="About this demonstration">
        <Icons.Info />
        <span>Info</span>
      </button>
    </div>
  )
}

export function ViewControls() {
  const view = useViewer((state) => state.view)
  const requestView = useViewer((state) => state.requestView)

  return (
    <div className="view-controls" role="toolbar" aria-label="Camera views">
      {CAMERA_VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={view === item.id ? 'is-active' : ''}
          aria-pressed={view === item.id}
          onClick={() => requestView(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
