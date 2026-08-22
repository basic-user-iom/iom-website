import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import type { GyroOrbitController } from './gyroOrbit'
import type { MouseOrbitController } from './mouseOrbit'
import { MOUSE_ORBIT } from './mouseOrbit'
import { STONE_MOTION, STONE_TARGET_SIZE, STONE_URL, stoneFloatY, type PointerState, type ThemeMode } from './sceneConfig'

type Props = {
  theme: ThemeMode
  pointer: MutableRefObject<PointerState>
  reducedMotion: boolean
  colliderRef: MutableRefObject<THREE.Object3D | null>
  orbitToolActive: boolean
  gyroOrbit: GyroOrbitController | null
  mouseOrbit: MouseOrbitController | null
}

type PreparedStone = {
  root: THREE.Group
  center: THREE.Vector3
  scale: number
}

function prepareStone(scene: THREE.Group): PreparedStone {
  const root = scene.clone(true)
  const meshes: THREE.Mesh[] = []
  root.traverse((obj) => {
    const next = obj as THREE.Mesh
    if (!next.isMesh) return
    next.castShadow = true
    next.receiveShadow = true
    next.raycast = acceleratedRaycast
    const geom = next.geometry as THREE.BufferGeometry & {
      computeBoundsTree?: typeof computeBoundsTree
      disposeBoundsTree?: typeof disposeBoundsTree
      boundsTree?: unknown
    }
    geom.computeBoundsTree = computeBoundsTree
    geom.disposeBoundsTree = disposeBoundsTree
    if (!geom.boundsTree) geom.computeBoundsTree()
    const materials = Array.isArray(next.material) ? next.material : [next.material]
    const cloned = materials.map((mat) => {
      const copy = mat.clone()
      if (copy instanceof THREE.MeshStandardMaterial) {
        copy.metalness = Math.min(copy.metalness, 0.04)
        // Keep authored roughness (no soft cap) so micro-surface reads.
        if (copy.map) {
          copy.map.colorSpace = THREE.SRGBColorSpace
          copy.map.anisotropy = 8
        }
        if (copy.normalMap) {
          copy.normalMap.anisotropy = 8
          copy.normalScale?.set(1.1, 1.1)
        }
        if (copy.metalnessMap) copy.metalnessMap.anisotropy = 4
        if (copy.roughnessMap) copy.roughnessMap.anisotropy = 4
      }
      return copy
    })
    next.material = Array.isArray(next.material) ? cloned : cloned[0]
    meshes.push(next)
  })
  if (!meshes.length) throw new Error('Stone mesh missing')

  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  return { root, center, scale: STONE_TARGET_SIZE / maxDim }
}

export function FloatingStone({
  theme,
  pointer,
  reducedMotion,
  colliderRef,
  orbitToolActive,
  gyroOrbit,
  mouseOrbit,
}: Props) {
  const { scene } = useGLTF(STONE_URL)
  const prepared = useMemo(() => prepareStone(scene), [scene])
  const group = useRef<THREE.Group>(null)
  const idleY = useRef(0)
  const mouseX = useRef(0)
  const mouseY = useRef(0)
  const idleQuat = useMemo(() => new THREE.Quaternion(), [])
  const parallaxQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  useLayoutEffect(() => {
    colliderRef.current = prepared.root
    return () => {
      if (colliderRef.current === prepared.root) colliderRef.current = null
    }
  }, [colliderRef, prepared.root])

  useLayoutEffect(() => {
    prepared.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue
        mat.envMapIntensity = theme === 'day' ? 0.55 : 0.12
        mat.needsUpdate = true
      }
    })
  }, [prepared, theme])

  // Priority -1: update stone transform before OrbitingSpheres raycasts (priority 0).
  useFrame((state, delta) => {
    const node = group.current
    if (!node) return
    const dt = Math.min(delta, 0.05)

    if (gyroOrbit) gyroOrbit.tick(dt, reducedMotion)
    if (mouseOrbit) mouseOrbit.tick(dt, reducedMotion)

    const gyro = gyroOrbit?.sample
    const gyroLive = Boolean(
      orbitToolActive && gyro?.live && (gyroOrbit?.status === 'active' || gyroOrbit?.status === 'ready'),
    )
    const gyroEngage = gyroLive ? gyro!.engagement : 0

    // Keep last arcball orientation after exit so the stone doesn't snap; only drag is gated.
    const mouseOrbitReady = Boolean(
      mouseOrbit && (mouseOrbit.status === 'ready' || mouseOrbit.status === 'active'),
    )
    const mouseEngaged = Boolean(orbitToolActive && mouseOrbit?.engaged)
    const mouseEngage = orbitToolActive && mouseOrbit ? mouseOrbit.sample.engagement : 0
    const orbitEngage = Math.max(gyroEngage, mouseEngage)

    const motionScale = reducedMotion ? 0.28 : 1
    const idleDamp = mouseEngaged
      ? MOUSE_ORBIT.idleSpinScale
      : 1 - gyroEngage * (1 - STONE_MOTION.gyroIdleSpinScale)
    const idleSpin = STONE_MOTION.idleRotationSpeed * motionScale * idleDamp
    idleY.current += idleSpin * dt

    // Idle parallax only when mouse orbit mode is not dragging / coasting.
    const parallaxOn = pointer.current.enabled && !mouseEngaged
    const targetX = parallaxOn ? pointer.current.ny * STONE_MOTION.mouseRotateX : 0
    const targetY = parallaxOn ? pointer.current.nx * STONE_MOTION.mouseRotateY : 0
    const lerp = 1 - Math.exp(-STONE_MOTION.mouseLerp * dt)
    mouseX.current += (targetX - mouseX.current) * lerp
    mouseY.current += (targetY - mouseY.current) * lerp

    const gyroPitch = gyroLive ? gyro!.pitch : 0
    const gyroYaw = gyroLive ? gyro!.yaw : 0
    const gyroRoll = gyroLive ? gyro!.roll : 0

    node.position.y = stoneFloatY(state.clock.elapsedTime, reducedMotion)

    if (mouseOrbitReady && mouseOrbit) {
      const sway =
        Math.sin(state.clock.elapsedTime * 0.31) * STONE_MOTION.idleSway * motionScale * (1 - orbitEngage * 0.7)
      idleQuat.setFromAxisAngle(_yAxis, idleY.current)
      scratchEuler.set(mouseX.current + sway, mouseY.current, parallaxOn ? pointer.current.nx * STONE_MOTION.mouseRotateZ : 0)
      parallaxQuat.setFromEuler(scratchEuler)
      node.quaternion.copy(idleQuat).multiply(mouseOrbit.orientation).multiply(parallaxQuat)
    } else {
      node.rotation.x =
        mouseX.current +
        gyroPitch +
        Math.sin(state.clock.elapsedTime * 0.31) * STONE_MOTION.idleSway * motionScale
      node.rotation.y = idleY.current + mouseY.current + gyroYaw
      node.rotation.z = pointer.current.enabled
        ? pointer.current.nx * STONE_MOTION.mouseRotateZ
        : gyroRoll
    }
  }, -1)

  return (
    <group ref={group}>
      <group scale={prepared.scale}>
        <group position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}>
          <primitive object={prepared.root} />
        </group>
      </group>
    </group>
  )
}

const _yAxis = new THREE.Vector3(0, 1, 0)

useGLTF.preload(STONE_URL)
