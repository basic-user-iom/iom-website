import './ui/styles.css'
import { Vector3 } from 'three'
import {
  ProjectStore,
  renameProject,
  resetProject,
  setEnvironmentPreset,
  patchEnvironment,
  setActiveVehicle,
  setVehicleRig,
  setRoute,
  patchFreeDrive,
  patchVehicleNormalization,
  upsertAsset,
  upsertHotspot,
  removeHotspot,
  upsertShot,
  removeShot,
  patchStage,
  patchAccentLights,
  upsertMaterialOverride,
  setVehiclePolishMode,
  patchVehicleLights,
  clearVehicleProject,
} from './persistence/projectStore'
import { exportIomcar, importIomcar, downloadBlob } from './persistence/iomcar'
import { idbSaveProject, idbLoadProject, idbGetAssetBlob, idbPutAssetBlob, idbListProjectSummaries } from './persistence/localDb'
import { purgeOrphanAssetBlobs } from './persistence/assetGc'
import {
  readLastProjectId,
  resolveBootProjectId,
  writeLastProjectId,
} from './persistence/projectSession'
import { migrateProject } from './persistence/migrations'
import type {
  EnvironmentPresetId,
  ExperienceMode,
  Hotspot,
  MaterialNodeOverride,
  Shot,
  UiChromeTheme,
  VehicleLightGroupId,
} from './persistence/schema'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { mountStudioShell } from './ui/studioShell'
import { VehicleSession } from './vehicle/vehicleSession'
import {
  assignQualityRolesByFileSize,
  findNamedNode,
  inferQualityRoleFromFilename,
  qualityLabel,
  type VehicleQualityRole,
} from './vehicle/qualityVariants'
import { RouteSession } from './route/routeSession'
import { FreeDriveSession } from './route/freeDriveSession'
import { ChaseCamera, CHASE_ORBIT_PRESETS, type ChaseOrbitPreset } from './route/chaseCamera'
import { RouteEditController } from './route/routeEdit'
import { speedKmhToMetresPerSecond } from './route/routeMath'
import { HotspotSession } from './hotspots/hotspotSession'
import { mountHotspotCard, runHotspotAction, runHotspotActions } from './hotspots/hotspotCard'
import {
  hotspotVideoAssetId,
  withHotspotBody,
  withHotspotDoorAction,
  withHotspotTitle,
  withHotspotVideo,
} from './hotspots/hotspotContent'
import { defaultLocalAnchorOnNode, refFromObject } from './hotspots/resolveAnchor'
import { ObjectInspector } from './vehicle/objectInspector'
import type { MaterialEditState } from './vehicle/objectInspector'

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
vehicleSession.getLights().setOnSequenceCommit((groups) => {
  store.dispatch(patchVehicleLights({ groups }))
})
const routeSession = new RouteSession()
const freeDriveSession = new FreeDriveSession()
const driveKeys = new Set<string>()
const chaseCamera = new ChaseCamera()
const hotspotSession = new HotspotSession()
const objectInspector = new ObjectInspector()
let routeEdit: RouteEditController | null = null

let mode: ExperienceMode = 'studio'
let uiTheme = readUiTheme()
let studioRenderer: Awaited<ReturnType<typeof createStudioRenderer>> | null = null
let bootComplete = false
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTOSAVE_MS = 1200

async function persistProject(options: { reason: 'manual' | 'auto' | 'present'; purgeOrphans?: boolean }) {
  const json = store.exportProjectJson()
  await idbSaveProject(json)
  writeLastProjectId(json.id)
  store.markClean()
  if (options.purgeOrphans) {
    const removed = await purgeOrphanAssetBlobs(store.getSnapshot().project)
    if (removed > 0 && options.reason === 'manual') {
      return { json, orphanNote: ` · purged ${removed} orphan blob(s)` }
    }
  }
  return { json, orphanNote: '' }
}

