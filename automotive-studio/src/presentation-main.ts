import './ui/styles.css'
import { Vector3 } from 'three'
import { ProjectStore, patchVehicleLights } from './persistence/projectStore'
import { createEmptyProject, createDefaultFreeDrive } from './persistence/schema'
import type { Shot, VehicleLightGroupId } from './persistence/schema'
import { idbListProjectSummaries, idbLoadProject } from './persistence/localDb'
import { readLastProjectId, resolveBootProjectId, writeLastProjectId } from './persistence/projectSession'
import {
  BUNDLED_DEFAULT_PROJECT_ID,
  ensureBundledDefaultProject,
} from './persistence/bundledDefault'
import { migrateProject } from './persistence/migrations'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { mountPresentationShell } from './presentation/presentationShell'
import { VehicleSession } from './vehicle/vehicleSession'
import { RouteSession } from './route/routeSession'
import { FreeDriveSession } from './route/freeDriveSession'
import {
  ChaseCamera,
  deriveChaseOrbitFromWorld,
  type ChaseOrbitPreset,
  type ChaseOrbitState,
} from './route/chaseCamera'
import { HotspotSession } from './hotspots/hotspotSession'
import { mountHotspotCard, runHotspotAction, runHotspotActions } from './hotspots/hotspotCard'
import { resolveSemanticNode } from './hotspots/resolveAnchor'
import { speedKmhToMetresPerSecond } from './route/routeMath'

/**
 * Presentation entry — curated client shell only.
 * Do not import Studio authoring UI modules here.
 */

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')

const project = createEmptyProject('Client Presentation')
project.presentation.accessPolicy = 'unlisted'
project.presentation.defaultMode = 'guided'

const store = new ProjectStore(project)
const transport = new Transport()
transport.setDuration(10)
transport.setOwnership({ camera: 'shot-sequence' })

const vehicleSession = new VehicleSession()
const routeSession = new RouteSession()
const freeDriveSession = new FreeDriveSession()
const chaseCamera = new ChaseCamera()
const hotspotSession = new HotspotSession()
const driveKeys = new Set<string>()

let muted = false
let studioRenderer: Awaited<ReturnType<typeof createStudioRenderer>> | null = null
let useShotTour = false
let freeDriveActive = false
let lastRouteVelocityKmh = 0
let lastTourShotId: string | null = null

const shell = mountPresentationShell(root, {
  onPlayPause: () => {
    if (freeDriveActive) {
      setFreeDrive(false)
      return
    }
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  },
  onMuteToggle: () => {
    muted = !muted
    shell.setStatus(muted ? 'Muted' : 'Sound on (no media in Phase 1)')
    const btn = root.querySelector('[data-action="mute"]')
    if (btn) btn.textContent = muted ? 'Unmute' : 'Mute'
  },
  onFullscreen: async () => {
    try {
      if (!document.fullscreenElement) await root.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      shell.setStatus('Fullscreen unavailable')
    }
  },
  onExit: () => {
    location.assign(studioUrl())
  },
  onInfo: () => {
    const credits = store
      .getSnapshot()
      .project.credits.map((c) => c.label)
      .join(' · ')
    shell.setStatus(credits || 'IOM Automotive Presentation')
  },
  onFreeDriveToggle: () => {
    setFreeDrive(!freeDriveActive)
  },
  onGoToShot: (shotId) => {
    const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId)
    if (!shot) return
    applyShot(shot)
    shell.setStatus(`View · ${shot.name}`)
  },
  onChasePreset: (preset) => {
    enterChaseView(preset)
  },
  onOrbitToggle: () => {
    if (!studioRenderer) return
    if (freeDriveActive) setFreeDrive(false)
    useShotTour = false
    transport.pause()
    const next = !studioRenderer.isOrbitEnabled()
    chaseCamera.setEnabled(false)
    studioRenderer.setOrbitEnabled(next)
    shell.setOrbitActive(next)
    shell.setStatus(next ? 'Orbit camera — drag to look around' : 'Orbit off')
  },
})

store.subscribe((snap) => {
  shell.updateStore(snap)
  vehicleSession.getLights().apply(snap.project.vehicleLights)
  studioRenderer?.applyBloom(snap.project.vehicleLights)
})
transport.subscribe((snap) => shell.updateTransport(snap))
shell.updateStore(store.getSnapshot())
shell.updateTransport(transport.getSnapshot())

