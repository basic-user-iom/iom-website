import { useEffect, useMemo, useState } from 'react'
import { CAMERA_VIEWS } from '../../config/productConfig.js'
import { FRAMEABLE_VIEWS, formatCameraOverrides, resolveViewPose, roundPose } from '../../utils/camera.js'
import { getLiveCameraPose } from '../../utils/liveCameraPose.js'
import { useViewer } from '../../hooks/useViewer.js'
import { Icons } from './Icons.jsx'

function poseLine(pose) {
  if (!pose) return '—'
  const p = roundPose(pose)
  return `pos ${p.position.join(', ')}  ·  look ${p.target.join(', ')}`
}

export function CameraFramingPanel() {
  const open = useViewer((state) => state.cameraEdit)
  const setCameraEdit = useViewer((state) => state.setCameraEdit)
  const view = useViewer((state) => state.view)
  const requestView = useViewer((state) => state.requestView)
  const rig = useViewer((state) => state.rig)
  const overrides = useViewer((state) => state.cameraOverrides)
  const setCameraOverride = useViewer((state) => state.setCameraOverride)
  const clearCameraOverride = useViewer((state) => state.clearCameraOverride)
  const clearAllCameraOverrides = useViewer((state) => state.clearAllCameraOverrides)
  const [live, setLive] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const tick = () => setLive(getLiveCameraPose())
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [open])

  const views = useMemo(
    () => CAMERA_VIEWS.filter((item) => FRAMEABLE_VIEWS.includes(item.id)),
    [],
  )

  if (!open) return null

  const current = FRAMEABLE_VIEWS.includes(view) ? view : 'hero'

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 2200)
    } catch (error) {
      console.warn('[harp-configurator] clipboard unavailable', error)
    }
  }

  const saveCurrent = () => {
    const pose = getLiveCameraPose()
    if (!pose) return
    setCameraOverride(current, roundPose(pose))
  }

  const copyAll = () => {
    const poses = {}
    const livePose = getLiveCameraPose()
    if (livePose) setCameraOverride(current, roundPose(livePose))
    for (const id of FRAMEABLE_VIEWS) {
      poses[id] =
        id === current && livePose
          ? roundPose(livePose)
          : resolveViewPose(rig, id, { ...overrides, ...(livePose ? { [current]: roundPose(livePose) } : {}) })
    }
    copyText(formatCameraOverrides(poses), 'all')
  }

  const copyCurrent = () => {
    const pose = getLiveCameraPose() ?? overrides[current]
    if (!pose) return
    setCameraOverride(current, roundPose(pose))
    copyText(formatCameraOverrides({ [current]: roundPose(pose) }), current)
  }

  return (
    <aside className="camera-framing" aria-label="Camera framing">
      <div className="camera-framing-head">
        <p className="kicker">Camera framing</p>
        <button type="button" className="text-btn" onClick={() => setCameraEdit(false)}>
          Close
        </button>
      </div>
      <p>
        Pick a view, then drag to orbit, scroll to zoom, and right-drag to pan. Save each one, then copy
        all four and send them back.
      </p>
      <div className="camera-framing-views">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            className={current === item.id ? 'is-active' : ''}
            onClick={() => requestView(item.id)}
          >
            {item.label}
            {overrides[item.id] ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <pre className="camera-framing-live">{poseLine(live)}</pre>
      <div className="camera-framing-actions">
        <button type="button" className="icon-btn" onClick={saveCurrent}>
          Save {views.find((item) => item.id === current)?.label ?? current}
        </button>
        <button type="button" className="icon-btn" onClick={copyCurrent}>
          {copied === current ? 'Copied' : 'Copy this'}
        </button>
        <button type="button" className="icon-btn" onClick={copyAll}>
          {copied === 'all' ? 'Copied' : 'Copy all four'}
        </button>
        <button type="button" className="text-btn" onClick={() => clearCameraOverride(current)}>
          Reset this
        </button>
        <button type="button" className="text-btn" onClick={clearAllCameraOverrides}>
          Reset all
        </button>
      </div>
    </aside>
  )
}
