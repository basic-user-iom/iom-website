import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Spherical, Vector3 } from 'three'
import { easeInOutCubic, focusFromHotspot, resolveViewPose } from '../../utils/camera.js'
import { setLiveCameraPose } from '../../utils/liveCameraPose.js'
import { useViewer } from '../../hooks/useViewer.js'

export function CameraController({ controlsRef }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const rig = useViewer((state) => state.rig)
  const view = useViewer((state) => state.view)
  const hotspot = useViewer((state) => state.hotspot)
  const reducedMotion = useViewer((state) => state.reducedMotion)
  const introDone = useViewer((state) => state.introDone)
  const setIntroDone = useViewer((state) => state.setIntroDone)
  const cameraEdit = useViewer((state) => state.cameraEdit)
  const cameraOverrides = useViewer((state) => state.cameraOverrides)

  const toPos = useRef(new Vector3())
  const fromTarget = useRef(new Vector3())
  const toTarget = useRef(new Vector3())
  const fromOrbit = useRef(new Spherical())
  const toOrbit = useRef(new Spherical())
  const orbit = useRef(new Spherical())
  const orbitOffset = useRef(new Vector3())
  const thetaDelta = useRef(0)
  const progress = useRef(1)
  const duration = useRef(1.2)
  const introStarted = useRef(false)
  const requestId = useRef(0)

  const animateTo = (dest, seconds) => {
    const controls = controlsRef.current
    if (!controls || !dest) return
    fromTarget.current.copy(controls.target)
    toPos.current.fromArray(dest.position)
    toTarget.current.fromArray(dest.target)
    fromOrbit.current.setFromVector3(
      orbitOffset.current.copy(camera.position).sub(controls.target),
    )
    toOrbit.current.setFromVector3(
      orbitOffset.current.copy(toPos.current).sub(toTarget.current),
    )
    thetaDelta.current = Math.atan2(
      Math.sin(toOrbit.current.theta - fromOrbit.current.theta),
      Math.cos(toOrbit.current.theta - fromOrbit.current.theta),
    )
    progress.current = 0
    duration.current = Math.max(0.04, seconds)
    requestId.current += 1
  }

  useEffect(() => {
    if (!rig) return
    const dest = hotspot
      ? focusFromHotspot(hotspot, rig)
      : resolveViewPose(rig, view, cameraOverrides)
    if (!introStarted.current) return
    const editing = useViewer.getState().cameraEdit
    animateTo(dest, reducedMotion || editing ? 0.05 : 1.15)
  }, [cameraOverrides, hotspot, reducedMotion, rig, view])

  useFrame((_, dt) => {
    const controls = controlsRef.current
    if (!controls || !rig) return

    if (!introStarted.current) {
      introStarted.current = true
      const start = reducedMotion ? resolveViewPose(rig, 'hero', cameraOverrides) : rig.views.intro
      camera.position.fromArray(start.position)
      controls.target.fromArray(start.target)
      controls.update()
      animateTo(resolveViewPose(rig, 'hero', cameraOverrides), reducedMotion ? 0.05 : 2.1)
    }

    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + dt / duration.current)
      const k = easeInOutCubic(progress.current)
      controls.target.lerpVectors(fromTarget.current, toTarget.current, k)
      orbit.current.set(
        MathUtils.lerp(fromOrbit.current.radius, toOrbit.current.radius, k),
        MathUtils.lerp(fromOrbit.current.phi, toOrbit.current.phi, k),
        fromOrbit.current.theta + thetaDelta.current * k,
      )
      camera.position.setFromSpherical(orbit.current).add(controls.target)
      controls.update()
      if (progress.current >= 1 && !introDone) setIntroDone(true)
    }

    const portrait = size.width / size.height < 0.9
    const nextFov = portrait ? 36 : 31
    if (Math.abs(camera.fov - nextFov) > 0.1) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
    if (!cameraEdit && camera.position.y < rig.floorY + 0.05) {
      camera.position.y = rig.floorY + 0.05
    }

    setLiveCameraPose({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    })
  })

  return null
}