const shell = mountStudioShell(root, {
  mode,
  uiTheme,
  onRename: (name) => store.dispatch(renameProject(name)),
  onUndo: () => {
    store.undo()
    void rehydrateVehicleAfterHistory()
  },
  onRedo: () => {
    store.redo()
    void rehydrateVehicleAfterHistory()
  },
  onSave: async () => {
    try {
      const { json, orphanNote } = await persistProject({
        reason: 'manual',
        purgeOrphans: true,
      })
      shell.setStatus(
        `Saved locally (${json.id.slice(0, 8)}…). Model blobs stay in IndexedDB${orphanNote}.`,
      )
    } catch (err) {
      shell.setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onExport: async () => {
    try {
      shell.setStatus('Packaging .iomcar (project + GLB blobs)…')
      const { blob, included, missing } = await exportIomcar(
        store.exportProjectJson(),
        (key) => idbGetAssetBlob(key),
      )
      const safe = store.getSnapshot().project.name.replace(/[^\w.-]+/g, '_').slice(0, 48)
      downloadBlob(blob, `${safe || 'project'}.iomcar`)
      const project = store.getSnapshot().project
      const miss =
        missing.length > 0 ? ` · missing ${missing.length}: ${missing.slice(0, 3).join(', ')}` : ''
      shell.setStatus(
        `Exported .iomcar · ${included} asset(s) · ${project.hotspots.length} hotspot(s) · ${project.shots.length} shot(s)${miss}`,
        missing.length > 0,
      )
    } catch (err) {
      shell.setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onImportFile: async (file) => {
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text()
        store.loadProject(JSON.parse(text))
        hydrateProjectRuntime()
        shell.setStatus(`Imported project ${file.name}`)
        return
      }

      shell.setStatus('Importing .iomcar…')
      const { project, blobs, warnings } = await importIomcar(file)
      for (const entry of blobs) {
        await idbPutAssetBlob(entry.assetId, entry.blob, { filename: entry.filename })
      }
      store.loadProject(project)
      hydrateProjectRuntime()

      let vehicleNote = ''
      try {
        const restored = await vehicleSession.restoreFromProject(store.getSnapshot().project)
        if (restored) {
          syncRouteVehicle()
          shell.updateVehicle(vehicleSession.getSnapshot())
          vehicleNote = ' · vehicle restored'
        } else {
          vehicleNote = ' · no vehicle blob in package'
        }
      } catch (err) {
        vehicleNote = ` · vehicle restore failed (${err instanceof Error ? err.message : String(err)})`
      }

      const warn =
        warnings.length > 0 ? ` · ${warnings.slice(0, 2).join('; ')}` : ''
      shell.setStatus(
        `Imported ${file.name} · ${blobs.length} blob(s)${vehicleNote}${warn}`,
        warnings.length > 0 || vehicleNote.includes('failed'),
      )
    } catch (err) {
      shell.setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
  },
  onNew: () => {
    // Keep blobs so Undo can restore; orphans purge on next successful Save.
    vehicleSession.clearActiveVehicle()
    routeSession.clearRoute()
    store.dispatch(resetProject())
    writeLastProjectId(store.getSnapshot().project.id)
    shell.updateVehicle(vehicleSession.getSnapshot())
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus('New empty project. Previous vehicle blobs kept until Save purges orphans.')
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
  onPresent: async () => {
    const { json: project } = await persistProject({ reason: 'present' })
    const url = new URL('presentation.html', location.href)
    url.searchParams.set('project', project.id)
    if (new URLSearchParams(location.search).get('forceWebGL2') === '1') {
      url.searchParams.set('forceWebGL2', '1')
    }
    location.assign(url)
  },
  onToggleOrbit: () => {
    if (!studioRenderer) return
    const next = !studioRenderer.isOrbitEnabled()
    if (next) {
      chaseCamera.setEnabled(false)
      shell.setChaseCameraEnabled(false)
      routeEdit?.setEnabled(false)
      shell.setRouteEditEnabled(false)
      const route = routeSession.getRoute()
      if (route) {
        route.chaseCamera = false
      }
    }
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
    if (preset === 'night') {
      const vl = store.getSnapshot().project.vehicleLights
      if (vl.autoRunningAtNight && !Object.values(vl.groups).some(Boolean)) {
        store.dispatch(patchVehicleLights({ groups: { drl: true, tail: true } }))
      }
    }
  },
  onEnvironmentPatch: (patch) => {
    store.dispatch(patchEnvironment(patch, { keepPresetLabel: true }))
  },
  onEnvironmentLive: (patch) => {
    if (!studioRenderer) return
    const current = store.getSnapshot().project.environment
    studioRenderer.applyEnvironmentState({
      ...current,
      ...patch,
      basePresetId: current.basePresetId,
      customized: true,
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
    vehicleSession.setAuthoring({ polishMode: 'auto', clearOverrides: true })
    routeSession.setVehicle(null, null)
    routeSession.clearRoute()
    freeDriveSession.setVehicle(null, null)
    freeDriveSession.setEnabled(false)
    studioRenderer?.setInfiniteFloor(false)
    driveKeys.clear()
    hotspotSession.syncFromProject([])
    hotspotSession.setVehiclePlacement(null)
    objectInspector.setRoot(null)
    store.dispatch(clearVehicleProject())
    shell.setFreeDriveEnabled(false)
    shell.setChaseLockedForFreeDrive(false)
    shell.updateVehicle(vehicleSession.getSnapshot())
    shell.updateRouteStats(routeSession.getStatus())
    refreshObjectInspector()
    refreshHotspotEditor()
    refreshHotspotNodeList()
    shell.updateVehicleLightCounts(vehicleSession.getLights().getBoundCounts())
    shell.updateVehicleLightBindings([])
    shell.setStatus(
      'Vehicle cleared: model, assets list, lamps, hotspots, route. Blobs kept for Undo until Save.',
    )
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
    disableFreeDriveForRoute()
    syncRouteVehicle()
    const route = routeSession.ensureDemoRoute(18)
    route.chaseCamera = true
    store.dispatch(setRoute(route))
    applyRouteTransportDuration()
    transport.setAutoAdvance(false)
    transport.seek(0)
    const sample = routeSession.seekDistance(0)
    applyChaseCamera(true)
    const status = routeSession.getStatus()
    shell.updateRouteStats(status)
    shell.setStatus(
      sample
        ? `Demo oval ready — ${status.lengthMetres.toFixed(1)} m closed loop, chase cam on. Press Play.`
        : 'Demo oval created.',
    )
  },
  onCreateOpenRoute: () => {
    if (!vehicleSession.getPlacementRoot()) {
      shell.setStatus('Import a vehicle before creating a route.', true)
      return
    }
    disableFreeDriveForRoute()
    syncRouteVehicle()
    const route = routeSession.ensureOpenRoute(18)
    route.chaseCamera = true
    store.dispatch(setRoute(route))
    applyRouteTransportDuration()
    transport.setAutoAdvance(false)
    transport.seek(0)
    routeSession.seekDistance(0)
    applyChaseCamera(true)
    const status = routeSession.getStatus()
    shell.updateRouteStats(status)
    shell.setStatus(
      `Open path ready — ${status.lengthMetres.toFixed(1)} m. Tune start accel / end stop, then Play.`,
    )
  },
  onClearRoute: () => {
    routeEdit?.setEnabled(false)
    shell.setRouteEditEnabled(false)
    routeSession.clearRoute()
    store.dispatch(setRoute(null))
    transport.setAutoAdvance(true)
    applyChaseCamera(false)
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus('Route cleared.')
  },
  onRouteSpeed: (kmh, opts) => {
    if (freeDriveSession.isEnabled()) {
      freeDriveSession.setCruiseKmh(kmh)
      if (opts?.commit) {
        store.dispatch(patchFreeDrive({ cruiseKmh: kmh }), { recordHistory: true })
      }
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    const travelled = routeSession.getStatus().distanceMetres
    routeSession.setSpeedKmh(kmh)
    if (opts?.commit) {
      const route = routeSession.getRoute()
      if (route) store.dispatch(setRoute({ ...route, speedKmh: kmh }))
    } else {
      const route = routeSession.getRoute()
      if (route) route.speedKmh = kmh
    }
    applyRouteTransportDuration()

    const len = routeSession.getLengthMetres()
    const mps = speedKmhToMetresPerSecond(kmh)
    if (len > 0 && mps > 0) {
      transport.seek((((travelled % len) + len) % len) / mps)
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteWheelRoll: (enabled) => {
    routeSession.setWheelRollEnabled(enabled)
    freeDriveSession.setWheelRollEnabled(enabled)
    shell.setStatus(enabled ? 'Tire roll on (distance-linked).' : 'Tire roll off.')
  },
  onRouteTireRollRate: (rate) => {
    routeSession.setTireRollRate(rate)
    freeDriveSession.setTireRollRate(rate)
    const route = routeSession.getRoute()
    if (route) route.tireRollRate = rate
    if (freeDriveSession.isEnabled()) {
      store.dispatch(patchFreeDrive({ tireRollRate: rate }), { recordHistory: false })
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteMaxSteer: (degrees) => {
    routeSession.setMaxSteerDegrees(degrees)
    freeDriveSession.setMaxSteerDegrees(degrees)
    const route = routeSession.getRoute()
    if (route) route.maxSteerDeg = degrees
    if (freeDriveSession.isEnabled()) {
      store.dispatch(patchFreeDrive({ maxSteerDeg: degrees }), { recordHistory: false })
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteBodyRoll: (degrees) => {
    routeSession.setMaxBodyRollDegrees(degrees)
    freeDriveSession.setMaxBodyRollDegrees(degrees)
    const route = routeSession.getRoute()
    if (route) route.bodyRollDeg = degrees
    if (freeDriveSession.isEnabled()) {
      store.dispatch(patchFreeDrive({ bodyRollDeg: degrees }), { recordHistory: false })
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteAccel: (mps2) => {
    routeSession.setAccelMps2(mps2)
    freeDriveSession.setAccelMps2(mps2)
    if (freeDriveSession.isEnabled()) {
      store.dispatch(patchFreeDrive({ accelMps2: mps2 }), { recordHistory: false })
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteBrake: (mps2) => {
    routeSession.setBrakeMps2(mps2)
    freeDriveSession.setBrakeMps2(mps2)
    if (freeDriveSession.isEnabled()) {
      store.dispatch(patchFreeDrive({ brakeMps2: mps2 }), { recordHistory: false })
      shell.updateRouteStats(freeDriveSession.getStatus())
      return
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteStartAccel: (mps2) => {
    routeSession.setStartAccelMps2(mps2)
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteEndStop: (mps2) => {
    routeSession.setEndStopMps2(mps2)
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteClosed: (closed) => {
    const route = routeSession.setClosed(closed)
    if (!route) {
      shell.setStatus(
        closed
          ? 'Need at least 3 points to close the loop.'
          : 'Could not open the path.',
        true,
      )
      shell.updateRouteStats(routeSession.getStatus())
      return
    }
    store.dispatch(setRoute({ ...route }))
    applyRouteTransportDuration()
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus(closed ? 'Closed loop on.' : 'Open path — eases in at start, stops at end.')
  },
  onRouteAddPoint: () => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create a route before editing points.', true)
      return
    }
    const route = routeSession.addWaypoint()
    if (!route) {
      shell.setStatus('Could not add a point.', true)
      return
    }
    store.dispatch(setRoute({ ...route }))
    applyRouteTransportDuration()
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus(`Waypoint added · ${route.pointsMetres.length} points.`)
  },
  onRouteRemovePoint: () => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create a route before editing points.', true)
      return
    }
    const route = routeSession.removeWaypoint()
    if (!route) {
      shell.setStatus('Select a marker first, or path is at the minimum point count.', true)
      return
    }
    store.dispatch(setRoute({ ...route }))
    applyRouteTransportDuration()
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus(`Waypoint removed · ${route.pointsMetres.length} points.`)
  },
  onRouteReverse: (reverse) => {
    routeSession.setDirection(reverse ? -1 : 1)
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus(reverse ? 'Reverse — braking then accel the other way.' : 'Forward.')
  },
  onRouteStressTest: () => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create a route before running the 5-lap check.', true)
      return
    }
    const report = routeSession.runStressTest(5)
    shell.updateRouteStats(routeSession.getStatus())
    shell.setStatus(report.note, !report.ok)
  },
  onRouteChaseCamera: (enabled) => {
    // Free drive owns the chase cam — ignore toggles while driving.
    if (freeDriveSession.isEnabled()) {
      applyChaseCamera(true)
      shell.setChaseCameraEnabled(true)
      shell.setStatus('Chase camera stays on during free drive.', true)
      return
    }
    if (enabled) {
      routeEdit?.setEnabled(false)
      shell.setRouteEditEnabled(false)
    }
    applyChaseCamera(enabled)
    const route = routeSession.getRoute()
    if (route) route.chaseCamera = enabled
    shell.setStatus(
      enabled
        ? 'Chase camera on — drag viewport to orbit, scroll to zoom. Free camera is released.'
        : 'Chase camera off.',
    )
  },
  onRouteChaseOrbit: (orbit) => {
    chaseCamera.setOrbit(orbit, true)
    const route = routeSession.getRoute()
    if (route) {
      route.chaseOrbitYawDeg = orbit.yawDeg
      route.chaseOrbitPitchDeg = orbit.pitchDeg
      route.chaseDistance = orbit.distance
      route.chaseLookAhead = orbit.lookAhead
      route.chaseLookSide = orbit.lookSide
    }
  },
  onRouteChasePreset: (preset) => {
    if (!(preset in CHASE_ORBIT_PRESETS)) return
    chaseCamera.applyPreset(preset as ChaseOrbitPreset)
    const orbit = chaseCamera.getOrbitState()
    shell.setChaseOrbit(orbit)
    const route = routeSession.getRoute()
    if (route) {
      route.chaseOrbitYawDeg = orbit.yawDeg
      route.chaseOrbitPitchDeg = orbit.pitchDeg
      route.chaseDistance = orbit.distance
      route.chaseLookAhead = orbit.lookAhead
      route.chaseLookSide = orbit.lookSide
      route.chaseCamera = true
    }
    if (!chaseCamera.isEnabled()) {
      applyChaseCamera(true)
      shell.setChaseCameraEnabled(true)
    }
    shell.setStatus(`Chase view: ${CHASE_ORBIT_PRESETS[preset as ChaseOrbitPreset].label}`)
  },
  onRouteOvalScale: (scale) => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create a demo oval before changing its size.', true)
      return
    }
    if (!routeSession.isClosed() || routeSession.getRoute()?.ovalScale == null) {
      shell.setStatus('Oval size only applies to a demo oval — use Scale path for custom shapes.', true)
      return
    }
    const travelled = routeSession.getStatus().distanceMetres
    const prevLen = routeSession.getLengthMetres()
    const frac = prevLen > 0 ? (((travelled % prevLen) + prevLen) % prevLen) / prevLen : 0
    const route = routeSession.setOvalScale(scale)
    if (!route) return
    store.dispatch(setRoute({ ...route }))
    applyRouteTransportDuration()
    const len = routeSession.getLengthMetres()
    const mps = speedKmhToMetresPerSecond(route.speedKmh)
    if (len > 0 && mps > 0) {
      transport.seek((frac * len) / mps)
      routeSession.seekDistance(frac * len)
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteOpenScale: (scale) => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create an open path before changing its size.', true)
      return
    }
    if (routeSession.isClosed() || routeSession.getRoute()?.openScale == null) {
      shell.setStatus('Open size only applies to a demo open path — use Scale path for custom shapes.', true)
      return
    }
    const travelled = routeSession.getStatus().distanceMetres
    const prevLen = routeSession.getLengthMetres()
    const frac = prevLen > 0 ? Math.max(0, Math.min(1, travelled / prevLen)) : 0
    const route = routeSession.setOpenScale(scale)
    if (!route) return
    store.dispatch(setRoute({ ...route }))
    applyRouteTransportDuration()
    const len = routeSession.getLengthMetres()
    const mps = speedKmhToMetresPerSecond(route.speedKmh)
    if (len > 0 && mps > 0) {
      transport.seek((frac * len) / mps)
      routeSession.seekDistance(frac * len)
    }
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRoutePathScaleBegin: () => {
    if (!routeSession.isEnabled()) return
    routeSession.beginPathScale()
  },
  onRoutePathScale: (factor) => {
    if (!routeSession.isEnabled()) {
      shell.setStatus('Create a route before scaling the path.', true)
      return
    }
    const route = routeSession.applyPathScale(factor)
    if (!route) return
    applyRouteTransportDuration()
    const status = routeSession.getStatus()
    const mps = speedKmhToMetresPerSecond(status.speedKmh || 18)
    if (status.lengthMetres > 0 && mps > 0) {
      transport.seek(status.distanceMetres / mps)
    }
    routeSession.seekDistance(status.distanceMetres)
    shell.updateRouteStats(status)
  },
  onRoutePathScaleEnd: () => {
    routeSession.endPathScale()
    const route = routeSession.getRoute()
    if (route) store.dispatch(setRoute({ ...route }))
    shell.updateRouteStats(routeSession.getStatus())
  },
  onRouteEditPath: (enabled) => {
    if (!routeSession.isEnabled()) {
      shell.setRouteEditEnabled(false)
      shell.setStatus('Create a demo oval before editing the path.', true)
      return
    }
    if (enabled) {
      applyChaseCamera(false)
      const route = routeSession.getRoute()
      if (route) route.chaseCamera = false
      if (studioRenderer) {
        studioRenderer.setOrbitEnabled(false)
        shell.setOrbitEnabled(false)
      }
    }
    routeEdit?.setEnabled(enabled)
    shell.setRouteEditEnabled(enabled)
    shell.setStatus(
      enabled
        ? 'Edit path — drag beige waypoints. Car and tires stay on the spline.'
        : 'Path editing off.',
    )
  },
  onFreeDriveEnabled: (enabled) => {
    if (enabled && !vehicleSession.getPlacementRoot()) {
      shell.setFreeDriveEnabled(false)
      shell.setStatus('Import a vehicle before free drive.', true)
      return
    }
    if (enabled) {
      routeEdit?.setEnabled(false)
      shell.setRouteEditEnabled(false)
      routeSession.clearRoute()
      transport.pause()
      vehicleSession.stopClip()
      objectInspector.setPickEnabled(false)
      hotspotSession.setPickMeshMode(false)
    }
    const prev = store.getSnapshot().project.freeDrive
    store.dispatch(
      patchFreeDrive({
        ...prev,
        enabled,
        chaseCamera: true,
      }),
    )
    applyFreeDriveFromStore()
    if (enabled) {
      // Re-bind wheels from manifesto/model exactly like oval route.
      syncRouteVehicle()
      // Always launch from stage centre, even if a route left the car elsewhere.
      freeDriveSession.resetToOrigin()
      focusDriveViewport()
      const wheels = freeDriveSession.getStatus().bindingCount
      shell.setStatus(
        wheels > 0
          ? `Free drive — WASD. ${wheels} wheel(s) from rig (same as oval).`
          : 'Free drive on, but no rig wheels bound. Import *-rigged.glb + manifesto (same file as oval tire roll).',
        wheels === 0,
      )
    } else {
      driveKeys.clear()
      freeDriveSession.resetToOrigin()
      shell.updateRouteStats(routeSession.getStatus())
      shell.setStatus('Free drive off — car back at stage centre.')
    }
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
  onSemanticAction: (id) => {
    const ok = vehicleSession.playSemanticAction(id)
    shell.setStatus(ok ? `Action: ${id}` : `Action failed: ${id}`, !ok)
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
  onAddHotspot: () => {
    const project = store.getSnapshot().project
    const index = project.hotspots.length + 1
    const hotspot: Hotspot = {
      id: crypto.randomUUID(),
      name: `Hotspot ${index}`,
      markerLabel: String(index),
      anchor: {
        assetFingerprint: vehicleSession.getRig()?.assetFingerprint ?? '',
        node: {},
        localPosition: [0, 1.2, 0],
        localNormal: [0, 1, 0],
        offset: 0.05,
        fallbackVehicleCoordinate: [0, 1.2, 0],
      },
      blocks: [{ type: 'title', text: `Hotspot ${index}` }],
      actions: [],
      exploreVisible: true,
      closeBehavior: 'keep-state',
    }
    store.dispatch(upsertHotspot(hotspot))
    hotspotSession.select(hotspot.id)
    shell.setStatus(`Added ${hotspot.name} at vehicle center (no mesh). Use Pick mesh / door to attach.`)
  },
  onPickHotspotMesh: () => {
    if (!vehicleSession.getPlacementRoot()) {
      shell.setStatus('Import a vehicle before picking a mesh.', true)
      return
    }
    const next = !hotspotSession.isPickMeshMode()
    hotspotSession.setPickMeshMode(next)
    if (next) objectInspector.setPickEnabled(false)
    shell.setStatus(
      next
        ? 'Pick mode — click a door or body panel in the viewport. Esc cancels.'
        : 'Pick mode cancelled.',
    )
  },
  onAttachHotspotNode: (nodeName) => {
    const placement = vehicleSession.getPlacementRoot()
    if (!placement) {
      shell.setStatus('Import a vehicle first.', true)
      return
    }
    const candidates = hotspotSession.listDoorCandidates()
    const match = candidates.find((c) => c.name === nodeName)
    if (!match) {
      shell.setStatus(`Node not found: ${nodeName}`, true)
      return
    }
    // Trigger the same path as a viewport pick by synthesizing via pick callback machinery.
    hotspotSession.setPickMeshMode(false)
    createHotspotOnNode(nodeName)
  },
  onSelectHotspot: (id) => hotspotSession.select(id),
  onDeleteHotspot: (id) => {
    store.dispatch(removeHotspot(id))
    hotspotCard.close()
    shell.setHotspotEditor(null, [])
    shell.setStatus('Hotspot deleted.')
  },
  onHotspotTitle: (id, title) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotTitle(hotspot, title)))
  },
  onHotspotBody: (id, body) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotBody(hotspot, body)))
  },
  onHotspotDoorAction: (id, actionId) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotDoorAction(hotspot, actionId)))
    shell.setStatus(
      actionId
        ? `Hotspot will play “${actionId}” when opened.`
        : 'Door action cleared.',
    )
  },
  onHotspotVideo: async (id, file) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    const assetId = crypto.randomUUID()
    await idbPutAssetBlob(assetId, file, { filename: file.name })
    store.dispatch(
      upsertAsset({
        id: assetId,
        role: 'video',
        filename: file.name,
        byteSize: file.size,
        blobKey: assetId,
      }),
    )
    store.dispatch(upsertHotspot(withHotspotVideo(hotspot, assetId)))
    shell.setStatus(`Video attached: ${file.name}`)
    refreshHotspotEditor()
  },
  onHotspotClearVideo: (id) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotVideo(hotspot, null)))
    shell.setStatus('Video cleared.')
  },
  onHotspotTest: (id) => {
    hotspotSession.select(id)
  },
  onCaptureShot: () => {
    if (!studioRenderer) return
    const { camera, controls } = studioRenderer
    const index = store.getSnapshot().project.shots.length + 1
    const shot: Shot = {
      id: crypto.randomUUID(),
      name: `Shot ${index}`,
      holdSeconds: 2,
      transitionSeconds: 1,
      cameraPosition: camera.position.toArray(),
      cameraTarget: controls.target.toArray(),
      fov: camera.fov,
    }
    store.dispatch(upsertShot(shot))
    shell.setStatus(`Captured ${shot.name}.`)
  },
  onGoToShot: (id) => {
    const shot = store.getSnapshot().project.shots.find((item) => item.id === id)
    if (!shot || !studioRenderer) return
    applyShot(shot)
    shell.setStatus(`Camera moved to ${shot.name}.`)
  },
  onDeleteShot: (id) => {
    store.dispatch(removeShot(id))
    shell.setStatus('Shot deleted.')
  },
  onStagePatch: (patch) => {
    store.dispatch(patchStage(patch))
  },
  onAccentLightsPatch: (patch) => {
    store.dispatch(patchAccentLights(patch))
  },
  onVehicleLightsPatch: (patch) => {
    store.dispatch(patchVehicleLights(patch))
  },
  onVehicleLightAssignSelected: (groupId) => {
    const model = vehicleSession.getModelRoot()
    const node = objectInspector.getSelectedObject()
    if (!model || !node) {
      shell.setStatus('Select a mesh in Objects first.', true)
      return
    }
    const target = vehicleSession
      .getLights()
      .makeTargetFromObject(node, objectInspector.getSelectedMaterialIndex())
    if (!target) {
      shell.setStatus('Selected object is not a mesh with a standard material.', true)
      return
    }
    const vl = store.getSnapshot().project.vehicleLights
    const prev = vl.targets[groupId] ?? []
    const nextTargets = {
      ...vl.targets,
      [groupId]: [...prev, target],
    }
    store.dispatch(patchVehicleLights({ targets: nextTargets }))
    shell.setStatus(`Assigned ${node.name || 'mesh'} → ${groupId}`)
  },
  onVehicleLightClearGroup: (groupId) => {
    const vl = store.getSnapshot().project.vehicleLights
    const nextTargets = { ...vl.targets }
    delete nextTargets[groupId]
    store.dispatch(patchVehicleLights({ targets: nextTargets }))
    shell.setStatus(`${groupId}: manual targets cleared (auto-detect again).`)
  },
  onVehicleLightClearAllTargets: () => {
    store.dispatch(patchVehicleLights({ targets: {} }))
    shell.setStatus('All manual lamp targets cleared.')
  },
  onVehicleLightSequence: (sequenceId) => {
    const ok = vehicleSession.getLights().playSequence(sequenceId)
    shell.setStatus(ok ? `Playing ${sequenceId} sequence…` : 'No vehicle lights to animate.', !ok)
  },
  onStageTexture: async (surface, map, file) => {
    const stage = store.getSnapshot().project.stage
    const current = stage[surface]
    if (map === 'clear') {
      store.dispatch(
        patchStage({
          [surface]: { ...current, maps: {} },
        }),
      )
      shell.setStatus(`${surface} maps cleared.`)
      return
    }
    if (!file) return
    const assetId = crypto.randomUUID()
    await idbPutAssetBlob(assetId, file, { filename: file.name })
    store.dispatch(
      upsertAsset({
        id: assetId,
        role: 'image',
        filename: file.name,
        byteSize: file.size,
        blobKey: assetId,
      }),
    )
    const mapKey =
      map === 'map'
        ? 'mapAssetId'
        : map === 'normal'
          ? 'normalMapAssetId'
          : map === 'roughness'
            ? 'roughnessMapAssetId'
            : map === 'metalness'
              ? 'metalnessMapAssetId'
              : map === 'displacement'
                ? 'displacementMapAssetId'
                : map === 'ao'
                  ? 'aoMapAssetId'
                  : 'emissiveMapAssetId'
    store.dispatch(
      patchStage({
        [surface]: {
          ...current,
          maps: { ...current.maps, [mapKey]: assetId },
        },
      }),
    )
    shell.setStatus(`${surface} ${map} map: ${file.name}`)
  },
  onObjectSelect: (id) => {
    objectInspector.selectById(id)
    refreshObjectInspector()
  },
  onObjectVisible: (id, visible) => {
    objectInspector.setVisible(id, visible)
    refreshObjectInspector()
    // Persist visibility when a material slot is selected on that node.
    if (objectInspector.getSelectedId() === id) commitSelectedMaterialOverride()
  },
  onObjectPickMode: (enabled) => {
    objectInspector.setPickEnabled(enabled)
    if (enabled) hotspotSession.setPickMeshMode(false)
  },
  onObjectMaterialIndex: (index) => {
    objectInspector.setMaterialIndex(index)
    refreshObjectInspector()
  },
  onObjectMaterialPatch: (patch) => {
    objectInspector.patchMaterial(patch as Partial<MaterialEditState>)
    // Keep sliders in sync without rebuilding the whole tree.
    const state = objectInspector.getMaterialEdit()
    shell.updateObjectMaterial(
      state,
      objectInspector.listMaterials(),
      objectInspector.getSelectedMaterialIndex(),
    )
  },
  onObjectMaterialCommit: () => {
    commitSelectedMaterialOverride()
  },
  onMaterialPick: (meshId, slot) => {
    objectInspector.selectMaterial(meshId, slot)
    refreshObjectInspector()
  },
  onVehiclePolishMode: (mode) => {
    void (async () => {
      if (!store.getSnapshot().project.vehicle) return
      store.dispatch(setVehiclePolishMode(mode))
      vehicleSession.setAuthoring({ polishMode: mode })
      try {
        const reloaded = await vehicleSession.reloadActiveVariant((ratio, label) => {
          shell.setImportProgress(ratio, label)
        })
        if (reloaded) {
          store.dispatch(setActiveVehicle(reloaded.vehicle, reloaded.asset))
          syncRouteVehicle()
          shell.updateVehicle(vehicleSession.getSnapshot())
          refreshObjectInspector()
        }
        shell.setStatus(mode === 'off' ? 'Auto polish disabled.' : 'Auto polish enabled.')
      } catch (err) {
        shell.setStatus(
          `Polish mode saved, reload failed: ${err instanceof Error ? err.message : String(err)}`,
          true,
        )
      }
    })()
  },
})

function commitSelectedMaterialOverride() {
  const model = vehicleSession.getModelRoot() ?? vehicleSession.getPlacementRoot()
  const node = objectInspector.getSelectedObject()
  const edit = objectInspector.getMaterialEdit()
  if (!model || !node || !edit || !store.getSnapshot().project.vehicle) return
  const slot = objectInspector.getSelectedMaterialIndex()
  const ref = refFromObject(model, node)
  const path = ref.path || ref.name || node.uuid
  const entry: MaterialNodeOverride = {
    id: `${path}#${slot}`,
    node: ref,
    materialSlot: slot,
    materialName: edit.name || undefined,
    scope: 'shared-material',
    props: {
      visible: node.visible,
      color: edit.color,
      metalness: edit.metalness,
      roughness: edit.roughness,
      emissive: edit.emissive,
      emissiveIntensity: edit.emissiveIntensity,
      opacity: edit.opacity,
      transparent: edit.transparent,
      envMapIntensity: edit.envMapIntensity,
      clearcoat: edit.clearcoat,
      clearcoatRoughness: edit.clearcoatRoughness,
      transmission: edit.transmission,
    },
  }
  store.dispatch(upsertMaterialOverride(entry))
  vehicleSession.setAuthoring({
    materialOverrides: store.getSnapshot().project.vehicle?.materialOverrides ?? [entry],
  })
  shell.setStatus(`Material saved: ${edit.name}`)
}

function refreshObjectInspector() {
  const tree = objectInspector.listTree()
  const selectedId = objectInspector.getSelectedId()
  const slot = objectInspector.getSelectedMaterialIndex()
  shell.updateObjectTree(tree, selectedId)
  shell.updateObjectMaterial(objectInspector.getMaterialEdit(), objectInspector.listMaterials(), slot)
  const mats = objectInspector.listUniqueMaterials()
  const selectedKey = selectedId != null ? `${selectedId}::${slot}` : null
  shell.updateMaterialList(mats, selectedKey)
}

const hotspotCard = mountHotspotCard(shell.viewportHost, {
  onRunAction: (action) => {
    const ok = runHotspotAction(action, {
      playSemanticAction: (id) => vehicleSession.playSemanticAction(id),
      goToShot: (shotId) => {
        const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId)
        if (shot) applyShot(shot)
      },
      setEnvironmentPreset: (presetId) => {
        store.dispatch(setEnvironmentPreset(presetId as EnvironmentPresetId))
      },
      setVehicleLight: (groupId, on) => {
        store.dispatch(
          patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }),
        )
      },
      toggleVehicleLight: (groupId) => {
        const cur = store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
        store.dispatch(
          patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: !cur } }),
        )
      },
      playVehicleLightSequence: (sequenceId) => {
        vehicleSession.getLights().playSequence(sequenceId as 'welcome' | 'farewell')
      },
    })
    if (action.type === 'action.play' || action.type === 'action.toggle') {
      shell.setStatus(ok ? `Action: ${action.actionId}` : `Action failed: ${action.actionId}`, !ok)
      shell.updateVehicle(vehicleSession.getSnapshot())
    }
  },
  resolveActionLabel: (action) => {
    if (action.type !== 'action.play' && action.type !== 'action.toggle') return null
    return (
      vehicleSession.getSemanticActions().find((a) => a.id === action.actionId)?.label ?? null
    )
  },
})

