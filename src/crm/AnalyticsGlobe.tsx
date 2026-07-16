import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { AnalyticsGeoPoint } from '../analytics/types'

interface AnalyticsGlobeProps {
  points: AnalyticsGeoPoint[]
  liveVisitors: number
}

const ACCENT = 0x00e5ff
const GLOBE_RADIUS = 1.6

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export function AnalyticsGlobe({ points, liveVisitors }: AnalyticsGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 480
    const height = mount.clientHeight || 320

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0.35, 5.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)

    // Atmosphere glow shell
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 48, 48),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
      }),
    )
    root.add(atmosphere)

    // Wireframe earth
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 36, 28),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      }),
    )
    root.add(wire)

    // Soft filled sphere for depth
    const fill = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 0.995, 48, 36),
      new THREE.MeshBasicMaterial({
        color: 0x061018,
        transparent: true,
        opacity: 0.92,
      }),
    )
    root.add(fill)

    // Equator / meridian hints
    const ringMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22 })
    for (const [rx, ry, rz] of [
      [Math.PI / 2, 0, 0],
      [0, 0, Math.PI / 2],
      [0, 0, 0],
    ] as const) {
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 96 }, (_, i) => {
            const a = (i / 96) * Math.PI * 2
            return new THREE.Vector3(
              Math.cos(a) * GLOBE_RADIUS * 1.002,
              Math.sin(a) * GLOBE_RADIUS * 1.002,
              0,
            )
          }),
        ),
        ringMat,
      )
      ring.rotation.set(rx, ry, rz)
      root.add(ring)
    }

    const markers = new THREE.Group()
    root.add(markers)

    const maxVisitors = Math.max(...points.map((p) => p.visitors), 1)

    for (const point of points) {
      const pos = latLonToVec3(point.lat, point.lon, GLOBE_RADIUS * 1.01)
      const size = 0.025 + (point.visitors / maxVisitors) * 0.055
      const color = point.live ? 0xffffff : ACCENT

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: point.live ? 1 : 0.85 }),
      )
      dot.position.copy(pos)
      markers.add(dot)

      if (point.live) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(size * 2.4, 12, 12),
          new THREE.MeshBasicMaterial({
            color: ACCENT,
            transparent: true,
            opacity: 0.28,
          }),
        )
        halo.position.copy(pos)
        halo.userData.pulse = true
        halo.userData.baseScale = 1
        markers.add(halo)
      }
    }

    let dragging = false
    let prevX = 0
    let autoSpin = 0.0018
    let raf = 0

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      prevX = e.clientX
      autoSpin = 0
      mount.setPointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      autoSpin = 0.0012
      try {
        mount.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - prevX
      prevX = e.clientX
      root.rotation.y += dx * 0.005
    }

    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointerup', onPointerUp)
    mount.addEventListener('pointercancel', onPointerUp)
    mount.addEventListener('pointermove', onPointerMove)

    const onResize = () => {
      const w = mount.clientWidth || 480
      const h = mount.clientHeight || 320
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const tick = (t: number) => {
      root.rotation.y += autoSpin
      for (const child of markers.children) {
        if (child.userData.pulse) {
          const s = 1 + Math.sin(t * 0.004) * 0.35
          child.scale.setScalar(s)
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
          mat.opacity = 0.18 + (Math.sin(t * 0.004) * 0.5 + 0.5) * 0.22
        }
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointerup', onPointerUp)
      mount.removeEventListener('pointercancel', onPointerUp)
      mount.removeEventListener('pointermove', onPointerMove)
      renderer.dispose()
      wire.geometry.dispose()
      ;(wire.material as THREE.Material).dispose()
      fill.geometry.dispose()
      ;(fill.material as THREE.Material).dispose()
      atmosphere.geometry.dispose()
      ;(atmosphere.material as THREE.Material).dispose()
      markers.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          ;(obj.material as THREE.Material).dispose()
        }
      })
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [points])

  return (
    <div className="crm-seo-globe">
      <div className="crm-seo-globe-canvas" ref={mountRef} />
      <div className="crm-seo-globe-hud">
        <span className="crm-seo-globe-live">
          <span className="crm-seo-globe-pulse" aria-hidden="true" />
          {liveVisitors} live
        </span>
        <span className="crm-seo-globe-hint">Drag to rotate · last 30 min = live</span>
      </div>
    </div>
  )
}
