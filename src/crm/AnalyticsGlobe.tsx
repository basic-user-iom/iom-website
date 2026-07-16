import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { AnalyticsGeoPoint } from '../analytics/types'

interface AnalyticsGlobeProps {
  points: AnalyticsGeoPoint[]
  liveVisitors: number
}

const ACCENT = 0x00e5ff
const GLOBE_RADIUS = 1.65
const EARTH_MAP = '/assets/seo/earth-map.jpg'

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

    let disposed = false
    const width = mount.clientWidth || 480
    const height = mount.clientHeight || 320

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0.2, 4.85)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    // Offset so Europe/Africa face camera initially (texture origin is Pacific-centered)
    root.rotation.y = -0.4
    scene.add(root)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 64, 64),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      }),
    )
    root.add(atmosphere)

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48)
    const earthMat = new THREE.MeshBasicMaterial({
      color: 0x0a1a22,
      transparent: true,
      opacity: 1,
    })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    root.add(earth)

    const loader = new THREE.TextureLoader()
    loader.load(
      EARTH_MAP,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        earthMat.map = texture
        earthMat.color = new THREE.Color(0xffffff)
        earthMat.needsUpdate = true
      },
      undefined,
      () => {
        /* keep solid fallback */
      },
    )

    // Subtle cyan grid overlay so it still feels like IOM
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.003, 28, 20),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        wireframe: true,
        transparent: true,
        opacity: 0.07,
      }),
    )
    root.add(wire)

    const markers = new THREE.Group()
    root.add(markers)

    const maxVisitors = Math.max(...points.map((p) => p.visitors), 1)

    for (const point of points) {
      const pos = latLonToVec3(point.lat, point.lon, GLOBE_RADIUS * 1.02)
      const size = 0.045 + (point.visitors / maxVisitors) * 0.09

      // Beam from surface for visibility
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.02, size * 4.5, 8),
        new THREE.MeshBasicMaterial({
          color: point.live ? 0xffffff : ACCENT,
          transparent: true,
          opacity: point.live ? 0.9 : 0.65,
        }),
      )
      beam.position.copy(pos.clone().multiplyScalar(1.02))
      beam.lookAt(new THREE.Vector3(0, 0, 0))
      beam.rotateX(Math.PI / 2)
      markers.add(beam)

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 14, 14),
        new THREE.MeshBasicMaterial({
          color: point.live ? 0xffffff : ACCENT,
          transparent: true,
          opacity: 1,
        }),
      )
      dot.position.copy(pos)
      markers.add(dot)

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(size * (point.live ? 2.8 : 2.1), 14, 14),
        new THREE.MeshBasicMaterial({
          color: ACCENT,
          transparent: true,
          opacity: point.live ? 0.35 : 0.18,
        }),
      )
      halo.position.copy(pos)
      halo.userData.pulse = point.live
      markers.add(halo)
    }

    let dragging = false
    let prevX = 0
    let prevY = 0
    let autoSpin = 0.0015
    let raf = 0

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      prevX = e.clientX
      prevY = e.clientY
      autoSpin = 0
      mount.setPointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      autoSpin = 0.001
      try {
        mount.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - prevX
      const dy = e.clientY - prevY
      prevX = e.clientX
      prevY = e.clientY
      root.rotation.y += dx * 0.005
      root.rotation.x = Math.max(-0.7, Math.min(0.7, root.rotation.x + dy * 0.004))
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
          const s = 1 + Math.sin(t * 0.0045) * 0.45
          child.scale.setScalar(s)
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
          mat.opacity = 0.2 + (Math.sin(t * 0.0045) * 0.5 + 0.5) * 0.35
        }
      }
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointerup', onPointerUp)
      mount.removeEventListener('pointercancel', onPointerUp)
      mount.removeEventListener('pointermove', onPointerMove)
      renderer.dispose()
      earthGeo.dispose()
      earthMat.map?.dispose()
      earthMat.dispose()
      wire.geometry.dispose()
      ;(wire.material as THREE.Material).dispose()
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
      {points.length === 0 && (
        <div className="crm-seo-globe-empty" role="status">
          <strong>No mapped locations yet</strong>
          <span>
            Run the geo SQL migration, then visit the public site — new pageviews get country/city
            pins. Demo mode shows sample cities.
          </span>
        </div>
      )}
      <div className="crm-seo-globe-hud">
        <span className="crm-seo-globe-live">
          <span className="crm-seo-globe-pulse" aria-hidden="true" />
          {liveVisitors} live
        </span>
        <span className="crm-seo-globe-hint">
          {points.length} location{points.length === 1 ? '' : 's'} · drag to rotate
        </span>
      </div>
    </div>
  )
}