function refreshHotspotNodeList() {
  shell.setHotspotNodes(hotspotSession.listDoorCandidates())
}

function refreshHotspotEditor() {
  const id = hotspotSession.getSelectedId()
  const hotspot = id
    ? store.getSnapshot().project.hotspots.find((h) => h.id === id) ?? null
    : null
  const doorActions = vehicleSession.getSemanticActions().map((a) => ({
    id: a.id,
    label: a.label,
  }))
  let videoLabel: string | null = null
  if (hotspot) {
    const videoId = hotspotVideoAssetId(hotspot)
    if (videoId) {
      videoLabel =
        store.getSnapshot().project.assets.find((a) => a.id === videoId)?.filename ?? null
    }
  }
  shell.setHotspotEditor(hotspot, doorActions, { videoLabel })
}

function openHotspot(hotspot: Hotspot) {
  runHotspotActions(hotspot, (action) => {
    runHotspotAction(action, {
      playSemanticAction: (id) => vehicleSession.playSemanticAction(id),
      goToShot: (shotId) => {
        const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId)
        if (shot) applyShot(shot)
      },
      setEnvironmentPreset: (presetId) => {
        store.dispatch(setEnvironmentPreset(presetId as EnvironmentPresetId))
      },
      setVehicleLight: (groupId, on) => {
        store.dispatch(
          patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }),
        )
      },
      toggleVehicleLight: (groupId) => {
        const cur = store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
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
  shell.updateVehicle(vehicleSession.getSnapshot())
  refreshHotspotEditor()
}

function createHotspotFromPick(result: {
  ref: { name?: string; path?: string; iomId?: string }
  localPosition: [number, number, number]
  localNormal: [number, number, number]
  fallbackVehicleCoordinate?: [number, number, number]
}) {
  const project = store.getSnapshot().project
  const index = project.hotspots.length + 1
  const nodeLabel = result.ref.name || result.ref.path || 'mesh'
  const hotspot: Hotspot = {
    id: crypto.randomUUID(),
    name: nodeLabel.replace(/_/g, ' ').slice(0, 40) || `Hotspot ${index}`,
    markerLabel: String(index),
    anchor: {
      assetFingerprint: vehicleSession.getRig()?.assetFingerprint ?? '',
      node: { ...result.ref },
      localPosition: result.localPosition,
      localNormal: result.localNormal,
      offset: 0.08,
      fallbackVehicleCoordinate: result.fallbackVehicleCoordinate,
    },
    blocks: [
      { type: 'eyebrow', text: nodeLabel },
      { type: 'title', text: nodeLabel.replace(/_/g, ' ') },
      { type: 'richtext', markdown: `Attached to **${nodeLabel}**. Marker follows this node when doors or panels animate.` },
    ],
    actions: [],
    exploreVisible: true,
    closeBehavior: 'keep-state',
  }
  store.dispatch(upsertHotspot(hotspot))
  hotspotSession.select(hotspot.id)
  shell.setStatus(`Hotspot attached to ${nodeLabel}.`)
}

function createHotspotOnNode(nodeName: string) {
  const placement = vehicleSession.getPlacementRoot()
  if (!placement) return
  const model =
    placement.getObjectByName('VehicleActionRoot')?.children[0] ?? placement
  const node = findNamedNode(model, nodeName)
  if (!node) {
    shell.setStatus(`Could not resolve node ${nodeName}`, true)
    return
  }
  const local = defaultLocalAnchorOnNode(node)
  createHotspotFromPick({
    ref: refFromObject(model, node),
    localPosition: local.localPosition,
    localNormal: local.localNormal,
    fallbackVehicleCoordinate: [0, 1.2, 0],
  })
}

function syncRouteVehicle() {
  routeSession.setVehicle(
    vehicleSession.getPlacementRoot(),
    vehicleSession.getRig(),
    vehicleSession.getActionRoot(),
    vehicleSession.getModelRoot(),
  )
  freeDriveSession.setVehicle(
    vehicleSession.getPlacementRoot(),
    vehicleSession.getRig(),
    vehicleSession.getActionRoot(),
    vehicleSession.getModelRoot(),
  )
  hotspotSession.setVehiclePlacement(vehicleSession.getPlacementRoot())
  objectInspector.setRoot(vehicleSession.getPlacementRoot())
  applyVehicleLightsFromStore()
  refreshObjectInspector()
  refreshHotspotNodeList()
  if (freeDriveSession.isEnabled()) {
    shell.updateRouteStats(freeDriveSession.getStatus())
  } else {
    shell.updateRouteStats(routeSession.getStatus())
  }
}

function applyFreeDriveFromStore() {
  const state = store.getSnapshot().project.freeDrive
  freeDriveSession.applyState({ ...state, chaseCamera: true })
  shell.setFreeDriveEnabled(state.enabled)
  shell.setChaseLockedForFreeDrive(state.enabled)
  studioRenderer?.setInfiniteFloor(state.enabled)
  if (state.enabled) {
    syncRouteVehicle()
    freeDriveSession.setCruiseKmh(state.cruiseKmh)
    freeDriveSession.setAccelMps2(state.accelMps2)
    freeDriveSession.setBrakeMps2(state.brakeMps2)
    freeDriveSession.setMaxSteerDegrees(state.maxSteerDeg)
    freeDriveSession.setMaxBodyRollDegrees(0)
    freeDriveSession.setTireRollRate(state.tireRollRate)
    // Always follow the car in free drive — chase is not optional here.
    applyChaseCamera(true)
    shell.updateRouteStats(freeDriveSession.getStatus())
  } else {
    studioRenderer?.setInfiniteFloor(false)
    shell.updateRouteStats(routeSession.getStatus())
  }
}

function disableFreeDriveForRoute() {
  if (!freeDriveSession.isEnabled() && !store.getSnapshot().project.freeDrive?.enabled) return
  freeDriveSession.setEnabled(false)
  studioRenderer?.setInfiniteFloor(false)
  shell.setFreeDriveEnabled(false)
  shell.setChaseLockedForFreeDrive(false)
  driveKeys.clear()
  // setRoute will also clear freeDrive.enabled when a route is saved.
}

function applyVehicleLightsFromStore() {
  const vl = store.getSnapshot().project.vehicleLights
  vehicleSession.getLights().apply(vl)
  studioRenderer?.applyBloom(vl)
  shell.updateVehicleLightCounts(vehicleSession.getLights().getBoundCounts())
  shell.updateVehicleLightBindings(vehicleSession.getLights().getBoundTargets())
}

function applyShot(shot: Shot) {
  if (!studioRenderer || !shot.cameraPosition) return
  applyChaseCamera(false)
  const route = routeSession.getRoute()
  if (route) route.chaseCamera = false
  studioRenderer.setOrbitEnabled(false)
  shell.setOrbitEnabled(false)
  studioRenderer.camera.position.fromArray(shot.cameraPosition)
  if (shot.cameraTarget) studioRenderer.controls.target.fromArray(shot.cameraTarget)
  if (shot.fov != null) {
    studioRenderer.camera.fov = shot.fov
    studioRenderer.camera.updateProjectionMatrix()
  }
  studioRenderer.camera.lookAt(studioRenderer.controls.target)
  studioRenderer.controls.update()
}

function hydrateProjectRuntime() {
  const project = store.getSnapshot().project
  routeSession.setRoute(project.route, { resetProgress: true })
  hotspotSession.syncFromProject(project.hotspots)
  if (project.freeDrive?.enabled && !project.route) {
    applyFreeDriveFromStore()
  } else if (project.route) {
    freeDriveSession.setEnabled(false)
    studioRenderer?.setInfiniteFloor(false)
    shell.setFreeDriveEnabled(false)
    chaseCamera.setOrbit({
      yawDeg: project.route.chaseOrbitYawDeg ?? chaseCamera.orbitYawDeg,
      pitchDeg: project.route.chaseOrbitPitchDeg ?? chaseCamera.orbitPitchDeg,
      distance: project.route.chaseDistance ?? chaseCamera.distance,
      lookAhead: project.route.chaseLookAhead ?? chaseCamera.lookAhead,
      lookSide: project.route.chaseLookSide ?? chaseCamera.lookSide,
    }, true)
    shell.setChaseOrbit(chaseCamera.getOrbitState())
    applyRouteTransportDuration()
    applyChaseCamera(Boolean(project.route.chaseCamera))
    shell.updateRouteStats(routeSession.getStatus())
  } else {
    freeDriveSession.setEnabled(false)
    studioRenderer?.setInfiniteFloor(false)
    shell.setFreeDriveEnabled(false)
    applyChaseCamera(false)
    shell.updateRouteStats(routeSession.getStatus())
  }
}

async function rehydrateVehicleAfterHistory() {
  hydrateProjectRuntime()
  const project = store.getSnapshot().project
  const wantId = project.activeVehicleId ?? project.vehicle?.assetId ?? null
  const sceneEmpty = !vehicleSession.getPlacementRoot()
  if (wantId && sceneEmpty) {
    try {
      const restored = await vehicleSession.restoreFromProject(project)
      if (restored) {
        syncRouteVehicle()
        shell.updateVehicle(vehicleSession.getSnapshot())
        shell.setStatus('Restored vehicle after Undo/Redo.')
      }
    } catch (err) {
      shell.setStatus(
        `Undo restored metadata, but vehicle blob missing: ${err instanceof Error ? err.message : String(err)}`,
        true,
      )
    }
  } else if (!wantId && !sceneEmpty) {
    vehicleSession.clearActiveVehicle()
    routeSession.setVehicle(null, null)
    freeDriveSession.setVehicle(null, null)
    freeDriveSession.setEnabled(false)
    studioRenderer?.setInfiniteFloor(false)
    shell.updateVehicle(vehicleSession.getSnapshot())
  }
}

function applyChaseCamera(enabled: boolean) {
  chaseCamera.setEnabled(enabled)
  shell.setChaseCameraEnabled(enabled)
  if (enabled && studioRenderer) {
    studioRenderer.setOrbitEnabled(false)
    shell.setOrbitEnabled(false)
  }
}

function applyRouteTransportDuration() {
  const route = routeSession.getRoute()
  if (!route) return
  const len = routeSession.getLengthMetres()
  const mps = speedKmhToMetresPerSecond(route.speedKmh)
  transport.setDuration(mps > 0 && len > 0 ? len / mps : 10)
  transport.setLoop(Boolean(route.closed))
  transport.setAutoAdvance(false)
}

store.subscribe((snap) => {
  shell.updateStore(snap)
  studioRenderer?.applyEnvironmentState(snap.project.environment)
  studioRenderer?.applyStageState(snap.project.stage)
  studioRenderer?.applyAccentLights(snap.project.accentLights)
  vehicleSession.getLights().apply(snap.project.vehicleLights)
  studioRenderer?.applyBloom(snap.project.vehicleLights)
  shell.updateVehicleLightCounts(vehicleSession.getLights().getBoundCounts())
  shell.updateVehicleLightBindings(vehicleSession.getLights().getBoundTargets())
  hotspotSession.syncFromProject(snap.project.hotspots)
  refreshHotspotEditor()

  if (!bootComplete || !snap.dirty) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    void persistProject({ reason: 'auto' })
      .then(({ json }) => {
        shell.setStatus(`Autosaved (${json.name || json.id.slice(0, 8)})`)
      })
      .catch((err) => {
        shell.setStatus(`Autosave failed: ${err instanceof Error ? err.message : String(err)}`, true)
      })
  }, AUTOSAVE_MS)
})
transport.subscribe((snap) => shell.updateTransport(snap))
shell.updateStore(store.getSnapshot())
shell.updateTransport(transport.getSnapshot())
shell.updateVehicle(vehicleSession.getSnapshot())

