import { useProgress } from '@react-three/drei'
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
} from 'react'
import { isSuperbrightRockUnlocked, tryCrmEmbedUnlock, unlockSuperbrightRock } from './auth'
import { Scene } from './Scene'
import { ThemeToggle } from './ThemeToggle'
import { OrbitTool } from './OrbitTool'
import {
  canOfferGyroOrbit,
  createGyroOrbitController,
  deviceOrientationPermissionRequired,
} from './gyroOrbit'
import { canOfferMouseOrbit, createMouseOrbitController } from './mouseOrbit'
import {
  canUsePointerParallax,
  hasWebGL,
  prefersReducedMotion,
  type PointerState,
  type ThemeMode,
} from './sceneConfig'
import './floating-stone.css'

const BOOT_TIMEOUT_MS = 20_000
const DAY_TIMEOUT_MS = 12_000
const LOADER_EXIT_MS = 420
const LOADER_EXIT_REDUCED_MS = 120

type LoadPhase = 'boot' | 'day' | null

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockSuperbrightRock(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="fs-gate">
      <div className="fs-gate__panel">
        <p className="fs-gate__brand">Superbright rock</p>
        <p className="fs-gate__hint">Private client preview. Enter the password to continue.</p>
        <form className="fs-gate__form" onSubmit={submit}>
          <input
            className="fs-gate__input"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError(false)
            }}
            autoFocus
          />
          <button className="fs-gate__submit" type="submit">
            Enter
          </button>
          {error ? <p className="fs-gate__error">Incorrect password.</p> : null}
        </form>
      </div>
    </div>
  )
}

export function App() {
  const [unlocked, setUnlocked] = useState(
    () => (typeof window === 'undefined' ? false : isSuperbrightRockUnlocked() || tryCrmEmbedUnlock()),
  )
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <FloatingStoneApp />
}