function studioUrl() {
  const studio = new URL('index.html', location.href)
  const params = new URLSearchParams(location.search)
  const projectId = params.get('project') || store.getSnapshot().project.id
  if (projectId) studio.searchParams.set('project', projectId)
  if (params.get('forceWebGL2') === '1') {
    studio.searchParams.set('forceWebGL2', '1')
  }
  return studio
}

function syncDriveInput() {
  const throttle =
    driveKeys.has('KeyW') || driveKeys.has('ArrowUp')
      ? 1
      : driveKeys.has('KeyS') || driveKeys.has('ArrowDown')
        ? -1
        : 0
  const steer =
    driveKeys.has('KeyD') || driveKeys.has('ArrowRight')
      ? 1
      : driveKeys.has('KeyA') || driveKeys.has('ArrowLeft')
        ? -1
        : 0
  freeDriveSession.setInput({ throttle, steer })
}

function setFreeDrive(enabled: boolean) {
  if (!studioRenderer) return
  if (enabled && !vehicleSession.getPlacementRoot()) {
    shell.setStatus('Import a vehicle in Studio before free drive.')
    return
  }
  freeDriveActive = enabled
  shell.setFreeDriveActive(enabled)
  if (enabled) {
    useShotTour = false
    transport.pause()
    routeSession.clearRoute()
    freeDriveSession.setVehicle(
      vehicleSession.getPlacementRoot(),
      vehicleSession.getRig(),
      vehicleSession.getActionRoot(),
    )
    const fd = {
      ...createDefaultFreeDrive(),
      ...store.getSnapshot().project.freeDrive,
      enabled: true,
      chaseCamera: true,
    }
    freeDriveSession.applyState(fd)
    freeDriveSession.setHeadingFlip(Boolean(fd.headingFlip))
    freeDriveSession.setEnabled(true)
    freeDriveSession.resetToOrigin()
    studioRenderer.setInfiniteFloor(true)
    studioRenderer.setOrbitEnabled(false)
    chaseCamera.setEnabled(true)
    shell.setOrbitActive(false)
    driveKeys.clear()
    syncDriveInput()
    shell.setStatus('Free drive — WASD · Space stop · chase views above')
  } else {
    freeDriveSession.setEnabled(false)
    studioRenderer.setInfiniteFloor(false)
    driveKeys.clear()
    syncDriveInput()
    vehicleSession.getLights().setRouteSignals({
      running: false,
      braking: false,
      reverse: false,
      indicatorLeft: false,
      indicatorRight: false,
    })
    // Restore authored route if present.
    const proj = store.getSnapshot().project
    if (proj.route) {
      routeSession.setRoute(proj.route, { resetProgress: true })
      routeSession.setGuideVisible(false)
      chaseCamera.setEnabled(Boolean(proj.route.chaseCamera))
      studioRenderer.setOrbitEnabled(!proj.route.chaseCamera)
      shell.setOrbitActive(!proj.route.chaseCamera)
    } else {
      chaseCamera.setEnabled(false)
      studioRenderer.setOrbitEnabled(true)
      shell.setOrbitActive(true)
    }
    shell.setStatus('Free drive off')
  }
}

function currentVisualHeadingYaw(): number {
  if (freeDriveActive) return freeDriveSession.getVisualHeadingYaw() ?? 0
  return routeSession.getVisualHeadingYaw() ?? vehicleSession.getPlacementRoot()?.rotation.y ?? 0
}

function resolveShotChaseOrbit(shot: Shot): ChaseOrbitState | null {
  if (!vehicleSession.getPlacementRoot()) return null
  if (shot.chaseOrbit) return { ...shot.chaseOrbit }
  if (shot.cameraPosition && shot.cameraTarget) {
    return deriveChaseOrbitFromWorld(
      currentVisualHeadingYaw(),
      shot.cameraPosition,
      shot.cameraTarget,
    )
  }
  return null
}

function playShotAnimation(shot: Shot) {
  if (!shot.playActionId) return
  vehicleSession.playSemanticAction(shot.playActionId, {
    startSeconds: shot.playActionStartSeconds,
    endSeconds: shot.playActionEndSeconds,
    forcePlay: true,
  })
}