function syncFreeDriveInput() {
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

/** Ignore WASD only while typing in real text fields — not checkboxes / sliders. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (!(target instanceof HTMLInputElement)) return false
  const type = (target.type || 'text').toLowerCase()
  return (
    type === 'text' ||
    type === 'search' ||
    type === 'password' ||
    type === 'email' ||
    type === 'url' ||
    type === 'number' ||
    type === 'tel'
  )
}

function focusDriveViewport() {
  const canvas = studioRenderer?.canvas
  if (!canvas) return
  // Drop focus from Route checkboxes so WASD reaches the window listener.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  canvas.focus({ preventScroll: true })
}

window.addEventListener('keyup', (e) => {
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
    driveKeys.delete(e.code)
    if (freeDriveSession.isEnabled()) syncFreeDriveInput()
  }
})
window.addEventListener('blur', () => {
  driveKeys.clear()
  syncFreeDriveInput()
})

window.addEventListener(
  'keydown',
  (e) => {
    const meta = e.ctrlKey || e.metaKey
    const typing = isTypingTarget(e.target)

    if (!typing && freeDriveSession.isEnabled()) {
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
        syncFreeDriveInput()
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        driveKeys.clear()
        syncFreeDriveInput()
        return
      }
    }

    if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
      void rehydrateVehicleAfterHistory()
    } else if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault()
      store.redo()
      void rehydrateVehicleAfterHistory()
    } else if (e.code === 'Space' && !typing) {
      e.preventDefault()
      const snap = transport.getSnapshot()
      if (snap.playing) transport.pause()
      else transport.play()
    } else if (e.key === 'Escape' && hotspotSession.isPickMeshMode()) {
      e.preventDefault()
      hotspotSession.setPickMeshMode(false)
      shell.setStatus('Pick mode cancelled.')
    } else if (e.key === 'Escape' && objectInspector.getSelectedId()) {
      e.preventDefault()
      objectInspector.select(null)
      refreshObjectInspector()
      shell.setStatus('Object deselected.')
    } else if (e.key === 'Escape' && mode === 'preview') {
      mode = 'studio'
      shell.setModeLabel(mode)
      shell.setStatus('Exited Preview.')
    }
  },
  true,
)

async function boot() {
  const renderer = await createStudioRenderer(shell.viewportHost)
  studioRenderer = renderer
  vehicleSession.bindScene(renderer.scene, renderer.camera, renderer.renderer, renderer.controls)
  routeSession.bind(renderer.scene, (metres) => {
    renderer.setFloorSize(metres)
    const current = store.getSnapshot().project.stage.floorSize
    if (metres > current + 0.5) {
      store.dispatch(patchStage({ floorSize: metres }), { recordHistory: false })
    }
  })
  chaseCamera.bind(renderer.camera, renderer.controls, renderer.canvas)
  hotspotSession.bind(
    renderer.scene,
    vehicleSession.getPlacementRoot(),
    renderer.camera,
    renderer.canvas,
  )
  objectInspector.bind(
    renderer.scene,
    vehicleSession.getPlacementRoot(),
    renderer.camera,
    renderer.canvas,
  )
  objectInspector.setOnSelectionChange(() => refreshObjectInspector())
  refreshObjectInspector()
  hotspotSession.setOnSelect((hotspot) => {
    if (hotspot) openHotspot(hotspot)
    else {
      hotspotCard.close()
      refreshHotspotEditor()
    }
  })
  hotspotSession.setOnPickMesh((result) => {
    createHotspotFromPick(result)
  })
  refreshHotspotNodeList()
  chaseCamera.setOnOrbitChange((orbit) => {
    shell.setChaseOrbit(orbit)
    const route = routeSession.getRoute()
    if (route) {
      route.chaseOrbitYawDeg = orbit.yawDeg
      route.chaseOrbitPitchDeg = orbit.pitchDeg
      route.chaseDistance = orbit.distance
      route.chaseLookAhead = orbit.lookAhead
      route.chaseLookSide = orbit.lookSide
    }
  })
  routeEdit = new RouteEditController(routeSession, renderer.camera, renderer.canvas)
  const syncRouteAfterEdit = () => {
    applyRouteTransportDuration()
    const status = routeSession.getStatus()
    const mps = speedKmhToMetresPerSecond(status.speedKmh || 18)
    if (status.lengthMetres > 0 && mps > 0) {
      transport.seek(status.distanceMetres / mps)
    }
    routeSession.seekDistance(status.distanceMetres)
    shell.updateRouteStats(status)
  }
  routeEdit.setOnChange(() => syncRouteAfterEdit())
  routeEdit.setOnCommit(() => {
    const route = routeSession.getRoute()
    if (route) store.dispatch(setRoute({ ...route }))
    syncRouteAfterEdit()
  })
  shell.setRendererInfo(renderer)
  shell.updateRouteStats(routeSession.getStatus())
  const existingRoute = store.getSnapshot().project.route
  if (existingRoute) {
    chaseCamera.setOrbit(
      {
        yawDeg: existingRoute.chaseOrbitYawDeg ?? chaseCamera.orbitYawDeg,
        pitchDeg: existingRoute.chaseOrbitPitchDeg ?? chaseCamera.orbitPitchDeg,
        distance: existingRoute.chaseDistance ?? chaseCamera.distance,
        lookAhead: existingRoute.chaseLookAhead ?? chaseCamera.lookAhead,
        lookSide: existingRoute.chaseLookSide ?? chaseCamera.lookSide,
      },
      true,
    )
    shell.setChaseOrbit(chaseCamera.getOrbitState())
    if (existingRoute.chaseCamera) applyChaseCamera(true)
  } else {
    shell.setChaseOrbit(chaseCamera.getOrbitState())
  }
  renderer.applyEnvironmentState(store.getSnapshot().project.environment)
  renderer.applyStageState(store.getSnapshot().project.stage)
  renderer.applyAccentLights(store.getSnapshot().project.accentLights)

  const resize = () => {
    const rect = shell.viewportHost.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height)
    renderer.render()
  }
  resize()
  window.addEventListener('resize', resize)
  // Dragging the inspector divider resizes the viewport without a window resize event.
  new ResizeObserver(resize).observe(shell.viewportHost)

  let raf = 0
  let lastRouteStatsAt = 0
  let lastFrameAt = performance.now()
  const _shadowFocus = new Vector3()
  let lastRouteVelocityKmh = 0
  const loop = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastFrameAt) / 1000)
    lastFrameAt = now

    vehicleSession.update()
    const clip = vehicleSession.getClipTime()
    shell.setClipTransport(clip.time, clip.duration, clip.playing)

    if (routeSession.isEnabled()) {
      const route = routeSession.getRoute()
      const ts = transport.getSnapshot()
      if (route) {
        if (ts.playing) {
          routeSession.advance(dt)
          const status = routeSession.getStatus()
          const vel = status.velocityKmh ?? 0
          const braking =
            Math.abs(vel) < Math.abs(lastRouteVelocityKmh) - 0.4 ||
            (Math.abs(vel) < 0.8 && Math.abs(lastRouteVelocityKmh) > 2)
          vehicleSession.getLights().setRouteSignals({
            braking,
            reverse: (status.direction ?? 1) < 0 || vel < -0.5,
          })
          lastRouteVelocityKmh = vel
          const len = routeSession.getLengthMetres()
          if (len > 0 && ts.durationSeconds > 0) {
            const dist = Math.max(0, Math.min(len, status.distanceMetres))
            const frac = route.closed
              ? (((status.distanceMetres % len) + len) % len) / len
              : dist / len
            transport.seek(frac * ts.durationSeconds)
            // Open path finished — pause transport when fully stopped at the end.
            if (
              !route.closed &&
              ((route.direction ?? 1) > 0
                ? dist >= len - 0.02 && Math.abs(status.velocityKmh ?? 0) < 0.15
                : dist <= 0.02 && Math.abs(status.velocityKmh ?? 0) < 0.15)
            ) {
              if (ts.playing) transport.pause()
            }
          }
        } else {
          vehicleSession.getLights().setRouteSignals({ braking: false, reverse: false })
          lastRouteVelocityKmh = 0
          // Scrubber maps nominal lap/path time → distance (linear).
          const len = routeSession.getLengthMetres()
          if (len > 0 && ts.durationSeconds > 0) {
            const t = Math.max(0, Math.min(1, ts.timeSeconds / ts.durationSeconds))
            routeSession.seekDistance(t * len)
          }
        }
      }
      if (now - lastRouteStatsAt > 150) {
        lastRouteStatsAt = now
        shell.updateRouteStats(routeSession.getStatus())
      }
    } else if (freeDriveSession.isEnabled()) {
      // Re-assert held keys every frame (game-style), not only on keydown.
      syncFreeDriveInput()
      freeDriveSession.advance(dt)
      const status = freeDriveSession.getStatus()
      const vel = status.velocityKmh ?? 0
      const braking =
        Math.abs(vel) < Math.abs(lastRouteVelocityKmh) - 0.4 ||
        (status.throttle ?? 0) < -0.05 ||
        (Math.abs(vel) < 0.8 && Math.abs(lastRouteVelocityKmh) > 2)
      vehicleSession.getLights().setRouteSignals({
        braking,
        reverse: vel < -0.5 || (status.throttle ?? 0) < -0.05,
      })
      lastRouteVelocityKmh = vel
      if (now - lastRouteStatsAt > 150) {
        lastRouteStatsAt = now
        shell.updateRouteStats(status)
      }
    }

    chaseCamera.update(
      vehicleSession.getPlacementRoot(),
      dt,
      freeDriveSession.isEnabled()
        ? freeDriveSession.getVisualHeadingYaw()
        : routeSession.getVisualHeadingYaw(),
    )
    hotspotSession.update()

    const placement = vehicleSession.getPlacementRoot()
    if (placement) {
      placement.getWorldPosition(_shadowFocus)
      renderer.updateShadowFocus(_shadowFocus)
      renderer.updateContactShadow(placement)
      if (freeDriveSession.isEnabled()) {
        renderer.updateFloorFollow(_shadowFocus)
      }
    } else {
      renderer.updateShadowFocus(null)
      renderer.updateContactShadow(null)
    }

    renderer.render()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  try {
    const queryId = new URLSearchParams(location.search).get('project')
    const summaries = await idbListProjectSummaries()
    const bootId = resolveBootProjectId({
      queryProjectId: queryId,
      lastProjectId: readLastProjectId(),
      summaries,
    })
    if (bootId) {
      const existing = await idbLoadProject(bootId)
      if (existing) {
        store.loadProject(migrateProject(existing))
        writeLastProjectId(store.getSnapshot().project.id)
        hydrateProjectRuntime()
        shell.setStatus('Restoring vehicle from IndexedDB…')
        try {
          const restored = await vehicleSession.restoreFromProject(
            store.getSnapshot().project,
            (_r, label) => {
              shell.setStatus(label)
            },
          )
          if (restored) {
            routeSession.setVehicle(
              vehicleSession.getPlacementRoot(),
              vehicleSession.getRig(),
              vehicleSession.getActionRoot(),
            )
            hotspotSession.setVehiclePlacement(vehicleSession.getPlacementRoot())
            shell.updateVehicle(vehicleSession.getSnapshot())
            hydrateProjectRuntime()
            shell.setStatus(
              `Restored “${store.getSnapshot().project.name}” and vehicle from IndexedDB.`,
            )
          } else {
            shell.setStatus(
              `Restored “${store.getSnapshot().project.name}”. Import a GLB to populate the stage.`,
            )
          }
        } catch (err) {
          shell.setStatus(
            `Project metadata restored, but vehicle blob missing: ${err instanceof Error ? err.message : String(err)}`,
            true,
          )
        }
      }
    }
  } catch {
    // ignore
  }

  bootComplete = true

  window.addEventListener('beforeunload', (event) => {
    if (store.getSnapshot().dirty) {
      event.preventDefault()
      event.returnValue = ''
    }
    cancelAnimationFrame(raf)
    routeSession.dispose()
    hotspotSession.dispose()
    objectInspector.dispose()
    hotspotCard.dispose()
    // Runtime only — never delete IndexedDB blobs on page unload.
    vehicleSession.dispose()
    renderer.dispose()
    transport.dispose()
  })
}

boot().catch((err) => {
  shell.setStatus(`Renderer boot failed: ${err instanceof Error ? err.message : String(err)}`, true)
})
