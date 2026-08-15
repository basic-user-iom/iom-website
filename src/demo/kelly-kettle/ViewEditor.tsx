import { useState } from 'react'
import type { CameraPose, DemoStep, SavedLabel, StepViewSetup } from './types'

type Props = {
  open: boolean
  step: DemoStep
  pose: CameraPose | null
  setups: Partial<Record<DemoStep, StepViewSetup>>
  liveLabels: SavedLabel[]
  onToggle: () => void
  onSaveCamera: () => void
}

function round(n: number, d = 3) {
  const p = 10 ** d
  return Math.round(n * p) / p
}

export function buildViewCopy(
  step: DemoStep,
  pose: CameraPose | null,
  setups: Partial<Record<DemoStep, StepViewSetup>>,
  liveLabels: SavedLabel[],
) {
  const next = {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    step,
    setups: {
      ...setups,
      [step]: {
        camera: pose
          ? {
              px: round(pose.px),
              py: round(pose.py),
              pz: round(pose.pz),
              tx: round(pose.tx),
              ty: round(pose.ty),
              tz: round(pose.tz),
              fov: round(pose.fov, 1),
            }
          : setups[step]?.camera ?? null,
        labels: liveLabels.map((label) => ({
          ...label,
          x: round(label.x, 1),
          y: round(label.y, 1),
        })),
      },
    },
  }
  return JSON.stringify(next, null, 2)
}

export function ViewEditor({ open, step, pose, setups, liveLabels, onToggle, onSaveCamera }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = buildViewCopy(step, pose, setups, liveLabels)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copy this view setup', text)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={open ? 'kk-view-edit is-open' : 'kk-view-edit'}>
      <button type="button" className="kk-view-edit__toggle" onClick={onToggle}>
        {open ? 'Done adjusting' : 'Adjust camera & labels'}
      </button>
      {open ? (
        <div className="kk-view-edit__panel">
          <p>
            Drag the kettle to set the camera. Drag the notes to place them. Then copy and send me
            the values.
          </p>
          <p className="kk-view-edit__meta">
            Step: {step}
            {pose
              ? ` · cam ${round(pose.px)} ${round(pose.py)} ${round(pose.pz)}`
              : ''}
          </p>
          <div className="kk-view-edit__row">
            <button type="button" className="kk-text-btn" onClick={onSaveCamera}>
              Save camera
            </button>
            <button type="button" className="kk-primary" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy values'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