function applyShot(shot: Shot) {
  if (!studioRenderer) return
  useShotTour = false
  transport.pause()
  const duration = Math.max(0.25, shot.transitionSeconds || 1)
  const orbit = resolveShotChaseOrbit(shot)

  // Keep free drive; lock framing to the car with a smooth orbit blend.
  if (orbit) {
    studioRenderer.setOrbitEnabled(false)
    shell.setOrbitActive(false)
    chaseCamera.setEnabled(true)
    chaseCamera.transitionToOrbit(orbit, duration)
    if (shot.fov != null) {
      studioRenderer.camera.fov = shot.fov
      studioRenderer.camera.updateProjectionMatrix()
    }
    playShotAnimation(shot)
    return
  }

  if (!shot.cameraPosition) return
  if (freeDriveActive) setFreeDrive(false)
  chaseCamera.setEnabled(false)
  studioRenderer.setOrbitEnabled(false)
  shell.setOrbitActive(false)
  studioRenderer.camera.position.fromArray(shot.cameraPosition)
  if (shot.cameraTarget) studioRenderer.controls.target.fromArray(shot.cameraTarget)
  if (shot.fov != null) {
    studioRenderer.camera.fov = shot.fov
    studioRenderer.camera.updateProjectionMatrix()
  }
  studioRenderer.camera.lookAt(studioRenderer.controls.target)
  studioRenderer.controls.update()
  playShotAnimation(shot)
}

function enterChaseView(preset: ChaseOrbitPreset) {
  if (!studioRenderer) return
  useShotTour = false
  transport.pause()
  studioRenderer.setOrbitEnabled(false)
  shell.setOrbitActive(false)
  chaseCamera.setEnabled(true)
  chaseCamera.applyPreset(preset)
  shell.setStatus(`Chase · ${preset.replace(/-/g, ' ')}`)
}

function hotspotActionHandlers() {
  return {
    playSemanticAction: (id: string, opts?: { startSeconds?: number; endSeconds?: number }) =>
      vehicleSession.playSemanticAction(id, opts),
    goToShot: (shotId: string) => {
      const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId)
      if (shot) applyShot(shot)
    },
    setVehicleLight: (groupId: string, on: boolean) => {
      store.dispatch(
        patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }),
      )
    },
    toggleVehicleLight: (groupId: string) => {
      const cur =
        store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
      store.dispatch(
        patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: !cur } }),
      )
    },
    playVehicleLightSequence: (sequenceId: string) => {
      vehicleSession.getLights().playSequence(sequenceId as 'welcome' | 'farewell')
    },
    setMeshVisible: (node: { name?: string; path?: string; iomId?: string }, visible: boolean) => {
      const root = vehicleSession.getPlacementRoot()
      if (!root) return false
      const obj = resolveSemanticNode(root, node)
      if (!obj) return false
      obj.visible = visible
      return true
    },
    toggleMeshVisible: (node: { name?: string; path?: string; iomId?: string }) => {
      const root = vehicleSession.getPlacementRoot()
      if (!root) return false
      const obj = resolveSemanticNode(root, node)
      if (!obj) return false
      obj.visible = !obj.visible
      return true
    },
  }
}

window.addEventListener('keydown', (e) => {
  if (freeDriveActive) {
    if (
      e.code === 'KeyW' ||
      e.code === 'KeyA' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault()
      driveKeys.add(e.code)
      syncDriveInput()
      return
    }
    if (e.code === 'Space') {
      e.preventDefault()
      driveKeys.clear()
      syncDriveInput()
      return
    }
  }

  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  } else if (e.key === 'Escape') {
    location.assign(studioUrl())
  }
})
window.addEventListener('keyup', (e) => {
  if (!freeDriveActive) return
  driveKeys.delete(e.code)
  syncDriveInput()
})
window.addEventListener('blur', () => {
  driveKeys.clear()
  syncDriveInput()
})

