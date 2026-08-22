import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { AdaptiveDpr, Environment, SoftShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FloatingStone } from './FloatingStone'
import { OrbitingSpheres } from './OrbitingSpheres'
import type { GyroOrbitController } from './gyroOrbit'
import type { MouseOrbitController } from './mouseOrbit'
import {
  CAMERA,
  CAMERA_PARALLAX,
  DAY,
  GROUND_Y,
  NIGHT,
  type PointerState,
  type ThemeMode,
} from './sceneConfig'

type Props = {
  /** Applied visual theme (lights / background / materials). */
  theme: ThemeMode
  /** Mount day Environment even while visuals are still night (preload gate). */
  loadDayEnv: boolean
  pointer: MutableRefObject<PointerState>
  reducedMotion: boolean
  mobile: boolean
  /** Orbit tool enter/exit — when on, drag/gyro rotate; orbs skip cursor attraction. */
  orbitToolActive: boolean
  gyroOrbit: GyroOrbitController | null
  mouseOrbit: MouseOrbitController | null
  onBootReady?: () => void
  onDayReady?: () => void
  onDayFailed?: () => void
}

export function Scene({
  theme,
  loadDayEnv,
  pointer,
  reducedMotion,
  mobile,
  orbitToolActive,
  gyroOrbit,
  mouseOrbit,
  onBootReady,
  onDayReady,
  onDayFailed,
}: Props) {
  const night = theme === 'night'
  const stoneCollider = useRef<THREE.Object3D | null>(null)

  return (
    <Canvas
      className="fs-canvas"
      shadows
      dpr={mobile ? [1, 1.25] : [1, 1.75]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: night ? NIGHT.exposure : DAY.exposure,
        powerPreference: 'high-performance',
      }}
      camera={{
        position: [...CAMERA.position],
        fov: CAMERA.fov,
        near: 0.1,
        far: 48,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <AdaptiveDpr pixelated={false} />
      <RendererState theme={theme} />
      <color attach="background" args={[night ? NIGHT.background : DAY.background]} />
      {night ? <fog attach="fog" args={[NIGHT.background, NIGHT.fogNear, NIGHT.fogFar]} /> : null}
      {!night && !mobile ? <SoftShadows size={8} samples={16} focus={0.55} /> : null}

      {mouseOrbit ? (
        <MouseOrbitCapture controller={mouseOrbit} active={orbitToolActive} />
      ) : null}
      <CameraRig
        pointer={pointer}
        reducedMotion={reducedMotion}
        mouseOrbit={mouseOrbit}
        orbitToolActive={orbitToolActive}
      />
      <SceneLights theme={theme} mobile={mobile} />

      {/* Stone + probes: initial boot gate */}
      <Suspense fallback={null}>
        <FloatingStone
          theme={theme}
          pointer={pointer}
          reducedMotion={reducedMotion}
          colliderRef={stoneCollider}
          orbitToolActive={orbitToolActive}
          gyroOrbit={gyroOrbit}
          mouseOrbit={mouseOrbit}
        />
        <OrbitingSpheres
          theme={theme}
          reducedMotion={reducedMotion}
          mobile={mobile}
          pointer={pointer}
          colliderRef={stoneCollider}
          orbitToolActive={orbitToolActive}
        />
        <ReadyPing onReady={onBootReady} />
      </Suspense>

      {/* Day HDRI: separate boundary — can preload under night visuals without remounting the stone */}
      {loadDayEnv ? (
        <DayAssetsBoundary onFailed={onDayFailed}>
          <Suspense fallback={null}>
            <Environment
              preset="studio"
              environmentIntensity={night ? 0 : DAY.envIntensity}
            />
            {!night ? <ShadowCatcher /> : null}
            <ReadyPing onReady={onDayReady} />
          </Suspense>
        </DayAssetsBoundary>
      ) : null}
    </Canvas>
  )
}

/** Wire canvas pointer drag → Shoemake arcball (desktop orbit tool). Gated by mode toggle. */
function MouseOrbitCapture({
  controller,
  active,
}: {
  controller: MouseOrbitController
  active: boolean
}) {
  const { gl } = useThree()
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const el = gl.domElement
    el.style.touchAction = 'none'

    const rectOf = () => el.getBoundingClientRect()

    const onDown = (event: PointerEvent) => {
      if (!activeRef.current) return
      if (event.button !== 0) return
      if (controller.status === 'unsupported') return
      el.setPointerCapture(event.pointerId)
      controller.pointerDown(event.clientX, event.clientY, rectOf())
      el.classList.add('is-orbiting')
    }

    const onMove = (event: PointerEvent) => {
      if (!controller.sample.dragging) return
      controller.pointerMove(event.clientX, event.clientY, rectOf())
    }

    const onUp = (event: PointerEvent) => {
      if (!controller.sample.dragging) return
      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        /* already released */
      }
      controller.pointerUp()
      el.classList.remove('is-orbiting')
    }

    const onDblClick = (event: MouseEvent) => {
      if (!activeRef.current) return
      event.preventDefault()
      controller.reset()
      el.classList.remove('is-orbiting')
    }

    const onLostCapture = () => {
      if (controller.sample.dragging) controller.pointerUp()
      el.classList.remove('is-orbiting')
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('lostpointercapture', onLostCapture)
    el.addEventListener('dblclick', onDblClick)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('lostpointercapture', onLostCapture)
      el.removeEventListener('dblclick', onDblClick)
      el.classList.remove('fs-canvas--orbit', 'is-orbiting')
      el.style.touchAction = ''
    }
  }, [gl, controller])

  useEffect(() => {
    const el = gl.domElement
    if (active) {
      el.classList.add('fs-canvas--orbit')
    } else {
      el.classList.remove('fs-canvas--orbit', 'is-orbiting')
      if (controller.sample.dragging) controller.pointerUp()
    }
  }, [gl, controller, active])

  return null
}

