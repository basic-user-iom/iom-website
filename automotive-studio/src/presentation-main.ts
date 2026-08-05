import './ui/styles.css'
import { Vector3 } from 'three'
import { ProjectStore, patchVehicleLights } from './persistence/projectStore'
import { createEmptyProject } from './persistence/schema'
import type { Shot, VehicleLightGroupId } from './persistence/schema'
import { idbListProjectSummaries, idbLoadProject } from './persistence/localDb'
import { readLastProjectId, resolveBootProjectId, writeLastProjectId } from './persistence/projectSession'
import { migrateProject } from './persistence/migrations'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { mountPresentationShell } from './presentation/presentationShell'
import { VehicleSession } from './vehicle/vehicleSession'
import { RouteSession } from './route/routeSession'
import { ChaseCamera } from './route/chaseCamera'
import { HotspotSession } from './hotspots/hotspotSession'
import { mountHotspotCard, runHotspotAction, runHotspotActions } from './hotspots/hotspotCard'
import { speedKmhToMetresPerSecond } from './route/routeMath'

/**
 * Presentation entry — curated client shell only.
 * Do not import Studio authoring UI modules here.
 */

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')

const project = createEmptyProject('Client Presentation')
project.presentation.accessPolicy = 'access-controlled'
project.presentation.defaultMode = 'guided'

const store = new ProjectStore(project)
const transport = new Transport()
transport.setDuration(10)
transport.setOwnership({ camera: 'shot-sequence' })

const vehicleSession = new VehicleSession()
const routeSession = new RouteSession()
const chaseCamera = new ChaseCamera()
const hotspotSession = new HotspotSession()

let muted = false
let studioRenderer: Awaited<ReturnType<typeof createStudioRenderer>> | null = null
let useShotTour = false

const shell = mountPresentationShell(root, {
  onPlayPause: () => {
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
    const studio = new URL('index.html', location.href)
    if (new URLSearchParams(location.search).get('forceWebGL2') === '1') {
      studio.searchParams.set('forceWebGL2', '1')
    }
    location.assign(studio)
  },
  onInfo: () => {
    const credits = store
      .getSnapshot()
      .project.credits.map((c) => c.label)
      .join(' · ')
    shell.setStatus(credits || 'IOM Automotive Presentation')
  },
})

store.subscribe((snap) => shell.updateStore(snap))
transport.subscribe((snap) => shell.updateTransport(snap))
shell.updateStore(store.getSnapshot())
shell.updateTransport(transport.getSnapshot())

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  } else if (e.key === 'Escape') {
    const studio = new URL('index.html', location.href)
    location.assign(studio)
  }
})

async function boot() {
  const requestedId = new URLSearchParams(location.search).get('project')
  const summaries = await idbListProjectSummaries()
  const projectId = resolveBootProjectId({
    queryProjectId: requestedId,
    lastProjectId: readLastProjectId(),
    summaries,
  })
  if (projectId) {
    const saved = await idbLoadProject(projectId)
    if (saved) {
      store.loadProject(migrateProject(saved))
      writeLastProjectId(projectId)
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
      runHotspotAction(action, {
        playSemanticAction: (id) => vehicleSession.playSemanticAction(id),
        setVehicleLight: (groupId, on) => {
          store.dispatch(
            patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }),
          )
        },
        toggleVehicleLight: (groupId) => {
          const cur =
            store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
          store.dispatch(
            patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: !cur } }),
          )
        },
        playVehicleLightSequence: (sequenceId) => {
          vehicleSession.getLights().playSequence(sequenceId as 'welcome' | 'farewell')
        },
      })
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
      runHotspotAction(action, {
        playSemanticAction: (id) => vehicleSession.playSemanticAction(id),
        setVehicleLight: (groupId, on) => {
          store.dispatch(
            patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }),
          )
        },
        toggleVehicleLight: (groupId) => {
          const cur =
            store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
          store.dispatch(
            patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: !cur } }),
          )
        },
        playVehicleLightSequence: (sequenceId) => {
          vehicleSession.getLights().playSequence(sequenceId as 'welcome' | 'farewell')
        },
      })
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
      hotspotSession.setVehiclePlacement(vehicleSession.getPlacementRoot())
      vehicleSession.getLights().apply(loadedProject.vehicleLights)
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

  useShotTour = loadedProject.shots.some((s) => Boolean(s.cameraPosition))
  if (useShotTour) {
    const duration = loadedProject.shots.reduce(
      (total, shot) => total + Math.max(0, shot.transitionSeconds) + Math.max(0, shot.holdSeconds),
      0,
    )
    transport.setDuration(Math.max(0.1, duration))
    transport.setLoop(true)
    transport.setOwnership({ camera: 'shot-sequence' })
    chaseCamera.setEnabled(false)
    renderer.setOrbitEnabled(false)
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
    routeSession.seekDistance(0)
  } else if (vehicleOk && vehicleSession.getPlacementRoot()) {
    transport.setDuration(10)
    transport.setLoop(false)
    renderer.setOrbitEnabled(true)
    const placement = vehicleSession.getPlacementRoot()!
    renderer.frameTo(new Vector3(0, 0.6, 0), 6)
    void placement
  }

  const parts: string[] = []
  if (vehicleOk) parts.push('vehicle')
  else if (loadedProject.vehicle || loadedProject.activeVehicleId) parts.push('vehicle missing (re-import in Studio)')
  if (loadedProject.route) parts.push(loadedProject.route.closed ? 'loop route' : 'open path')
  if (useShotTour) parts.push(`${loadedProject.shots.length} shots`)
  else if (loadedProject.route?.chaseCamera) parts.push('chase cam')
  if (loadedProject.hotspots.length) parts.push(`${loadedProject.hotspots.length} hotspots`)
  shell.setStatus(
    projectId
      ? parts.length
        ? `Ready · ${parts.join(' · ')} · Play to begin`
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

    const placement = vehicleSession.getPlacementRoot()
    if (placement) {
      placement.getWorldPosition(_shadowFocus)
      renderer.updateShadowFocus(_shadowFocus)
      renderer.updateContactShadow(placement)
    } else {
      renderer.updateShadowFocus(null)
      renderer.updateContactShadow(null)
    }

    if (routeSession.isEnabled()) {
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
    }

    if (useShotTour) {
      applyShotTour(store.getSnapshot().project.shots, transport.getSnapshot().timeSeconds)
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
  if (!shot.cameraPosition) return
  const previous = shots[Math.max(0, index - 1)]
  const transition = Math.max(0, shot.transitionSeconds)
  const alpha = transition > 0 ? Math.min(1, Math.max(0, local / transition)) : 1
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
