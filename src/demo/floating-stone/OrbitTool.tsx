import { useEffect, useState } from 'react'
import type { GyroOrbitController, GyroOrbitStatus } from './gyroOrbit'
import { requestGyroPermission } from './gyroOrbit'
import type { MouseOrbitController, MouseOrbitStatus } from './mouseOrbit'

type GyroProps = {
  mode: 'gyro'
  controller: GyroOrbitController
  active: boolean
  onActiveChange: (active: boolean) => void
  visible: boolean
  reducedMotion: boolean
}

type MouseProps = {
  mode: 'mouse'
  controller: MouseOrbitController
  active: boolean
  onActiveChange: (active: boolean) => void
  visible: boolean
  reducedMotion: boolean
}

type Props = GyroProps | MouseProps

export function OrbitTool(props: Props) {
  const { visible, reducedMotion, active, onActiveChange } = props

  if (props.mode === 'gyro') {
    return (
      <GyroOrbitTool
        controller={props.controller}
        active={active}
        onActiveChange={onActiveChange}
        visible={visible}
        reducedMotion={reducedMotion}
      />
    )
  }

  return (
    <MouseOrbitTool
      controller={props.controller}
      active={active}
      onActiveChange={onActiveChange}
      visible={visible}
      reducedMotion={reducedMotion}
    />
  )
}

function GyroOrbitTool({
  controller,
  active,
  onActiveChange,
  visible,
  reducedMotion,
}: {
  controller: GyroOrbitController
  active: boolean
  onActiveChange: (active: boolean) => void
  visible: boolean
  reducedMotion: boolean
}) {
  const [status, setStatus] = useState<GyroOrbitStatus>(controller.status)
  const [engage, setEngage] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let frame = 0
    const poll = () => {
      setStatus(controller.status)
      setEngage(controller.sample.engagement)
      frame = window.requestAnimationFrame(poll)
    }
    frame = window.requestAnimationFrame(poll)
    return () => window.cancelAnimationFrame(frame)
  }, [controller])

  if (!visible || status === 'unsupported' || status === 'denied') return null

  const interactive = status === 'needs-permission'
  const armed = status === 'active' || status === 'ready'
  const modeOn = active && armed

  const onEnable = async () => {
    if (!interactive || busy) return
    setBusy(true)
    try {
      const result = await requestGyroPermission()
      if (result !== 'granted') {
        controller.setStatus('denied')
        setStatus('denied')
        onActiveChange(false)
        return
      }
      controller.enableListening()
      controller.setStatus('ready')
      setStatus('ready')
      controller.recalibrate()
      onActiveChange(true)
    } finally {
      setBusy(false)
    }
  }

  const onToggle = () => {
    if (!armed) return
    if (active) {
      onActiveChange(false)
      return
    }
    controller.recalibrate()
    onActiveChange(true)
  }

  const tilt = reducedMotion || !modeOn ? 0 : engage * 14
  const ringScale = modeOn ? 1 + engage * 0.08 : 1
  const label = interactive
    ? busy
      ? 'Allow motion…'
      : 'Enable orbit tool'
    : modeOn
      ? 'Orbit on · exit'
      : 'Orbit tool'

  return (
    <div
      className={`fs-orbit${modeOn ? ' is-live is-on' : ''}${interactive ? ' is-gated' : ''}${
        modeOn && engage > 0.2 ? ' is-spinning' : ''
      }`}
    >
      {interactive ? (
        <button
          type="button"
          className="fs-orbit__btn"
          onClick={onEnable}
          disabled={busy}
          aria-label="Enable gyroscope orbit tool"
        >
          <OrbitGlyph tilt={0} scale={1} />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          className={`fs-orbit__btn${modeOn ? ' is-pressed' : ''}`}
          onClick={onToggle}
          aria-pressed={modeOn}
          aria-label={modeOn ? 'Exit orbit tool' : 'Enter orbit tool'}
          title={modeOn ? 'Exit rotation mode' : 'Enter rotation mode · tilt phone'}
        >
          <OrbitGlyph tilt={tilt} scale={ringScale} />
          <span>{label}</span>
        </button>
      )}
    </div>
  )
}

function MouseOrbitTool({
  controller,
  active,
  onActiveChange,
  visible,
  reducedMotion,
}: {
  controller: MouseOrbitController
  active: boolean
  onActiveChange: (active: boolean) => void
  visible: boolean
  reducedMotion: boolean
}) {
  const [status, setStatus] = useState<MouseOrbitStatus>(controller.status)
  const [engage, setEngage] = useState(0)

  useEffect(() => {
    let frame = 0
    const poll = () => {
      setStatus(controller.status)
      setEngage(controller.sample.engagement)
      frame = window.requestAnimationFrame(poll)
    }
    frame = window.requestAnimationFrame(poll)
    return () => window.cancelAnimationFrame(frame)
  }, [controller])

  if (!visible || status === 'unsupported') return null

  const armed = status === 'active' || status === 'ready'
  const modeOn = active && armed
  const tilt = reducedMotion || !modeOn ? 0 : engage * 14
  const ringScale = modeOn ? 1 + engage * 0.08 : 1
  const label = modeOn
    ? status === 'active'
      ? 'Orbit on · drag'
      : 'Orbit on · exit'
    : 'Orbit tool'

  const onToggle = () => {
    if (!armed) return
    if (active) {
      if (controller.sample.dragging) controller.pointerUp()
      onActiveChange(false)
      return
    }
    onActiveChange(true)
  }

  return (
    <div
      className={`fs-orbit is-desktop${modeOn ? ' is-live is-on' : ''}${
        modeOn && status === 'active' ? ' is-spinning' : ''
      }`}
    >
      <button
        type="button"
        className={`fs-orbit__btn${modeOn ? ' is-pressed' : ''}`}
        onClick={onToggle}
        aria-pressed={modeOn}
        aria-label={modeOn ? 'Exit orbit tool' : 'Enter orbit tool'}
        title={
          modeOn
            ? 'Exit rotation mode · double-click canvas to reset'
            : 'Enter rotation mode · drag to rotate'
        }
      >
        <OrbitGlyph tilt={tilt} scale={ringScale} />
        <span>{label}</span>
      </button>
    </div>
  )
}

function OrbitGlyph({ tilt, scale }: { tilt: number; scale: number }) {
  return (
    <svg
      className="fs-orbit__glyph"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      style={{
        transform: `rotate(${tilt}deg) scale(${scale})`,
      }}
    >
      <circle cx="9" cy="9" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
      <ellipse
        cx="9"
        cy="9"
        rx="6.2"
        ry="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        opacity="0.85"
      />
      <circle cx="9" cy="9" r="1.35" fill="currentColor" opacity="0.9" />
    </svg>
  )
}
