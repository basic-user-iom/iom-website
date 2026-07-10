/** Mobile device-tilt parallax for hero clouds (maps to shader iMouse / orbit drift). */

export type MotionParallaxStatus =
  | 'disabled'
  | 'unavailable'
  | 'needs_permission'
  | 'active'
  | 'denied'

type StatusListener = (status: MotionParallaxStatus) => void

/** Left-right tilt span mapped to full parallax range. */
const GAMMA_RANGE_DEG = 38
/** Front-back tilt span mapped to full parallax range. */
const BETA_RANGE_DEG = 28
/** Matches mobile pointer parallax gain in useHeroScene. */
export const MOTION_PARALLAX_GAIN = 0.35

/** If auto-start yields no events, prompt the user to tap. */
const AUTO_START_TIMEOUT_MS = 2000
/** After an explicit tap, allow a little longer before treating as denied. */
const GESTURE_START_TIMEOUT_MS = 3000

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function hasOrientationPermissionApi(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    'requestPermission' in DeviceOrientationEvent &&
    typeof (
      DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState>
      }
    ).requestPermission === 'function'
  )
}

function getScreenOrientationAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation?.angle != null) {
    return screen.orientation.angle
  }
  const legacy = (window as Window & { orientation?: number }).orientation
  if (legacy == null) return 0
  return legacy < 0 ? 360 + legacy : legacy
}

/** Rotate gamma/beta into portrait-relative axes when the screen is turned. */
function adjustTiltForScreenOrientation(
  gamma: number,
  beta: number,
): { gamma: number; beta: number } {
  switch (getScreenOrientationAngle()) {
    case 90:
      return { gamma: beta, beta: -gamma }
    case 180:
      return { gamma: -gamma, beta: -beta }
    case 270:
      return { gamma: -beta, beta: gamma }
    default:
      return { gamma, beta }
  }
}

export type DeviceOrientationParallax = {
  getStatus: () => MotionParallaxStatus
  subscribe: (listener: StatusListener) => () => void
  requestPermission: () => Promise<boolean>
  isActive: () => boolean
  dispose: () => void
}

let activeInstance: DeviceOrientationParallax | null = null
const globalListeners = new Set<StatusListener>()

function notifyGlobal(status: MotionParallaxStatus) {
  for (const listener of globalListeners) {
    listener(status)
  }
}

export function subscribeMotionParallaxStatus(listener: StatusListener): () => void {
  globalListeners.add(listener)
  listener(activeInstance?.getStatus() ?? 'disabled')
  return () => {
    globalListeners.delete(listener)
  }
}

export async function requestMotionParallaxPermission(): Promise<boolean> {
  return (await activeInstance?.requestPermission()) ?? false
}

export function createDeviceOrientationParallax(options: {
  enabled: boolean
  onTargetUpdate: (x: number, y: number) => void
}): DeviceOrientationParallax {
  let status: MotionParallaxStatus = 'disabled'
  let baseGamma: number | null = null
  let baseBeta: number | null = null
  let listening = false
  let receivedOrientationEvent = false
  let activationTimer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<StatusListener>()

  const setStatus = (next: MotionParallaxStatus) => {
    if (status === next) return
    status = next
    for (const listener of listeners) {
      listener(next)
    }
    notifyGlobal(next)
  }

  const clearActivationTimer = () => {
    if (activationTimer == null) return
    clearTimeout(activationTimer)
    activationTimer = null
  }

  const scheduleActivationTimeout = (ms: number, onTimeout: () => void) => {
    clearActivationTimer()
    activationTimer = setTimeout(() => {
      activationTimer = null
      onTimeout()
    }, ms)
  }

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) return

    receivedOrientationEvent = true
    clearActivationTimer()

    const { gamma, beta } = adjustTiltForScreenOrientation(event.gamma, event.beta)

    if (baseGamma == null || baseBeta == null) {
      baseGamma = gamma
      baseBeta = beta
      return
    }

    if (status !== 'active') {
      setStatus('active')
    }

    const x =
      clamp((gamma - baseGamma) / GAMMA_RANGE_DEG, -1, 1) * MOTION_PARALLAX_GAIN
    const y = clamp((beta - baseBeta) / BETA_RANGE_DEG, -1, 1) * MOTION_PARALLAX_GAIN
    options.onTargetUpdate(x, y)
  }

  const resetBaseline = () => {
    baseGamma = null
    baseBeta = null
  }

  const onScreenOrientationChange = () => {
    resetBaseline()
  }

  const startListening = (watchForEvents: boolean) => {
    if (listening) return
    window.addEventListener('deviceorientation', onOrientation, { passive: true })
    screen.orientation?.addEventListener('change', onScreenOrientationChange)
    listening = true

    if (!watchForEvents) return

    receivedOrientationEvent = false
    scheduleActivationTimeout(AUTO_START_TIMEOUT_MS, () => {
      if (!receivedOrientationEvent && status !== 'active' && status !== 'denied') {
        setStatus('needs_permission')
      }
    })
  }

  const stopListening = () => {
    if (!listening) return
    window.removeEventListener('deviceorientation', onOrientation)
    screen.orientation?.removeEventListener('change', onScreenOrientationChange)
    listening = false
    clearActivationTimer()
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!options.enabled || status === 'active') return status === 'active'

    try {
      if (hasOrientationPermissionApi()) {
        const request = (
          DeviceOrientationEvent as typeof DeviceOrientationEvent & {
            requestPermission: () => Promise<PermissionState>
          }
        ).requestPermission
        const result = await request()
        if (result !== 'granted') {
          setStatus('denied')
          return false
        }
      }

      resetBaseline()
      clearActivationTimer()
      startListening(false)

      scheduleActivationTimeout(GESTURE_START_TIMEOUT_MS, () => {
        if (!receivedOrientationEvent && status !== 'active') {
          setStatus('denied')
        }
      })

      return true
    } catch {
      setStatus('denied')
      return false
    }
  }

  const init = () => {
    if (!options.enabled) {
      setStatus('disabled')
      return
    }
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setStatus('unavailable')
      return
    }

    // iOS Safari and some Android 13+ Chrome builds expose requestPermission.
    if (hasOrientationPermissionApi()) {
      setStatus('needs_permission')
      return
    }

    // Android / Firefox: try silent auto-start; fall back to tap prompt if no events.
    startListening(true)
  }

  const instance: DeviceOrientationParallax = {
    getStatus: () => status,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(status)
      return () => {
        listeners.delete(listener)
      }
    },
    requestPermission,
    isActive: () => status === 'active',
    dispose: () => {
      stopListening()
      listeners.clear()
      if (activeInstance === instance) {
        activeInstance = null
        notifyGlobal('disabled')
      }
    },
  }

  activeInstance = instance
  init()

  return instance
}