function ReadyPing({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return null
}

class DayAssetsBoundary extends Component<
  { children: ReactNode; onFailed?: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  private notified = false

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[floating-stone] day assets', error, info)
    this.notifyFailed()
  }

  componentDidUpdate(_: Readonly<{ onFailed?: () => void }>, prev: { failed: boolean }) {
    if (this.state.failed && !prev.failed) this.notifyFailed()
  }

  private notifyFailed() {
    if (this.notified) return
    this.notified = true
    this.props.onFailed?.()
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function RendererState({ theme }: { theme: ThemeMode }) {
  const { gl } = useThree()
  useLayoutEffect(() => {
    gl.toneMappingExposure = theme === 'night' ? NIGHT.exposure : DAY.exposure
    gl.shadowMap.enabled = theme === 'day'
  }, [gl, theme])
  return null
}

function CameraRig({
  pointer,
  reducedMotion,
  mouseOrbit,
  orbitToolActive,
}: {
  pointer: MutableRefObject<PointerState>
  reducedMotion: boolean
  mouseOrbit: MouseOrbitController | null
  orbitToolActive: boolean
}) {
  const { camera } = useThree()
  const look = useMemo(() => new THREE.Vector3(...CAMERA.lookAt), [])
  const current = useRef(new THREE.Vector3(...CAMERA.position))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const orbitMute = Boolean(orbitToolActive && mouseOrbit?.engaged)
    const enabled = pointer.current.enabled && !reducedMotion && !orbitMute
    const tx = CAMERA.position[0] + (enabled ? pointer.current.nx * CAMERA_PARALLAX : 0)
    const ty = CAMERA.position[1] + (enabled ? -pointer.current.ny * CAMERA_PARALLAX * 0.45 : 0)
    const tz = CAMERA.position[2]
    const k = 1 - Math.exp(-3.4 * dt)
    current.current.x += (tx - current.current.x) * k
    current.current.y += (ty - current.current.y) * k
    current.current.z += (tz - current.current.z) * k
    camera.position.copy(current.current)
    camera.lookAt(look)
  })

  return null
}

function SceneLights({ theme, mobile }: { theme: ThemeMode; mobile: boolean }) {
  if (theme === 'night') {
    return (
      <>
        <ambientLight intensity={NIGHT.ambient} />
        <hemisphereLight args={[NIGHT.hemisphereSky, NIGHT.hemisphereGround, NIGHT.hemisphere]} />
      </>
    )
  }

  const mapSize = mobile ? 1024 : 2048
  return (
    <>
      <ambientLight intensity={DAY.ambient} />
      <hemisphereLight args={[DAY.hemisphereSky, DAY.hemisphereGround, DAY.hemisphere]} />
      <directionalLight
        castShadow
        position={[...DAY.sunPosition]}
        intensity={DAY.sunIntensity}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.00008}
        shadow-normalBias={0.01}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-camera-left={-3.5}
        shadow-camera-right={3.5}
        shadow-camera-top={3.5}
        shadow-camera-bottom={-3.5}
      />
      <directionalLight
        position={[...DAY.rimPosition]}
        intensity={DAY.rimIntensity}
        color={DAY.rimColor}
      />
    </>
  )
}

function ShadowCatcher() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
      <planeGeometry args={[28, 28]} />
      <shadowMaterial transparent opacity={DAY.shadowOpacity} color="#1c1914" />
    </mesh>
  )
}

