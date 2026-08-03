import './ui/styles.css'
import {
  ProjectStore,
  renameProject,
  resetProject,
  setEnvironmentPreset,
  patchEnvironment,
  setActiveVehicle,
  setVehicleRig,
  setRoute,
  patchVehicleNormalization,
  upsertAsset,
} from './persistence/projectStore'
import { exportIomcar, importIomcar, downloadBlob } from './persistence/iomcar'
import { idbSaveProject, idbLoadProject } from './persistence/localDb'
import { migrateProject } from './persistence/migrations'
import type { EnvironmentPresetId, ExperienceMode, UiChromeTheme } from './persistence/schema'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { mountStudioShell } from './ui/studioShell'
import { VehicleSession } from './vehicle/vehicleSession'
import {
  assignQualityRolesByFileSize,
  inferQualityRoleFromFilename,
  qualityLabel,
  type VehicleQualityRole,
} from './vehicle/qualityVariants'
import { RouteSession } from './route/routeSession'
import { speedKmhToMetresPerSecond } from './route/routeMath'

const UI_THEME_KEY = 'iom-automotive-ui-theme'

function readUiTheme(): UiChromeTheme {
  const stored = localStorage.getItem(UI_THEME_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')

const store = new ProjectStore()
const transport = new Transport()
transport.setDuration(10)
const vehicleSession = new VehicleSession()
const routeSession = new RouteSession()

let mode: ExperienceMode = 'studio'
let uiTheme = readUiTheme()
let studioRenderer: Awaited<ReturnType<typeof createStudioRenderer>> | null = null

const shell = mountStudioShell(root, {
  mode,
  uiTheme,
  onRename: (name) => store.dispatch(renameProject(name)),
  onUndo: () => store.undo(),
  onRedo: () => store.redo(),
  onSave: async () => {
    try {
      const json = store.exportProjectJson()
      await idbSaveProject(json)
      store.markClean()
      shell.setStatus(`Saved locally (${json.id.slice(0, 8)}…). Model blobs stay in IndexedDB.`)
    } catch (err) {
      shell.setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onExport: async () => {
    try {
      const blob = await exportIomcar(store.exportProjectJson())
      const safe = store.getSnapshot().project.name.replace(/[^\w.-]+/g, '_').slice(0, 48)
      downloadBlob(blob, `${safe || 'project'}.iomcar`)
      shell.setStatus('Exported .iomcar (manifest; large GLBs remain IndexedDB-local in Phase 2).')
    } catch (err) {
      shell.setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onImportFile: async (file) => {
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text()
        store.loadProject(JSON.parse(text))
      } else {
        store.loadProject(await importIomcar(file))
      }
      shell.setStatus(`Imported project ${file.name}`)
    } catch (err) {
      shell.setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onNew: () => {
    vehicleSession.clearActiveVehicle()
    routeSession.clearRoute()
    store.dispatch(resetProject())
    shell.updateVehicle(vehicleSession.getSnapshot())
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus('New empty project.')
  },
  onPreview: () => {
    mode = mode === 'preview' ? 'studio' : 'preview'
    shell.setModeLabel(mode)
    shell.setStatus(
      mode === 'preview'
        ? 'Preview mode — authoring chrome remains for return.'
        : 'Back to Studio authoring.',
    )
  },
  onPresent: () => {
    const url = new URL('presentation.html', location.href)
    if (new URLSearchParams(location.search).get('forceWebGL2') === '1') {
      url.searchParams.set('forceWebGL2', '1')
    }
    location.assign(url)
  },
  onToggleOrbit: () => {
    if (!studioRenderer) return
    const next = !studioRenderer.isOrbitEnabled()
    studioRenderer.setOrbitEnabled(next)
    shell.setOrbitEnabled(next)
    shell.setStatus(
      next
        ? 'Free camera on — drag orbit, scroll zoom, right-drag pan.'
        : 'Free camera off.',
    )
  },
  onPlayPause: () => {
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  },
  onSeek: (t) => transport.seek(t),
  onEnvironmentPreset: (preset) => {
    store.dispatch(setEnvironmentPreset(preset as EnvironmentPresetId))
  },
  onEnvironmentPatch: (patch) => {
    store.dispatch(patchEnvironment(patch))
  },
  onEnvironmentLive: (patch) => {
    if (!studioRenderer) return
    studioRenderer.applyEnvironmentState({
      ...store.getSnapshot().project.environment,
      ...patch,
      presetId: 'custom',
    })
  },
  onUiTheme: (theme) => {
    uiTheme = theme
    localStorage.setItem(UI_THEME_KEY, theme)
    shell.setUiTheme(theme)
    shell.setStatus(theme === 'light' ? 'Light UI chrome.' : 'Dark UI chrome.')
  },
  onImportGlb: async (files, role, quality) => {
    try {
      if (!files.length) return

      const batch: Array<{ file: File; quality: VehicleQualityRole }> =
        files.length > 1
          ? assignQualityRolesByFileSize(files)
          : [
              {
                file: files[0],
                quality:
                  quality === 'auto' ? inferQualityRoleFromFilename(files[0].name) : quality,
              },
            ]

      const labels: string[] = []
      let lastVehicleResult: Awaited<ReturnType<typeof vehicleSession.importFile>> | null = null

      for (let i = 0; i < batch.length; i++) {
        const { file, quality: slot } = batch[i]
        const result = await vehicleSession.importFile(
          file,
          role,
          (ratio, label) => {
            const head = files.length > 1 ? `[${i + 1}/${batch.length}] ` : ''
            shell.setImportProgress(ratio, `${head}${label}`)
          },
          slot,
        )
        labels.push(`${qualityLabel(slot)}=${file.name}`)
        if (role === 'replace-vehicle' && result.vehicle) {
          store.dispatch(setActiveVehicle(result.vehicle, result.asset))
          lastVehicleResult = result
        } else {
          store.dispatch(upsertAsset(result.asset))
        }
      }

      if (role === 'replace-vehicle' && lastVehicleResult?.vehicle) {
        const snap = vehicleSession.getSnapshot()
        const preferHigh = snap.variants.some((v) => v.role === 'vehicle-high')
        if (files.length > 1 && preferHigh && snap.activeQuality !== 'vehicle-high') {
          const switched = await vehicleSession.switchQuality('vehicle-high', (ratio, label) => {
            shell.setImportProgress(ratio, label)
          })
          store.dispatch(setActiveVehicle(switched.vehicle, switched.asset))
          lastVehicleResult = switched
        }
        const clip = lastVehicleResult.report.animations[0]
        if (clip && !routeSession.isEnabled()) transport.setDuration(clip.duration)
        shell.setStatus(
          files.length > 1
            ? `Imported by size → ${labels.join(', ')}. Active: ${qualityLabel(
                (vehicleSession.getSnapshot().activeQuality ?? 'vehicle-high') as VehicleQualityRole,
              )}.`
            : `Vehicle ready — ${clip ? `${clip.name} ${clip.duration.toFixed(3)}s` : 'no clips'}.`,
        )
      } else {
        shell.setStatus(
          files.length > 1 ? `Added ${batch.length} props.` : `Prop added: ${files[0].name}`,
        )
      }
      shell.updateVehicle(vehicleSession.getSnapshot())
      syncRouteVehicle()
    } catch (err) {
      shell.setStatus(`GLB import failed: ${err instanceof Error ? err.message : String(err)}`, true)
      shell.updateVehicle(vehicleSession.getSnapshot())
    }
  },
  onClearVehicle: () => {
    vehicleSession.clearActiveVehicle()
    routeSession.setVehicle(null, null)
    store.dispatch(setActiveVehicle(null))
    shell.updateVehicle(vehicleSession.getSnapshot())
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus('Active vehicle cleared.')
  },
  onSwitchQuality: async (role) => {
    try {
      const result = await vehicleSession.switchQuality(role, (ratio, label) => {
        shell.setImportProgress(ratio, label)
      })
      store.dispatch(setActiveVehicle(result.vehicle, result.asset))
      const clip = result.report.animations[0]
      if (clip && !routeSession.isEnabled()) transport.setDuration(clip.duration)
      shell.updateVehicle(vehicleSession.getSnapshot())
      syncRouteVehicle()
      shell.setStatus(`Active quality: ${role.replace('vehicle-', '')}. Placement preserved.`)
    } catch (err) {
      shell.setStatus(`Variant switch failed: ${err instanceof Error ? err.message : String(err)}`, true)
      shell.updateVehicle(vehicleSession.getSnapshot())
    }
  },
  onImportRigManifest: async (file) => {
    try {
      const rig = await vehicleSession.importRigManifestFile(file)
      store.dispatch(setVehicleRig(rig))
      const snap = vehicleSession.getSnapshot()
      shell.updateVehicle(snap)
      syncRouteVehicle()
      if (snap.rigBound) {
        shell.setStatus(`Rig manifesto loaded — ${rig.wheels.length} wheels bound.`)
      } else {
        const onlyPivots = snap.rigMissing.every((m) => m.includes(' rolling:'))
        shell.setStatus(
          onlyPivots
            ? `Steering nodes OK. Rolling pivots missing on this GLB — import a *-rigged.glb. Missing: ${snap.rigMissing.join('; ')}`
            : `Rig manifesto incomplete: ${snap.rigMissing.join('; ')}`,
          true,
        )
      }
    } catch (err) {
      shell.setStatus(`Rig import failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onCreateDemoRoute: () => {
    if (!vehicleSession.getPlacementRoot()) {
      shell.setStatus('Import a vehicle before creating a route.', true)
      return
    }
    syncRouteVehicle()
    const route = routeSession.ensureDemoRoute(18)
    store.dispatch(setRoute(route))
    applyRouteTransportDuration()
    transport.seek(0)
    const sample = routeSession.seekDistance(0)
    const status = routeSession.getStatus()
    shell.updateRouteStats(status)
    shell.setStatus(
      sample
        ? `Demo oval ready — ${status.lengthMetres.toFixed(1)} m spline, ${status.bindingCount} rolling pivot(s). Press Play.`
        : 'Demo oval created.',
    )
  },
  onClearRoute: () => {
    routeSession.clearRoute()
    store.dispatch(setRoute(null))
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus('Route cleared.')
  },
  onRouteSpeed: (kmh) => {
    const travelled = routeSession.getStatus().distanceMetres
    routeSession.setSpeedKmh(kmh)
    const route = routeSession.getRoute()
    if (route) store.dispatch(setRoute({ ...route, speedKmh: kmh }))
    applyRouteTransportDuration()

    // Transport time maps to distance via speed, so rescale it or the car teleports.
    const len = routeSession.getLengthMetres()
    const mps = speedKmhToMetresPerSecond(kmh)
    if (len > 0 && mps > 0) {
      transport.seek((((travelled % len) + len) % len) / mps)
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteWheelRoll: (enabled) => {
    routeSession.setWheelRollEnabled(enabled)
    shell.setStatus(enabled ? 'Tire roll on (distance-linked).' : 'Tire roll off.')
  },
  onRouteTireRollRate: (rate) => {
    routeSession.setTireRollRate(rate)
    const route = routeSession.getRoute()
    if (route) route.tireRollRate = rate
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteMaxSteer: (degrees) => {
    routeSession.setMaxSteerDegrees(degrees)
    const route = routeSession.getRoute()
    if (route) route.maxSteerDeg = degrees
    shell.updateRouteStats(routeSession.getStatus())
  },
  onTargetLength: (metres) => {
    const measured = vehicleSession.setNormalization({ targetLengthMetres: metres })
    if (!measured) return
    store.dispatch(
      patchVehicleNormalization({
        targetLengthMetres: metres,
        lengthMetres: measured.length,
        widthMetres: measured.width,
        heightMetres: measured.height,
      }),
    )
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
  onFlip180: () => {
    const current = vehicleSession.getSnapshot().normalization
    if (!current) return
    const measured = vehicleSession.setNormalization({ flip180: !current.flip180 })
    if (!measured) return
    store.dispatch(
      patchVehicleNormalization({
        flip180: !current.flip180,
        lengthMetres: measured.length,
        widthMetres: measured.width,
        heightMetres: measured.height,
      }),
    )
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
  onGroundOffset: (metres) => {
    const measured = vehicleSession.setNormalization({ groundOffsetMetres: metres })
    if (!measured) return
    store.dispatch(
      patchVehicleNormalization({
        groundOffsetMetres: metres,
        lengthMetres: measured.length,
        widthMetres: measured.width,
        heightMetres: measured.height,
      }),
    )
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
  onClipPlay: () => {
    vehicleSession.toggleClipPlayback()
  },
  onClipStop: () => {
    vehicleSession.stopClip()
  },
  onClipSeek: (t) => {
    vehicleSession.seekClip(t)
  },
  onClipSelect: (index) => {
    vehicleSession.playClip(index)
    vehicleSession.stopClip()
    const clip = vehicleSession.getSnapshot().clips[index]
    if (clip) transport.setDuration(clip.duration)
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
})

function syncRouteVehicle() {
  routeSession.setVehicle(vehicleSession.getPlacementRoot(), vehicleSession.getRig())
  shell.updateRouteStats(routeSession.getStatus())
}

function applyRouteTransportDuration() {
  const route = routeSession.getRoute()
  if (!route) return
  // Spline length, not polyline length, or the loop point drifts off the guide line.
  const len = routeSession.getLengthMetres()
  const mps = speedKmhToMetresPerSecond(route.speedKmh)
  transport.setDuration(mps > 0 && len > 0 ? len / mps : 10)
  transport.setLoop(true)
}

store.subscribe((snap) => {
  shell.updateStore(snap)
  studioRenderer?.applyEnvironmentState(snap.project.environment)
})
transport.subscribe((snap) => shell.updateTransport(snap))
shell.updateStore(store.getSnapshot())
shell.updateTransport(transport.getSnapshot())
shell.updateVehicle(vehicleSession.getSnapshot())

window.addEventListener('keydown', (e) => {
  const meta = e.ctrlKey || e.metaKey
  if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    store.redo()
  } else if (
    e.code === 'Space' &&
    !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
  ) {
    e.preventDefault()
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  } else if (e.key === 'Escape' && mode === 'preview') {
    mode = 'studio'
    shell.setModeLabel(mode)
    shell.setStatus('Exited Preview.')
  }
})

async function boot() {
  const renderer = await createStudioRenderer(shell.viewportHost)
  studioRenderer = renderer
  vehicleSession.bindScene(renderer.scene, renderer.camera, renderer.renderer, renderer.controls)
  routeSession.bind(renderer.scene)
  shell.setRendererInfo(renderer)
  shell.updateRouteStats(routeSession.getStatus())
  renderer.applyEnvironmentState(store.getSnapshot().project.environment)

  const resize = () => {
    const rect = shell.viewportHost.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height)
    renderer.render()
  }
  resize()
  window.addEventListener('resize', resize)

  let raf = 0
  let lastRouteStatsAt = 0
  const loop = () => {
    vehicleSession.update()
    const clip = vehicleSession.getClipTime()
    shell.setClipTransport(clip.time, clip.duration, clip.playing)

    if (routeSession.isEnabled()) {
      const route = routeSession.getRoute()
      if (route) {
        const mps = speedKmhToMetresPerSecond(route.speedKmh)
        const ts = transport.getSnapshot()
        routeSession.seekDistance(ts.timeSeconds * mps)
      }
      const now = performance.now()
      if (now - lastRouteStatsAt > 150) {
        lastRouteStatsAt = now
        shell.updateRouteStats(routeSession.getStatus())
      }
    }

    renderer.render()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  try {
    const id = store.getSnapshot().project.id
    const existing = await idbLoadProject(id)
    if (existing) {
      store.loadProject(migrateProject(existing))
      shell.setStatus('Restored project metadata from IndexedDB. Re-import GLB if the viewport is empty.')
    }
  } catch {
    // ignore
  }

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(raf)
    routeSession.dispose()
    vehicleSession.dispose()
    renderer.dispose()
    transport.dispose()
  })
}

boot().catch((err) => {
  shell.setStatus(`Renderer boot failed: ${err instanceof Error ? err.message : String(err)}`, true)
})