async function boot() {
  await ensureBundledDefaultProject()
  const requestedId = new URLSearchParams(location.search).get('project')
  const summaries = await idbListProjectSummaries()
  const projectId = resolveBootProjectId({
    queryProjectId: requestedId,
    lastProjectId: readLastProjectId(),
    summaries,
    bundledDefaultProjectId: BUNDLED_DEFAULT_PROJECT_ID,
  })
  if (projectId) {
    const saved = await idbLoadProject(projectId)
    if (saved) {
      store.loadProject(migrateProject(saved))
      writeLastProjectId(projectId)
    }
  } else {
    const fallback = await idbLoadProject(BUNDLED_DEFAULT_PROJECT_ID)
    if (fallback) {
      store.loadProject(migrateProject(fallback))
      writeLastProjectId(BUNDLED_DEFAULT_PROJECT_ID)
    }
  }

  const renderer = await createStudioRenderer(shell.viewportHost)
  studioRenderer = renderer
  shell.setRendererInfo(renderer)
  vehicleSession.bindScene(renderer.scene, renderer.camera, renderer.renderer, renderer.controls)
  routeSession.bind(renderer.scene, (metres) => renderer.setFloorSize(metres))
  chaseCamera.bind(renderer.camera, renderer.controls, renderer.canvas)
  hotspotSession.bind(renderer.scene, null, renderer.camera, renderer.canvas)

  const hotspotCard = mountHotspotCard(shell.viewportHost, {
    onRunAction: (action) => {
      runHotspotAction(action, hotspotActionHandlers())
    },
    resolveActionLabel: (action) => {
      if (action.type !== 'action.play' && action.type !== 'action.toggle') return null
      return (
        vehicleSession.getSemanticActions().find((a) => a.id === action.actionId)?.label ?? null
      )
    },
  })
  hotspotSession.setOnSelect((hotspot) => {
    if (!hotspot) {
      hotspotCard.close()
      return
    }
    runHotspotActions(hotspot, (action) => {
      runHotspotAction(action, hotspotActionHandlers())
    })
    void hotspotCard.show(hotspot)
  })

  const loadedProject = store.getSnapshot().project
  renderer.applyEnvironmentState(loadedProject.environment)
  renderer.applyStageState(loadedProject.stage)
  renderer.applyAccentLights(loadedProject.accentLights)
  renderer.applyBloom(loadedProject.vehicleLights)

  shell.setStatus('Restoring vehicle…')
  let vehicleOk = false
  try {
    const restored = await vehicleSession.restoreFromProject(loadedProject, (_r, label) => {
      shell.setStatus(label)
    })
    vehicleOk = Boolean(restored)
    if (restored) {
      routeSession.setVehicle(
        vehicleSession.getPlacementRoot(),
        vehicleSession.getRig(),
        vehicleSession.getActionRoot(),
      )
      freeDriveSession.setVehicle(
        vehicleSession.getPlacementRoot(),
        vehicleSession.getRig(),
        vehicleSession.getActionRoot(),
      )
      hotspotSession.setVehiclePlacement(vehicleSession.getPlacementRoot())
      vehicleSession.getLights().apply(loadedProject.vehicleLights)
      studioRenderer?.applyBloom(loadedProject.vehicleLights)
    }
  } catch (err) {
    shell.setStatus(
      `Vehicle restore failed: ${err instanceof Error ? err.message : String(err)}. Re-import in Studio.`,
    )
  }

  hotspotSession.syncFromProject(loadedProject.hotspots)

  if (loadedProject.route) {
    routeSession.setRoute(loadedProject.route, { resetProgress: true })
    routeSession.setGuideVisible(false)
    chaseCamera.setOrbit(
      {
        yawDeg: loadedProject.route.chaseOrbitYawDeg ?? chaseCamera.orbitYawDeg,
        pitchDeg: loadedProject.route.chaseOrbitPitchDeg ?? chaseCamera.orbitPitchDeg,
        distance: loadedProject.route.chaseDistance ?? chaseCamera.distance,
        lookAhead: loadedProject.route.chaseLookAhead ?? chaseCamera.lookAhead,
        lookSide: loadedProject.route.chaseLookSide ?? chaseCamera.lookSide,
      },
      true,
    )
  }

  const shotsWithCam = loadedProject.shots.filter(
    (s) => Boolean(s.cameraPosition) || Boolean(s.chaseOrbit),
  )
  useShotTour = shotsWithCam.length > 0
  if (useShotTour) {
    const duration = loadedProject.shots.reduce(
      (total, shot) => total + Math.max(0, shot.transitionSeconds) + Math.max(0, shot.holdSeconds),
      0,
    )
    transport.setDuration(Math.max(0.1, duration))
    transport.setLoop(true)
    transport.setOwnership({ camera: 'shot-sequence' })
    // Prefer car-locked chase when a vehicle is loaded so the tour tracks the car.
    const followCar = Boolean(vehicleSession.getPlacementRoot())
    chaseCamera.setEnabled(followCar)
    renderer.setOrbitEnabled(false)
    shell.setOrbitActive(false)
    applyShotTour(loadedProject.shots, 0)
  } else if (loadedProject.route) {
    const len = routeSession.getLengthMetres()
    const mps = speedKmhToMetresPerSecond(loadedProject.route.speedKmh)
    transport.setDuration(mps > 0 && len > 0 ? len / mps : 10)
    transport.setLoop(Boolean(loadedProject.route.closed))
    transport.setAutoAdvance(false)
    transport.setOwnership({ camera: 'route-chase' })
    const chaseOn = Boolean(loadedProject.route.chaseCamera)
    chaseCamera.setEnabled(chaseOn)
    renderer.setOrbitEnabled(!chaseOn)
    shell.setOrbitActive(!chaseOn)
    routeSession.seekDistance(0)
  } else if (vehicleOk && vehicleSession.getPlacementRoot()) {
    transport.setDuration(10)
    transport.setLoop(false)
    renderer.setOrbitEnabled(true)
    shell.setOrbitActive(true)
    renderer.frameTo(new Vector3(0, 0.6, 0), 6)
  }

  shell.setExploreControls({
    shots: shotsWithCam.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailDataUrl: s.thumbnailDataUrl,
    })),
    showChase: vehicleOk,
    showDrive: vehicleOk,
  })

  const parts: string[] = []
  if (vehicleOk) parts.push('vehicle')
  else if (loadedProject.vehicle || loadedProject.activeVehicleId)
    parts.push('vehicle missing (re-import in Studio)')
  if (loadedProject.route) parts.push(loadedProject.route.closed ? 'loop route' : 'open path')
  if (useShotTour) parts.push(`${loadedProject.shots.length} shots`)
  else if (loadedProject.route?.chaseCamera) parts.push('chase cam')
  if (loadedProject.hotspots.length) parts.push(`${loadedProject.hotspots.length} hotspots`)
  shell.setStatus(
    projectId
      ? parts.length
        ? `Ready · ${parts.join(' · ')} · Drive / Views below`
        : 'Project loaded, but it has no vehicle, route, or shots.'
      : 'No saved project found. Save a Studio project first.',
  )

  const resize = () => {
    const rect = shell.viewportHost.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height)
    renderer.render()
  }
  resize()
  window.addEventListener('resize', resize)

  let raf = 0
  let lastFrameAt = performance.now()
  const _shadowFocus = new Vector3()
  const loop = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastFrameAt) / 1000)
    lastFrameAt = now

    vehicleSession.update()
    hotspotSession.update()

    const placement = vehicleSession.getPlacementRoot()
    if (placement) {
      placement.getWorldPosition(_shadowFocus)
      renderer.updateShadowFocus(_shadowFocus)
      renderer.updateContactShadow(placement)
      if (freeDriveActive) renderer.updateFloorFollow(_shadowFocus)
    } else {
      renderer.updateShadowFocus(null)
      renderer.updateContactShadow(null)
    }

    if (freeDriveActive) {
      syncDriveInput()
      freeDriveSession.advance(dt)
      const status = freeDriveSession.getStatus()
      const vel = status.velocityKmh ?? 0
      const braking =
        Math.abs(vel) < Math.abs(lastRouteVelocityKmh) - 0.4 ||
        (Math.abs(vel) < 0.8 && Math.abs(lastRouteVelocityKmh) > 2)
      vehicleSession.getLights().setRouteSignals({
        running: true,
        braking,
        reverse: vel < -0.5 || (status.throttle ?? 0) < -0.05,
        indicatorLeft: (status.steerInput ?? 0) < -0.15,
        indicatorRight: (status.steerInput ?? 0) > 0.15,
      })
      lastRouteVelocityKmh = vel
      chaseCamera.update(placement, dt, freeDriveSession.getVisualHeadingYaw())
    } else if (routeSession.isEnabled()) {
      const route = routeSession.getRoute()
      const ts = transport.getSnapshot()
      if (route) {
        if (ts.playing) {
          routeSession.advance(dt)
          const len = routeSession.getLengthMetres()
          const status = routeSession.getStatus()
          if (!useShotTour && len > 0 && ts.durationSeconds > 0) {
            const dist = Math.max(0, Math.min(len, status.distanceMetres))
            const frac = route.closed
              ? (((status.distanceMetres % len) + len) % len) / len
              : dist / len
            transport.seek(frac * ts.durationSeconds)
            if (
              !route.closed &&
              ((route.direction ?? 1) > 0
                ? dist >= len - 0.02 && Math.abs(status.velocityKmh ?? 0) < 0.15
                : dist <= 0.02 && Math.abs(status.velocityKmh ?? 0) < 0.15)
            ) {
              if (ts.playing) transport.pause()
            }
          }
        } else if (!useShotTour) {
          const len = routeSession.getLengthMetres()
          if (len > 0 && ts.durationSeconds > 0) {
            const t = Math.max(0, Math.min(1, ts.timeSeconds / ts.durationSeconds))
            routeSession.seekDistance(t * len)
          }
        }
      }
      if (useShotTour) {
        applyShotTour(store.getSnapshot().project.shots, transport.getSnapshot().timeSeconds)
        if (chaseCamera.isEnabled()) {
          chaseCamera.update(placement, dt, routeSession.getVisualHeadingYaw())
        }
      } else if (chaseCamera.isEnabled()) {
        chaseCamera.update(placement, dt, routeSession.getVisualHeadingYaw())
      }
    } else if (useShotTour) {
      applyShotTour(store.getSnapshot().project.shots, transport.getSnapshot().timeSeconds)
      if (chaseCamera.isEnabled()) {
        chaseCamera.update(placement, dt, currentVisualHeadingYaw())
      }
    } else if (chaseCamera.isEnabled()) {
      chaseCamera.update(placement, dt, routeSession.getVisualHeadingYaw())
    }

    renderer.render()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(raf)
    hotspotCard.dispose()
    routeSession.dispose()
    hotspotSession.dispose()
    vehicleSession.dispose()
    renderer.dispose()
    studioRenderer = null
    transport.dispose()
  })
}

