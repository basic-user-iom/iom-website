import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ORBITING_SPHERES,
  PROBE_ATTRACT,
  PROBE_FOLLOW,
  STONE_HALF,
  probePad,
  stoneFloatY,
  type PointerState,
  type ThemeMode,
} from './sceneConfig'

type Props = {
  theme: ThemeMode
  reducedMotion: boolean
  mobile: boolean
  pointer: MutableRefObject<PointerState>
  colliderRef: MutableRefObject<THREE.Object3D | null>
  /** When orbit rotation mode is on, skip cursor attraction. */
  orbitToolActive: boolean
}

const _look = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _sampleDir = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _inward = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _target = new THREE.Vector3()
const _attract = new THREE.Vector3()
const _fromDir = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _qIdent = new THREE.Quaternion()
const _qStep = new THREE.Quaternion()
const _orbitHits: THREE.Intersection[] = []
const _cursorHits: THREE.Intersection[] = []
const orbitRaycaster = new THREE.Raycaster()
orbitRaycaster.far = 16
const cursorRaycaster = new THREE.Raycaster()
cursorRaycaster.far = 24

/** Floor for dir·N so grazing faces don't explode the radial radius. */
const NORMAL_ALIGN_MIN = 0.55

function fallbackRadius(dir: THREE.Vector3, pad: number): number {
  const rx = Math.max(STONE_HALF.x, STONE_HALF.z) + pad
  const ry = STONE_HALF.y + pad
  const ex = dir.x * rx
  const ey = dir.y * ry
  const ez = dir.z * rx
  return Math.hypot(ex, ey, ez)
}

/**
 * Radial orbit radius outside the hit. Uses a stable pad scale (not pad/dir·N),
 * which used to spike on grazing faces and make probes jerk.
 */
function sampleSurfaceRadius(
  collider: THREE.Object3D | null,
  center: THREE.Vector3,
  dir: THREE.Vector3,
  pad: number,
): number {
  const stable = fallbackRadius(dir, pad)
  if (!collider) return stable
  _origin.copy(center).addScaledVector(dir, 8)
  _inward.copy(dir).negate()
  orbitRaycaster.set(_origin, _inward)
  _orbitHits.length = 0
  orbitRaycaster.intersectObject(collider, true, _orbitHits)
  const hit = _orbitHits[0]
  if (!hit) return stable

  const surfaceDist = hit.point.distanceTo(center)
  let clear = pad * PROBE_FOLLOW.padScale
  if (hit.face) {
    _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize()
    if (_normal.dot(dir) < 0) _normal.negate()
    const align = Math.max(_normal.dot(dir), NORMAL_ALIGN_MIN)
    clear = pad * PROBE_FOLLOW.padScale * (0.65 + 0.35 / align)
  }
  return Math.max(surfaceDist + clear, stable * 0.92)
}

/** Hard floor: if `pos` is inside the stone along its radial ray, snap it out. */
function pushOutside(
  pos: THREE.Vector3,
  center: THREE.Vector3,
  pad: number,
  collider: THREE.Object3D | null,
) {
  _dir.copy(pos).sub(center)
  const len = _dir.length()
  if (len < 1e-5) {
    pos.copy(center).addScaledVector(_dir.set(0, 1, 0), fallbackRadius(_dir, pad))
    return
  }
  _dir.multiplyScalar(1 / len)
  const minR = sampleSurfaceRadius(collider, center, _dir, pad)
  if (len < minR) pos.copy(center).addScaledVector(_dir, minR)
}

function peakLookaheadRadius(
  collider: THREE.Object3D | null,
  center: THREE.Vector3,
  orb: (typeof ORBITING_SPHERES)[number],
  time: number,
  pad: number,
): number {
  let peak = 0
  const steps = PROBE_FOLLOW.lookaheadSteps
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const t = time * orb.speed + orb.phase + u * PROBE_FOLLOW.lookaheadSpan * Math.sign(orb.speed || 1)
    const lat = orb.latitude + Math.sin(time * orb.scanSpeed + orb.phase + u * 0.35) * orb.scan
    const cosLat = Math.cos(lat)
    _sampleDir.set(cosLat * Math.cos(t), Math.sin(lat), cosLat * Math.sin(t)).normalize()
    peak = Math.max(peak, sampleSurfaceRadius(collider, center, _sampleDir, pad))
  }
  return peak
}