function FloatingStoneApp() {
  const [theme, setTheme] = useState<ThemeMode>('night')
  const [visualTheme, setVisualTheme] = useState<ThemeMode>('night')
  const [webgl, setWebgl] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [bootReady, setBootReady] = useState(false)
  const [dayPending, setDayPending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [orbitMode, setOrbitMode] = useState<'gyro' | 'mouse' | null>(null)
  /** When true: drag/gyro rotates the stone; orbs stop following the cursor. */
  const [orbitToolActive, setOrbitToolActive] = useState(false)
  const pointer = useRef<PointerState>({ nx: 0, ny: 0, enabled: false })
  const gyroOrbit = useMemo(() => createGyroOrbitController(), [])
  const mouseOrbit = useMemo(() => createMouseOrbitController(), [])

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const narrow = window.matchMedia('(max-width: 720px)').matches
    setWebgl(hasWebGL())
    setReducedMotion(reduced)
    setMobile(coarse || narrow)
    pointer.current.enabled = canUsePointerParallax() && !reduced

    const onMove = (event: PointerEvent) => {
      if (!pointer.current.enabled) return
      pointer.current.nx = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.ny = (event.clientY / window.innerHeight) * 2 - 1
    }
    const onLeave = () => {
      pointer.current.nx = 0
      pointer.current.ny = 0
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  useEffect(() => {
    // Fine pointer → mouse arcball; otherwise mobile gyro path.
    const mouse = canOfferMouseOrbit()
    const gyro = !mouse && canOfferGyroOrbit()

    if (mouse) {
      setOrbitMode('mouse')
      mouseOrbit.setStatus('ready')
      gyroOrbit.setStatus('unsupported')
      return () => {
        mouseOrbit.dispose()
        mouseOrbit.setStatus('unsupported')
      }
    }

    mouseOrbit.setStatus('unsupported')

    if (!gyro) {
      setOrbitMode(null)
      gyroOrbit.setStatus('unsupported')
      return
    }

    setOrbitMode('gyro')
    if (deviceOrientationPermissionRequired()) {
      gyroOrbit.setStatus('needs-permission')
      return () => gyroOrbit.dispose()
    }

    // Android / non-gated browsers: listen immediately (no iOS permission gate).
    gyroOrbit.setStatus('ready')
    gyroOrbit.enableListening()
    return () => gyroOrbit.dispose()
  }, [gyroOrbit, mouseOrbit])

  useEffect(() => {
    document.documentElement.dataset.fsTheme = visualTheme
    document.documentElement.style.background = visualTheme === 'night' ? '#07080a' : '#e6e8ec'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', visualTheme === 'night' ? '#07080a' : '#e6e8ec')
  }, [visualTheme])

  const revealDay = useCallback(() => {
    setVisualTheme('day')
    setDayPending(false)
    setLoadError(null)
  }, [])

  const onBootReady = useCallback(() => {
    setBootReady(true)
    setLoadError(null)
  }, [])

  const onDayReady = useCallback(() => {
    revealDay()
  }, [revealDay])

  const onDayFailed = useCallback(() => {
    setDayPending(false)
    setTheme('night')
    setVisualTheme('night')
    setLoadError('Day lighting could not be loaded. Staying in night mode.')
  }, [])

  const requestTheme = useCallback(
    (next: ThemeMode) => {
      if (next === theme && !(next === 'day' && dayPending)) return
      setLoadError(null)
      if (next === 'day') {
        if (visualTheme === 'day') {
          setTheme('day')
          return
        }
        setTheme('day')
        setDayPending(true)
        return
      }
      setDayPending(false)
      setTheme('night')
      setVisualTheme('night')
    },
    [theme, dayPending, visualTheme],
  )

  // Fail-safe: never block the UI forever if a ready signal never arrives.
  useEffect(() => {
    if (bootReady) return
    const id = window.setTimeout(() => {
      setBootReady(true)
      setLoadError((prev) => prev ?? 'Some assets are still loading in the background.')
    }, BOOT_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [bootReady])

  useEffect(() => {
    if (!dayPending) return
    const id = window.setTimeout(() => {
      // Reveal day anyway so the UI never sticks; env may still stream in.
      revealDay()
      setLoadError((prev) => prev ?? 'Day lighting is taking longer than expected.')
    }, DAY_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [dayPending, revealDay])

  const phase: LoadPhase = !bootReady ? 'boot' : dayPending ? 'day' : null
  const loading = phase !== null
  // Mount day Environment while still showing night visually.
  const loadDayEnv = theme === 'day' || visualTheme === 'day'

  return (
    <div className={`fs-app is-${visualTheme}${loading ? ' is-loading' : ''}`}>
      <ThemeToggle theme={theme} onChange={requestTheme} disabled={loading} />
      {orbitMode === 'gyro' ? (
        <OrbitTool
          mode="gyro"
          controller={gyroOrbit}
          active={orbitToolActive}
          onActiveChange={setOrbitToolActive}
          visible={bootReady && !loading}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {orbitMode === 'mouse' ? (
        <OrbitTool
          mode="mouse"
          controller={mouseOrbit}
          active={orbitToolActive}
          onActiveChange={setOrbitToolActive}
          visible={bootReady && !loading}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <div className="fs-vignette" aria-hidden="true" />
      {!webgl ? (
        <p className="fs-fallback">This scene needs WebGL.</p>
      ) : (
        <CanvasErrorBoundary>
          <Scene
            theme={visualTheme}
            loadDayEnv={loadDayEnv}
            pointer={pointer}
            reducedMotion={reducedMotion}
            mobile={mobile}
            orbitToolActive={orbitToolActive}
            gyroOrbit={orbitMode === 'gyro' ? gyroOrbit : null}
            mouseOrbit={orbitMode === 'mouse' ? mouseOrbit : null}
            onBootReady={onBootReady}
            onDayReady={onDayReady}
            onDayFailed={onDayFailed}
          />
          <LoadingOverlay
            phase={phase}
            reducedMotion={reducedMotion}
            error={loadError}
            onDismissError={() => setLoadError(null)}
          />
        </CanvasErrorBoundary>
      )}
    </div>
  )
}

function LoadingOverlay({
  phase,
  reducedMotion,
  error,
  onDismissError,
}: {
  phase: LoadPhase
  reducedMotion: boolean
  error: string | null
  onDismissError: () => void
}) {
  const { active, progress, errors } = useProgress()
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)
  const exitMs = reducedMotion ? LOADER_EXIT_REDUCED_MS : LOADER_EXIT_MS
  const show = phase !== null || visible
  const displayProgress = phase !== null ? Math.max(progress, active ? 8 : progress) : 100

  useEffect(() => {
    if (phase !== null) {
      setVisible(true)
      setExiting(false)
      return
    }
    setExiting(true)
    const id = window.setTimeout(() => {
      setVisible(false)
      setExiting(false)
    }, exitMs)
    return () => window.clearTimeout(id)
  }, [phase, exitMs])

  const progressErrors = errors.length > 0
  const message =
    phase === 'boot'
      ? 'Loading scene'
      : phase === 'day'
        ? 'Opening day'
        : exiting
          ? 'Ready'
          : null

  if (!show && !error) return null

  return (
    <>
      {show ? (
        <div
          className={`fs-loader${exiting || phase === null ? ' is-done' : ''}${
            phase === 'day' ? ' is-day-transition' : ''
          }${reducedMotion ? ' is-reduced' : ''}`}
          role="status"
          aria-live="polite"
          aria-busy={phase !== null}
        >
          <div className="fs-loader__panel">
            <p className="fs-loader__brand">IOM</p>
            <p className="fs-loader__label">{message ?? 'Ready'}</p>
            <div className="fs-loader__track" aria-hidden="true">
              <div
                className="fs-loader__bar"
                style={{ transform: `scaleX(${Math.min(100, Math.max(displayProgress, 4)) / 100})` }}
              />
            </div>
            <p className="fs-loader__pct" aria-hidden="true">
              {phase !== null ? `${Math.round(Math.min(100, displayProgress))}%` : ''}
            </p>
          </div>
        </div>
      ) : null}

      {(error || progressErrors) && phase === null ? (
        <div className="fs-loader-toast" role="status">
          <p>{error ?? 'A resource failed to load. The scene may look incomplete.'}</p>
          <button type="button" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  )
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[floating-stone]', error, info)
  }

  render() {
    if (this.state.failed) {
      return <p className="fs-fallback">The stone could not be loaded.</p>
    }
    return this.props.children
  }
}