const fromPosition = new Vector3()
const toPosition = new Vector3()
const fromTarget = new Vector3()
const toTarget = new Vector3()

function lerpChaseOrbit(a: ChaseOrbitState, b: ChaseOrbitState, t: number): ChaseOrbitState {
  let toYaw = b.yawDeg
  let delta = toYaw - a.yawDeg
  while (delta > 180) {
    toYaw -= 360
    delta -= 360
  }
  while (delta < -180) {
    toYaw += 360
    delta += 360
  }
  return {
    yawDeg: a.yawDeg + (toYaw - a.yawDeg) * t,
    pitchDeg: a.pitchDeg + (b.pitchDeg - a.pitchDeg) * t,
    distance: a.distance + (b.distance - a.distance) * t,
    lookAhead: a.lookAhead + (b.lookAhead - a.lookAhead) * t,
    lookSide: a.lookSide + (b.lookSide - a.lookSide) * t,
  }
}

function applyShotTour(shots: Shot[], time: number) {
  if (!studioRenderer || !shots.length) return
  let cursor = 0
  let index = shots.length - 1
  let local = 0
  for (let i = 0; i < shots.length; i++) {
    const span = Math.max(0, shots[i].transitionSeconds) + Math.max(0, shots[i].holdSeconds)
    if (time <= cursor + span || i === shots.length - 1) {
      index = i
      local = time - cursor
      break
    }
    cursor += span
  }

  const shot = shots[index]
  const previous = shots[Math.max(0, index - 1)]
  const transition = Math.max(0, shot.transitionSeconds)
  const alpha = transition > 0 ? Math.min(1, Math.max(0, local / transition)) : 1

  if (shot.id !== lastTourShotId) {
    lastTourShotId = shot.id
    playShotAnimation(shot)
  }

  const toOrbit = resolveShotChaseOrbit(shot)
  const fromOrbit = resolveShotChaseOrbit(previous) ?? toOrbit
  if (toOrbit && fromOrbit && vehicleSession.getPlacementRoot()) {
    chaseCamera.setEnabled(true)
    chaseCamera.setOrbit(lerpChaseOrbit(fromOrbit, toOrbit, alpha), false)
    const fromFov = previous.fov ?? shot.fov ?? 40
    studioRenderer.camera.fov = fromFov + ((shot.fov ?? fromFov) - fromFov) * alpha
    studioRenderer.camera.updateProjectionMatrix()
    return
  }

  if (!shot.cameraPosition) return
  fromPosition.fromArray(previous.cameraPosition ?? shot.cameraPosition)
  toPosition.fromArray(shot.cameraPosition)
  fromTarget.fromArray(previous.cameraTarget ?? shot.cameraTarget ?? [0, 0.8, 0])
  toTarget.fromArray(shot.cameraTarget ?? [0, 0.8, 0])
  studioRenderer.camera.position.lerpVectors(fromPosition, toPosition, alpha)
  studioRenderer.controls.target.lerpVectors(fromTarget, toTarget, alpha)
  const fromFov = previous.fov ?? shot.fov ?? 40
  studioRenderer.camera.fov = fromFov + ((shot.fov ?? fromFov) - fromFov) * alpha
  studioRenderer.camera.updateProjectionMatrix()
  studioRenderer.camera.lookAt(studioRenderer.controls.target)
}

boot().catch((err) => {
  shell.setStatus(`Renderer boot failed: ${err instanceof Error ? err.message : String(err)}`)
})
