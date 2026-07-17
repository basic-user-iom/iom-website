import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadCountryBorders, type CountryBordersHandle } from './countryBorders'
import type { Artist, ArtistCategory } from './types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from './types'

const GLOBE_RADIUS = 1.55
const EARTH_MAP = '/assets/artist-globe/earth-4k.jpg'

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

interface HoverState {
  artist: Artist
  x: number
  y: number
}

interface GlobeSceneProps {
  artists: Artist[]
  selectedId: string | null
  onSelect: (artistId: string | null) => void
  onOpenPortfolio: (artistId: string) => void
}

export function GlobeScene({ artists, selectedId, onSelect, onOpenPortfolio }: GlobeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const artistsRef = useRef(artists)
  const selectedRef = useRef(selectedId)
  const onSelectRef = useRef(onSelect)
  const onOpenPortfolioRef = useRef(onOpenPortfolio)
  const rebuildRef = useRef<(() => void) | null>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const hoverLockedRef = useRef(false)
  const clearHoverTimerRef = useRef(0)
  const setHoverRef = useRef(setHover)
  const resumeSpinRef = useRef<() => void>(() => {})
  setHoverRef.current = setHover

  artistsRef.current = artists
  selectedRef.current = selectedId
  onSelectRef.current = onSelect
  onOpenPortfolioRef.current = onOpenPortfolio

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (pointer: coarse), (max-width: 900px)').matches
    const sphereSegW = isMobile ? 64 : 96
    const sphereSegH = isMobile ? 48 : 72

    const readSize = () => {
      const w = Math.max(1, mount.clientWidth || 1)
      const h = Math.max(1, mount.clientHeight || 1)
      return { w, h }
    }

    let { w: width, h: height } = readSize()

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, width / Math.max(height, 1), 0.1, 100)
    camera.position.set(0, 0.12, 4.35)

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
    renderer.setSize(width, height, true)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    root.rotation.y = -0.55
    scene.add(root)

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.038, sphereSegW, sphereSegH),
      new THREE.MeshBasicMaterial({
        color: 0x7eb8d8,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
      }),
    )
    root.add(atmosphere)

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, sphereSegW, sphereSegH)
    const earthMat = new THREE.MeshBasicMaterial({
      color: 0x0a1520,
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
        texture.anisotropy = Math.min(isMobile ? 2 : 8, renderer.capabilities.getMaxAnisotropy())
        earthMat.map = texture
        earthMat.color = new THREE.Color(0xffffff)
        earthMat.needsUpdate = true
      },
      undefined,
      () => {
        /* solid fallback */
      },
    )

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.001, isMobile ? 32 : 48, isMobile ? 24 : 32),
      new THREE.MeshBasicMaterial({
        color: 0x8fa4bc,
        wireframe: true,
        transparent: true,
        opacity: 0.018,
      }),
    )
    root.add(wire)

    const markers = new THREE.Group()
    root.add(markers)
    const pinMeshes: THREE.Mesh[] = []
    const hitMeshes: THREE.Mesh[] = []

    let borders: CountryBordersHandle | null = null
    void loadCountryBorders(GLOBE_RADIUS * 1.0015)
      .then((handle) => {
        if (disposed) {
          handle.dispose()
          return
        }
        borders = handle
        root.add(handle.group)
        const selected = artistsRef.current.find((a) => a.id === selectedRef.current)
        handle.setHighlight(selected?.country ?? null)
      })
      .catch((err) => {
        console.warn('[artist-globe] country borders unavailable', err)
      })

    const highlightSelectedCountry = () => {
      const id = selectedRef.current
      if (!id) {
        borders?.setHighlight(null)
        return
      }
      const artist = artistsRef.current.find((a) => a.id === id)
      borders?.setHighlight(artist?.country ?? null)
    }

    const rebuildPins = () => {
      while (markers.children.length) {
        const child = markers.children[0]
        markers.remove(child)
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          ;(child.material as THREE.Material).dispose()
        } else if (child instanceof THREE.Line) {
          child.geometry.dispose()
          ;(child.material as THREE.Material).dispose()
        }
      }
      pinMeshes.length = 0
      hitMeshes.length = 0

      // GlobeKit / Onramper-inspired: quiet surface discs + thin rings (no neon stems)
      for (const artist of artistsRef.current) {
        const color = CATEGORY_COLORS[artist.category as ArtistCategory] ?? 0x00e5ff
        const selected = artist.id === selectedRef.current
        const pos = latLonToVec3(artist.lat, artist.lon, GLOBE_RADIUS * 1.006)
        const normal = pos.clone().normalize()

        const discR = selected ? 0.022 : 0.014
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(discR, 24),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: selected ? 1 : 0.92,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        )
        disc.position.copy(pos)
        disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
        disc.userData.artistId = artist.id
        markers.add(disc)
        pinMeshes.push(disc)

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(discR * 1.35, discR * (selected ? 2.15 : 1.85), 32),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: selected ? 0.55 : 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        )
        ring.position.copy(normal.clone().multiplyScalar(GLOBE_RADIUS * 1.0065))
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
        ring.userData.pulse = selected
        markers.add(ring)

        // Tip + stem in the same category color as the surface circle
        const tipHeight = selected ? GLOBE_RADIUS * 1.045 : GLOBE_RADIUS * 1.028
        const tipPos = normal.clone().multiplyScalar(tipHeight)
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(selected ? 0.009 : 0.006, 10, 10),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: selected ? 0.98 : 0.75,
          }),
        )
        tip.position.copy(tipPos)
        markers.add(tip)

        const stemGeo = new THREE.BufferGeometry().setFromPoints([pos.clone(), tipPos])
        const stem = new THREE.Line(
          stemGeo,
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: selected ? 0.85 : 0.45,
          }),
        )
        markers.add(stem)

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 12, 12),
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          }),
        )
        hit.position.copy(pos)
        hit.userData.artistId = artist.id
        markers.add(hit)
        hitMeshes.push(hit)
      }
      highlightSelectedCountry()
    }

    rebuildRef.current = rebuildPins
    rebuildPins()

    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 0.1 }
    const pointer = new THREE.Vector2()

    let pointerActive = false
    let moved = false
    let prevX = 0
    let prevY = 0
    let downX = 0
    let downY = 0
    let downArtistId: string | null = null
    /** Higher when starting on a pin so clicks don't become globe drags */
    let dragThreshold = 10
    const BASE_SPIN = 0.0006 // 2× slower than original 0.0012
    let autoSpin = BASE_SPIN
    let hoveringPin = false
    let raf = 0

    const pickArtistId = (clientX: number, clientY: number): string | null => {
      const rect = mount.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const targets = hitMeshes.length ? hitMeshes : pinMeshes
      const hits = raycaster.intersectObjects(targets, false)
      if (hits.length === 0) return null
      return String(hits[0].object.userData.artistId || '') || null
    }

    const resumeSpinIfIdle = () => {
      if (pointerActive || hoveringPin || hoverLockedRef.current || selectedRef.current) {
        autoSpin = 0
        return
      }
      autoSpin = BASE_SPIN
    }
    resumeSpinRef.current = () => {
      hoveringPin = false
      resumeSpinIfIdle()
    }

    const scheduleClearHover = () => {
      window.clearTimeout(clearHoverTimerRef.current)
      clearHoverTimerRef.current = window.setTimeout(() => {
        if (!hoverLockedRef.current) {
          setHoverRef.current(null)
          hoveringPin = false
          resumeSpinIfIdle()
        }
      }, 180)
    }

    const cancelClearHover = () => {
      window.clearTimeout(clearHoverTimerRef.current)
    }

    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (pointer: coarse)').matches

    const updateHover = (clientX: number, clientY: number) => {
      if (pointerActive || hoverLockedRef.current) return
      // Touch / coarse pointers: skip hover cards — tap opens the slide panel
      if (coarsePointer) {
        const id = pickArtistId(clientX, clientY)
        hoveringPin = Boolean(id)
        mount.style.cursor = id ? 'pointer' : 'grab'
        if (!id) resumeSpinIfIdle()
        else autoSpin = 0
        return
      }
      const id = pickArtistId(clientX, clientY)
      const rect = mount.getBoundingClientRect()
      if (!id) {
        hoveringPin = false
        scheduleClearHover()
        mount.style.cursor = 'grab'
        resumeSpinIfIdle()
        return
      }
      cancelClearHover()
      const artist = artistsRef.current.find((a) => a.id === id)
      if (!artist) {
        hoveringPin = false
        scheduleClearHover()
        resumeSpinIfIdle()
        return
      }
      hoveringPin = true
      autoSpin = 0
      mount.style.cursor = 'pointer'
      setHoverRef.current({
        artist,
        x: clientX - rect.left,
        y: clientY - rect.top,
      })
    }

    const onPointerDown = (e: PointerEvent) => {
      // Only primary button / touch
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerActive = true
      moved = false
      downX = prevX = e.clientX
      downY = prevY = e.clientY
      downArtistId = pickArtistId(e.clientX, e.clientY)
      // Pin presses need a larger move before we treat them as globe drag
      dragThreshold = downArtistId ? (coarsePointer ? 28 : 22) : coarsePointer ? 14 : 10
      autoSpin = 0
      setHoverRef.current(null)
      hoveringPin = Boolean(downArtistId)
      mount.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerActive) return
      const travel = Math.hypot(e.clientX - downX, e.clientY - downY)
      const wasClick = !moved && travel < dragThreshold
      const pinId = downArtistId
      pointerActive = false
      try {
        mount.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      // Prefer pin click even if a few pixels of jitter happened
      if (pinId && travel < dragThreshold) {
        autoSpin = 0
        onSelectRef.current(pinId)
        setHoverRef.current(null)
        hoveringPin = false
        downArtistId = null
        moved = false
        return
      }

      if (wasClick) {
        const id = pickArtistId(e.clientX, e.clientY)
        if (id) {
          autoSpin = 0
          onSelectRef.current(id)
          setHoverRef.current(null)
          hoveringPin = false
          downArtistId = null
          return
        }
      }

      downArtistId = null
      updateHover(e.clientX, e.clientY)
      resumeSpinIfIdle()
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pointerActive) {
        const totalDx = e.clientX - downX
        const totalDy = e.clientY - downY
        const travel = Math.hypot(totalDx, totalDy)

        // While pressing a pin, do not rotate until clearly dragging away
        if (downArtistId && travel < dragThreshold) {
          return
        }

        if (!moved && travel >= dragThreshold) {
          moved = true
          downArtistId = null
          hoveringPin = false
        }

        if (moved) {
          const dx = e.clientX - prevX
          const dy = e.clientY - prevY
          prevX = e.clientX
          prevY = e.clientY
          root.rotation.y += dx * 0.005
          root.rotation.x = Math.max(-0.75, Math.min(0.75, root.rotation.x + dy * 0.004))
        }
        return
      }
      updateHover(e.clientX, e.clientY)
    }

    const onPointerLeave = () => {
      scheduleClearHover()
      mount.style.cursor = 'grab'
    }

    const onPointerCancel = (e: PointerEvent) => {
      pointerActive = false
      downArtistId = null
      moved = false
      try {
        mount.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      resumeSpinIfIdle()
    }

    mount.addEventListener('pointerdown', onPointerDown)
    mount.addEventListener('pointerup', onPointerUp)
    mount.addEventListener('pointercancel', onPointerCancel)
    mount.addEventListener('pointermove', onPointerMove)
    mount.addEventListener('pointerleave', onPointerLeave)

    const onResize = () => {
      const { w, h } = readSize()
      if (w < 2 || h < 2) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, true)
    }
    window.addEventListener('resize', onResize)
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null
    resizeObserver?.observe(mount)
    // Embed iframes often mount at 0×0 then gain size after CSS height chain settles
    requestAnimationFrame(() => onResize())
    window.setTimeout(onResize, 120)

    const tick = (t: number) => {
      // Pause idle spin while pressing, hovering a pin, popup locked, or panel open
      if (!pointerActive && !hoveringPin && !hoverLockedRef.current && !selectedRef.current) {
        if (autoSpin === 0) autoSpin = BASE_SPIN
        root.rotation.y += autoSpin
      } else {
        autoSpin = 0
      }

      for (const child of markers.children) {
        if (child.userData.pulse) {
          const s = 1 + Math.sin(t * 0.0045) * 0.18
          child.scale.setScalar(s)
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
          if ('opacity' in mat) {
            mat.opacity = 0.2 + (Math.sin(t * 0.0045) * 0.5 + 0.5) * 0.28
          }
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      rebuildRef.current = null
      window.clearTimeout(clearHoverTimerRef.current)
      borders?.dispose()
      borders = null
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      resizeObserver?.disconnect()
      mount.removeEventListener('pointerdown', onPointerDown)
      mount.removeEventListener('pointerup', onPointerUp)
      mount.removeEventListener('pointercancel', onPointerCancel)
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerleave', onPointerLeave)
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
  }, [])

  useEffect(() => {
    rebuildRef.current?.()
    if (!selectedId) {
      resumeSpinRef.current()
    }
  }, [artists, selectedId])

  const popStyle =
    hover != null
      ? {
          left: Math.min(hover.x + 14, (mountRef.current?.clientWidth ?? 400) - 240),
          top: Math.min(hover.y + 14, (mountRef.current?.clientHeight ?? 400) - 160),
        }
      : undefined

  return (
    <div className="ag-globe">
      <div className="ag-globe-canvas" ref={mountRef} />
      {hover ? (
        <div
          className="ag-marker-pop"
          style={popStyle}
          onPointerEnter={() => {
            hoverLockedRef.current = true
            window.clearTimeout(clearHoverTimerRef.current)
          }}
          onPointerLeave={() => {
            hoverLockedRef.current = false
            window.clearTimeout(clearHoverTimerRef.current)
            clearHoverTimerRef.current = window.setTimeout(() => {
              setHover(null)
              resumeSpinRef.current()
            }, 120)
          }}
        >
          <p className="ag-marker-pop-cat">{CATEGORY_LABELS[hover.artist.category]}</p>
          <strong className="ag-marker-pop-name">{hover.artist.displayName}</strong>
          <p className="ag-marker-pop-loc">
            {hover.artist.city}
            {hover.artist.country ? `, ${hover.artist.country}` : ''}
          </p>
          <div className="ag-marker-pop-contact">
            {hover.artist.email ? (
              <a href={`mailto:${hover.artist.email}`}>{hover.artist.email}</a>
            ) : null}
            {hover.artist.links.website ? (
              <a href={hover.artist.links.website} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {hover.artist.links.instagram ? (
              <a href={hover.artist.links.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            ) : null}
            {!hover.artist.email && !hover.artist.links.website && !hover.artist.links.instagram ? (
              <span className="ag-muted">No contact listed</span>
            ) : null}
          </div>
          <button
            type="button"
            className="ag-btn ag-btn-primary ag-marker-pop-btn"
            onClick={() => {
              onSelect(hover.artist.id)
              onOpenPortfolio(hover.artist.id)
              setHover(null)
              hoverLockedRef.current = false
            }}
          >
            Open portfolio
          </button>
        </div>
      ) : null}
      <div className="ag-globe-hud">
        <span>
          {artists.length} artist{artists.length === 1 ? '' : 's'}
        </span>
        <span className="ag-globe-hud-sep">·</span>
        <span className="ag-hud-hint ag-hud-hint-desktop">Hover a pin · click for details · drag to rotate</span>
        <span className="ag-hud-hint ag-hud-hint-touch">Tap a pin · drag to rotate</span>
      </div>
    </div>
  )
}