const GLOW_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  float core = pow(facing, 3.4);
  float mid = pow(facing, 1.2);
  float rim = pow(1.0 - facing, 2.6);
  float pulse = 0.96 + 0.04 * sin(uTime * 1.05);
  vec3 col = vec3(1.0) * core * 1.15 + uColor * (mid * 0.5 + rim * 0.35);
  float alpha = (core * 0.28 + mid * 0.14 + rim * 0.2) * pulse;
  gl_FragColor = vec4(col * pulse, alpha);
}
`

export function OrbitingSpheres({
  theme,
  reducedMotion,
  mobile,
  pointer,
  colliderRef,
  orbitToolActive,
}: Props) {
  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const time = useRef(0)
  const smoothRadius = useRef<number[]>(ORBITING_SPHERES.map(() => 0))
  const smoothPos = useRef(ORBITING_SPHERES.map(() => new THREE.Vector3()))
  const posReady = useRef(ORBITING_SPHERES.map(() => false))
  const attractWeight = useRef(0)
  const attractIndex = useRef(-1)
  const attractHit = useRef(new THREE.Vector3())
  const attractNormal = useRef(new THREE.Vector3(0, 1, 0))
  const attractReady = useRef(false)
  const followDir = useRef(new THREE.Vector3(1, 0, 0))
  const followDirReady = useRef(false)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const speedScale = reducedMotion ? 0.32 : 1
    time.current += dt * speedScale
    const floatY = stoneFloatY(state.clock.elapsedTime, reducedMotion)
    const collider = colliderRef.current
    _look.set(0, floatY, 0)
    if (collider) collider.updateWorldMatrix(true, true)

    // --- Cursor hit on stone (separate raycaster so orbit sampling can't clobber it) ---
    let cursorHit = false
    if (collider && pointer.current.enabled && !mobile && !reducedMotion && !orbitToolActive) {
      _ndc.set(pointer.current.nx, -pointer.current.ny)
      cursorRaycaster.setFromCamera(_ndc, state.camera)
      _cursorHits.length = 0
      cursorRaycaster.intersectObject(collider, true, _cursorHits)
      const hit = _cursorHits[0]
      if (hit) {
        cursorHit = true
        attractHit.current.copy(hit.point)
        // Always use the live face normal — a lagged normal aims the target into the rock.
        if (hit.face) {
          attractNormal.current
            .copy(hit.face.normal)
            .transformDirection(hit.object.matrixWorld)
            .normalize()
          _dir.copy(hit.point).sub(_look)
          if (attractNormal.current.dot(_dir) < 0) attractNormal.current.negate()
        } else {
          attractNormal.current.copy(hit.point).sub(_look).normalize()
        }
        attractReady.current = true
      }
    }

    const attractGoal = cursorHit ? 1 : 0
    attractWeight.current +=
      (attractGoal - attractWeight.current) *
      (1 - Math.exp(-(cursorHit ? PROBE_ATTRACT.engage : PROBE_ATTRACT.release) * dt))

    // Lock ONE orb for the whole hover; only pick when none is locked yet.
    if (cursorHit && attractIndex.current < 0) {
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < ORBITING_SPHERES.length; i++) {
        const pos = posReady.current[i] ? smoothPos.current[i] : groupRefs.current[i]?.position
        if (!pos) continue
        const d = pos.distanceToSquared(attractHit.current)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      }
      attractIndex.current = best
      followDirReady.current = false
    }
    if (!cursorHit && attractWeight.current < 0.04) {
      attractIndex.current = -1
      attractReady.current = false
      followDirReady.current = false
    }

    ORBITING_SPHERES.forEach((orb, index) => {
      const node = groupRefs.current[index]
      if (!node) return
      const pad = probePad(orb.size, theme)
      const locked = index === attractIndex.current && attractWeight.current > 0.02 && attractReady.current

      // Idle orbit target (always computed so release can blend back cleanly).
      const t = time.current * orb.speed + orb.phase
      const lat = orb.latitude + Math.sin(time.current * orb.scanSpeed + orb.phase) * orb.scan
      const cosLat = Math.cos(lat)
      _dir.set(cosLat * Math.cos(t), Math.sin(lat), cosLat * Math.sin(t)).normalize()

      const desiredR = peakLookaheadRadius(collider, _look, orb, time.current, pad)
      let r = smoothRadius.current[index]
      if (r <= 0) r = desiredR
      const expand = desiredR > r
      const rate = expand ? PROBE_FOLLOW.expandLerp : PROBE_FOLLOW.settleLerp
      r += (desiredR - r) * (1 - Math.exp(-rate * dt))
      smoothRadius.current[index] = r

      _target.copy(_look).addScaledVector(_dir, r)

      const prev = smoothPos.current[index]
      if (!posReady.current[index]) {
        prev.copy(_target)
        posReady.current[index] = true
      }

      if (locked) {
        // Desired shell point from LIVE cursor hit (never lerp hit points through the volume).
        _attract.copy(attractHit.current).addScaledVector(attractNormal.current, pad)
        pushOutside(_attract, _look, pad, collider)

        _dir.copy(_attract).sub(_look)
        if (_dir.lengthSq() < 1e-8) _dir.set(0, 1, 0)
        else _dir.normalize()

        if (!followDirReady.current) {
          _fromDir.copy(prev).sub(_look)
          if (_fromDir.lengthSq() < 1e-8) followDir.current.copy(_dir)
          else followDir.current.copy(_fromDir).normalize()
          followDirReady.current = true
        }

        // Rotate current follow dir toward the cursor dir (stable, no nlerp-through-center).
        const k = Math.min(1, 1 - Math.exp(-PROBE_ATTRACT.chase * dt))
        const pull = Math.min(1, attractWeight.current) * PROBE_ATTRACT.strength
        const turn = k * pull
        if (turn >= 0.999 || followDir.current.dot(_dir) > 0.9999) {
          followDir.current.copy(_dir)
        } else if (followDir.current.dot(_dir) < -0.999) {
          // Near-opposite: pick a perpendicular pivot so we don't collapse through the center.
          _fromDir.set(0, 1, 0)
          if (Math.abs(followDir.current.dot(_fromDir)) > 0.9) _fromDir.set(1, 0, 0)
          _fromDir.crossVectors(followDir.current, _fromDir).normalize()
          followDir.current.lerp(_fromDir, turn).normalize()
        } else {
          _qStep.setFromUnitVectors(followDir.current, _dir)
          _qIdent.identity().slerp(_qStep, turn)
          followDir.current.applyQuaternion(_qIdent).normalize()
        }

        // Hard radius for THIS direction every frame — soft radius is what let fast moves clip.
        const shellR = sampleSurfaceRadius(collider, _look, followDir.current, pad)
        prev.copy(_look).addScaledVector(followDir.current, shellR)
        pushOutside(prev, _look, pad, collider)
        smoothRadius.current[index] = Math.max(smoothRadius.current[index], prev.distanceTo(_look))
      } else {
        prev.lerp(_target, 1 - Math.exp(-PROBE_FOLLOW.posLerp * dt))
        pushOutside(prev, _look, pad, collider)
        const pushedR = prev.distanceTo(_look)
        if (pushedR > smoothRadius.current[index]) smoothRadius.current[index] = pushedR
      }

      node.position.copy(prev)
      node.lookAt(_look)
    })
  })

  return (
    <group>
      {ORBITING_SPHERES.map((orb, index) => (
        <group
          key={orb.nightColor}
          ref={(node) => {
            groupRefs.current[index] = node
          }}
        >
          {theme === 'night' ? (
            <LightOrb
              color={orb.nightColor}
              size={orb.size}
              intensity={orb.nightLight}
              distance={orb.lightDistance}
              reducedMotion={reducedMotion}
            />
          ) : (
            <DaySphere color={orb.dayColor} size={orb.size} />
          )}
        </group>
      ))}
    </group>
  )
}

function useOrbGlow(color: string) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
      },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      toneMapped: false,
      dithering: true,
      fog: false,
    })
  }, [color])

  useEffect(() => () => material.dispose(), [material])
  return material
}

function LightOrb({
  color,
  size,
  intensity,
  distance,
  reducedMotion,
}: {
  color: string
  size: number
  intensity: number
  distance: number
  reducedMotion: boolean
}) {
  const shell = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const glowMat = useOrbGlow(color)
  const tint = useMemo(() => new THREE.Color(color), [color])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    glowMat.uniforms.uTime.value = state.clock.elapsedTime
    if (shell.current) shell.current.rotation.y += dt * 0.22
    if (glow.current && !reducedMotion) {
      const s = 1.28 * (1 + Math.sin(state.clock.elapsedTime * 1.05) * 0.025)
      glow.current.scale.setScalar(s)
    }
  })

  return (
    <group>
      <mesh raycast={() => undefined}>
        <sphereGeometry args={[size * 0.52, 48, 48]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={shell} raycast={() => undefined}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshPhysicalMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.42}
          roughness={0.1}
          metalness={0.02}
          transmission={0.22}
          thickness={0.35}
          ior={1.45}
          attenuationColor={tint}
          attenuationDistance={0.4}
          transparent
          opacity={0.62}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={0.45}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.04} raycast={() => undefined}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial
          color={tint}
          side={THREE.BackSide}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glow} scale={1.28} raycast={() => undefined}>
        <sphereGeometry args={[size, 40, 40]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
      <pointLight color={color} intensity={intensity} distance={distance} decay={2} />
    </group>
  )
}

function DaySphere({ color, size }: { color: string; size: number }) {
  return (
    <mesh castShadow receiveShadow raycast={() => undefined}>
      <sphereGeometry args={[size, 48, 48]} />
      <meshPhysicalMaterial
        color={color}
        metalness={1}
        roughness={0.18}
        envMapIntensity={1.35}
        clearcoat={0.42}
        clearcoatRoughness={0.22}
        reflectivity={1}
      />
    </mesh>
  )
}
