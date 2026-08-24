import './ui/styles.css'
import { ensureAutomotiveStudioAccess } from './auth'
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
import { idbSaveProject, idbLoadProject, idbGetAssetBlob, idbPutAssetBlob, idbListProjectSummaries, idbDeleteStudioDatabase, AUTOMOTIVE_STUDIO_IDB_NAME } from './persistence/localDb'
import { purgeOrphanAssetBlobs } from './persistence/assetGc'
import { clearLastProjectId, readLastProjectId, resolveBootProjectId, writeLastProjectId } from './persistence/projectSession'
import {
  BUNDLED_DEFAULT_PROJECT_ID,
  ensureBundledDefaultProject,
} from './persistence/bundledDefault'
import { migrateProject } from './persistence/migrations'
import {
  CYCLORAMA_VIDEO_PRESETS,
  fetchCycloramaVideoPreset,
  fetchFloorPresetFiles,
  FLOOR_PRESETS,
} from './stage/bundledStagePresets'
import type {
  EnvironmentPresetId,
  EnvironmentState,
  ExperienceMode,
  Hotspot,
  MaterialNodeOverride,
  Shot,
  StageSurfaceMaps,
  UiChromeTheme,
  VehicleBeamProxy,
  VehicleLightGroupId,
  VehicleLightsState,
} from './persistence/schema'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { captureViewportThumbnail } from './renderer/captureViewportThumbnail'
import { mountStudioShell } from './ui/studioShell'
import { VehicleSession } from './vehicle/vehicleSession'
import { BeamProxyEditor } from './vehicle/beamProxyEditor'
import { DEFAULT_BEAM_PROXIES } from './vehicle/beamDefaults'
import {
  assignQualityRolesByFileSize,
  findNamedNode,
  inferQualityRoleFromFilename,
  qualityLabel,
  type VehicleQualityRole,
} from './vehicle/qualityVariants'
import { RouteSession } from './route/routeSession'
import { FreeDriveSession } from './route/freeDriveSession'
import {
  ChaseCamera,
  CHASE_ORBIT_PRESETS,
  deriveChaseOrbitFromWorld,
  type ChaseOrbitPreset,
  type ChaseOrbitState,
} from './route/chaseCamera'
import { RouteEditController } from './route/routeEdit'
import { speedKmhToMetresPerSecond } from './route/routeMath'
import { HotspotSession } from './hotspots/hotspotSession'
import { mountHotspotCard, runHotspotAction, runHotspotActions } from './hotspots/hotspotCard'
import {
  hotspotVideoAssetId,
  withHotspotBody,
  withHotspotDoorAction,
  withHotspotMarkerRotation,
  withHotspotMarkerLabelLayout,
  withHotspotMeshVisibility,
  withHotspotTitle,
  withHotspotVideo,
  encodeHotspotMeshKey,
  decodeHotspotMeshKey,
} from './hotspots/hotspotContent'
import { defaultLocalAnchorOnNode, refFromObject, resolveSemanticNode } from './hotspots/resolveAnchor'
import { ObjectInspector } from './vehicle/objectInspector'
import type { MaterialEditState } from './vehicle/objectInspector'

const UI_THEME_KEY = 'iom-automotive-ui-theme'

function readUiTheme(): UiChromeTheme {
  const stored = localStorage.getItem(UI_THEME_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')

await ensureAutomotiveStudioAccess(root)

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
/** When set, the next mesh pick moves this hotspot instead of creating a new one. */
let repositionHotspotId: string | null = null
let routeEdit: RouteEditController | null = null
const beamEditor = new BeamProxyEditor()

let mode: ExperienceMode = 'studio'
let uiTheme = readUiTheme()
let studioRenderer: Awaited<ReturnType<typeof createStudioRenderer>> | null = null
/** Coalesce slider `input` events to one env apply per animation frame. */
let liveEnvPatch: Partial<EnvironmentState> | null = null
let liveEnvRaf = 0
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

async function applyStageTexturePack(
  surface: 'floor' | 'pedestal' | 'cyclorama',
  files: File[],
  setStatus: (message: string, isError?: boolean) => void,
): Promise<void> {
  const { detectPbrMapsFromFiles, summarizeDetectedPbrMaps } = await import('./stage/detectPbrMaps')
  const detected = detectPbrMapsFromFiles(files)
  const slots = Object.keys(detected.files)
  if (slots.length === 0) {
    setStatus(
      `No PBR maps recognised in folder (expect Color / NormalGL / Roughness / Displacement…).`,
      true,
    )
    return
  }
  const stage = store.getSnapshot().project.stage
  const current = stage[surface]
  const nextMaps: (typeof current)['maps'] = {}
  const slotToKey: Record<string, keyof typeof nextMaps> = {
    map: 'mapAssetId',
    normal: 'normalMapAssetId',
    roughness: 'roughnessMapAssetId',
    metalness: 'metalnessMapAssetId',
    displacement: 'displacementMapAssetId',
    ao: 'aoMapAssetId',
    emissive: 'emissiveMapAssetId',
  }
  for (const [slot, file] of Object.entries(detected.files) as Array<
    [keyof typeof detected.files, File]
  >) {
    if (!file) continue
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
    nextMaps[slotToKey[slot]] = assetId
  }
  const autoBreak =
    (current.tileVariation ?? 0) < 0.05
      ? { tileVariation: 0.65, tileSeed: Math.random() * 64 }
      : {}
  const packTune: Partial<(typeof stage)['floor']> = {
    color: '#ffffff',
    normalYFlip: detected.normalYFlip,
  }
  if (detected.files.metalness) packTune.metalness = 1
  else packTune.metalness = 0
  if (detected.files.roughness) packTune.roughness = 1
  if (detected.files.displacement && !(current.displacementScale > 0)) {
    packTune.displacementScale = 0.08
  }
  if (detected.files.map && (current.mapRepeat ?? 1) <= 1.01) {
    packTune.mapRepeat = 8
  }
  store.dispatch(
    patchStage({
      [surface]: {
        ...current,
        ...autoBreak,
        ...packTune,
        maps: nextMaps,
      },
    }),
  )
  setStatus(`${surface} pack replaced · ${summarizeDetectedPbrMaps(detected)}`)
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
    objectInspector.setRoot(null)
    refreshObjectInspector()
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
    liveEnvPatch = liveEnvPatch ? { ...liveEnvPatch, ...patch } : { ...patch }
    if (liveEnvRaf) return
    liveEnvRaf = requestAnimationFrame(() => {
      liveEnvRaf = 0
      const merged = liveEnvPatch
      liveEnvPatch = null
      if (!merged || !studioRenderer) return
      const current = store.getSnapshot().project.environment
      studioRenderer.applyEnvironmentState({
        ...current,
        ...merged,
        basePresetId: current.basePresetId,
        customized: true,
      })
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
    // Free drive owns chase — unless beam gizmo is on (follow is paused for lamp edit).
    if (freeDriveSession.isEnabled() && !beamEditor.isEnabled()) {
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
    const p = CHASE_ORBIT_PRESETS[preset as ChaseOrbitPreset]
    const orbit: ChaseOrbitState = {
      yawDeg: p.yawDeg,
      pitchDeg: p.pitchDeg,
      distance: p.distance,
      lookAhead: p.lookAhead,
      lookSide: 0,
    }
    if (!chaseCamera.isEnabled()) {
      applyChaseCamera(true)
      shell.setChaseCameraEnabled(true)
    }
    chaseCamera.applyPreset(preset as ChaseOrbitPreset)
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
    shell.setStatus(`Chase view: ${p.label}`)
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
      vehicleSession.getLights().setRouteSignals({
        running: true,
        braking: false,
        reverse: false,
        indicatorLeft: false,
        indicatorRight: false,
      })
      focusDriveViewport()
      const wheels = freeDriveSession.getStatus().bindingCount
      shell.setStatus(
        wheels > 0
          ? `Free drive — use WASD or the on-screen pad. ${wheels} wheel(s) from rig.`
          : 'Free drive on, but no rig wheels bound. Import *-rigged.glb + manifesto (same file as oval tire roll).',
        wheels === 0,
      )
    } else {
      driveKeys.clear()
      freeDriveSession.resetToOrigin()
      vehicleSession.getLights().setRouteSignals({
        braking: false,
        reverse: false,
        running: false,
        indicatorLeft: false,
        indicatorRight: false,
      })
      shell.updateRouteStats(routeSession.getStatus())
      shell.setStatus('Free drive off — car back at stage centre.')
    }
  },
  onFreeDriveHeadingFlip: (flip) => {
    const prev = store.getSnapshot().project.freeDrive
    store.dispatch(patchFreeDrive({ ...prev, headingFlip: flip }))
    freeDriveSession.setHeadingFlip(flip)
    if (freeDriveSession.isEnabled()) {
      freeDriveSession.resetToOrigin()
      shell.updateRouteStats(freeDriveSession.getStatus())
    }
    shell.setStatus(
      flip
        ? 'Drive direction inverted — W should now match the hood. Saved with the project.'
        : 'Drive direction normal. Saved with the project.',
    )
  },
  onDrivePadKey: (code, down) => {
    if (!freeDriveSession.isEnabled()) return
    if (code === 'Space') {
      driveKeys.clear()
      syncFreeDriveInput()
      return
    }
    if (down) driveKeys.add(code)
    else driveKeys.delete(code)
    syncFreeDriveInput()
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
    // Re-measure free-drive yaw — flip180 often swaps visual nose vs axle forward.
    freeDriveSession.setVehicle(
      vehicleSession.getPlacementRoot(),
      vehicleSession.getRig(),
      vehicleSession.getActionRoot(),
      vehicleSession.getModelRoot(),
    )
    shell.updateVehicle(vehicleSession.getSnapshot())
  },
  onGroundOffset: (metres) => {
    applyGroundOffset(metres)
  },
  onSitOnPedestal: () => {
    const stage = store.getSnapshot().project.stage
    if (!stage.pedestalVisible) {
      shell.setStatus('Turn pedestal Visible on first.', true)
      return
    }
    const h = Math.max(0.02, Math.min(1.5, stage.pedestalHeight ?? 0.12))
    // Match renderer STAGE_Z_EPS so tyres sit on the top face, not low.
    if (!applyGroundOffset(h + 0.02)) {
      shell.setStatus('Import a vehicle before sitting it on the pedestal.', true)
      return
    }
    shell.setStatus(`Car sitting on pedestal (${h.toFixed(2)} m).`)
  },
  onSitOnGround: () => {
    const stage = store.getSnapshot().project.stage
    if (!stage.floorVisible) {
      shell.setStatus('Turn floor Visible on first.', true)
      return
    }
    // Same STAGE_Z_EPS nudge as pedestal so tires kiss the floor plane.
    if (!applyGroundOffset(0.02)) {
      shell.setStatus('Import a vehicle before sitting it on the ground.', true)
      return
    }
    shell.setStatus('Car sitting on ground.')
  },
  onClipPlay: () => {
    vehicleSession.toggleClipPlayback()
  },
  onClipStop: () => {
    vehicleSession.stopClip()
    // Free-drive wheel spin writes quaternions on the same nodes — clear it so Stop
    // actually returns to the bind pose the user expects.
    if (!freeDriveSession.isEnabled()) {
      freeDriveSession.resetWheelPoseOnly()
    }
    shell.updateVehicle(vehicleSession.getSnapshot())
    const clip = vehicleSession.getClipTime()
    shell.setClipTransport(0, clip.duration, false)
    shell.setStatus('Clip stopped — pose reset to bind.')
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
    repositionHotspotId = null
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
    if (repositionHotspotId === id) repositionHotspotId = null
    store.dispatch(removeHotspot(id))
    hotspotCard.close()
    shell.setHotspotEditor(null, [])
    shell.setStatus('Hotspot deleted.')
  },
  onRecenterHotspot: (id) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    const placement = vehicleSession.getPlacementRoot()
    if (!placement) {
      shell.setStatus('Import a vehicle before recentering.', true)
      return
    }
    const modelRoot =
      placement.getObjectByName('VehicleActionRoot')?.children[0] ?? placement
    const node = resolveSemanticNode(modelRoot, hotspot.anchor.node)
    if (!node) {
      store.dispatch(
        upsertHotspot({
          ...hotspot,
          markerRotationDeg: undefined,
          anchor: {
            ...hotspot.anchor,
            node: {},
            localPosition: [0, 1.2, 0],
            localNormal: [0, 1, 0],
            offset: 0.05,
            fallbackVehicleCoordinate: [0, 1.2, 0],
          },
        }),
      )
      hotspotSession.select(id)
      shell.setStatus('Hotspot recentered at vehicle center (no mesh attached).')
      return
    }
    const local = defaultLocalAnchorOnNode(node)
    store.dispatch(
      upsertHotspot({
        ...hotspot,
        markerRotationDeg: undefined,
        anchor: {
          ...hotspot.anchor,
          node: refFromObject(modelRoot, node),
          localPosition: local.localPosition,
          localNormal: local.localNormal,
          offset: 0.06,
        },
      }),
    )
    hotspotSession.select(id)
    shell.setStatus(`Hotspot recentered on ${node.name || 'node'}.`)
  },
  onRepositionHotspot: (id) => {
    if (!vehicleSession.getPlacementRoot()) {
      shell.setStatus('Import a vehicle before moving a hotspot.', true)
      return
    }
    repositionHotspotId = id
    hotspotSession.select(id)
    const next = true
    hotspotSession.setPickMeshMode(next)
    objectInspector.setPickEnabled(false)
    shell.setStatus('Move mode — click a door or body panel to place this hotspot. Esc cancels.')
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
  onHotspotDoorAction: (id, actionId, opts) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotDoorAction(hotspot, actionId, opts)))
    const start = opts?.startSeconds
    shell.setStatus(
      actionId
        ? start != null && start > 0
          ? `Hotspot will play “${actionId}” from ${Number(start).toFixed(2)}s.`
          : `Hotspot will play “${actionId}” when opened.`
        : 'Door action cleared.',
    )
  },
  onHotspotMeshVisibility: (id, opts) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    if (!opts) {
      store.dispatch(upsertHotspot(withHotspotMeshVisibility(hotspot, null)))
      shell.setStatus('Mesh visibility action cleared.')
      refreshHotspotEditor()
      return
    }
    const node = decodeHotspotMeshKey(opts.nodeKey)
    if (!node) {
      shell.setStatus('Could not resolve mesh for hotspot action.', true)
      return
    }
    store.dispatch(upsertHotspot(withHotspotMeshVisibility(hotspot, { node, mode: opts.mode })))
    const label = node.name || node.path || 'mesh'
    shell.setStatus(
      opts.mode === 'toggle'
        ? `Hotspot will toggle “${label}” when opened.`
        : `Hotspot will ${opts.mode === 'show' ? 'show' : 'hide'} “${label}” when opened.`,
    )
    refreshHotspotEditor()
  },
  onHotspotMarkerRotation: (id, rotationDeg) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotMarkerRotation(hotspot, rotationDeg)), {
      recordHistory: false,
    })
  },
  onHotspotMarkerLabelLayout: (id, layout) => {
    const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
    if (!hotspot) return
    store.dispatch(upsertHotspot(withHotspotMarkerLabelLayout(hotspot, layout)), {
      recordHistory: false,
    })
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
    const chaseOrbit = captureShotChaseOrbit(
      camera.position.toArray() as [number, number, number],
      controls.target.toArray() as [number, number, number],
    )
    const thumbnailDataUrl = captureViewportThumbnail(studioRenderer) ?? undefined
    const shot: Shot = {
      id: crypto.randomUUID(),
      name: `Shot ${index}`,
      holdSeconds: 2,
      transitionSeconds: 1,
      cameraPosition: camera.position.toArray(),
      cameraTarget: controls.target.toArray(),
      fov: camera.fov,
      chaseOrbit: chaseOrbit ?? undefined,
      thumbnailDataUrl,
    }
    store.dispatch(upsertShot(shot))
    refreshShotEditor(shot.id)
    shell.setStatus(
      chaseOrbit
        ? `Captured ${shot.name} (follows car). Pick an animation if you want.`
        : `Captured ${shot.name}.`,
    )
  },
  onGoToShot: (id) => {
    const shot = store.getSnapshot().project.shots.find((item) => item.id === id)
    if (!shot || !studioRenderer) return
    applyShot(shot)
    const animNote = shot.playActionId ? ` · play ${shot.playActionId}` : ''
    shell.setStatus(
      shot.chaseOrbit || vehicleSession.getPlacementRoot()
        ? `View · ${shot.name} (locked to car)${animNote}.`
        : `Camera moved to ${shot.name}${animNote}.`,
    )
  },
  onDeleteShot: (id) => {
    store.dispatch(removeShot(id))
    refreshShotEditor(null)
    shell.setStatus('Shot deleted.')
  },
  onSelectShot: (id) => {
    refreshShotEditor(id)
  },
  onShotName: (id, name) => {
    const shot = store.getSnapshot().project.shots.find((s) => s.id === id)
    if (!shot) return
    store.dispatch(upsertShot({ ...shot, name }))
  },
  onShotPlayAction: (id, actionId, opts) => {
    const shot = store.getSnapshot().project.shots.find((s) => s.id === id)
    if (!shot) return
    const next: Shot = {
      ...shot,
      playActionId: actionId || undefined,
      playActionStartSeconds:
        actionId && opts?.startSeconds != null && opts.startSeconds >= 0
          ? opts.startSeconds
          : undefined,
      playActionEndSeconds:
        actionId && opts?.endSeconds != null && opts.endSeconds > 0
          ? opts.endSeconds
          : undefined,
    }
    if (!actionId) {
      delete next.playActionId
      delete next.playActionStartSeconds
      delete next.playActionEndSeconds
    }
    store.dispatch(upsertShot(next))
    shell.setStatus(
      actionId
        ? `View “${shot.name}” will play “${actionId}” on Go.`
        : `Animation cleared on “${shot.name}”.`,
    )
  },
  onStagePatch: (patch) => {
    store.dispatch(patchStage(patch))
  },
  onCycloramaVideo: async (file) => {
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
    store.dispatch(
      patchStage({
        cycloramaVideoAssetId: assetId,
        cycloramaInteractive: true,
      }),
    )
    shell.setStatus(`Cyclorama video: ${file.name}`)
  },
  onCycloramaVideoPreset: async (id) => {
    const preset = CYCLORAMA_VIDEO_PRESETS[id]
    const existing = store
      .getSnapshot()
      .project.assets.find((a) => a.role === 'video' && a.filename === preset.filename)
    if (existing) {
      store.dispatch(
        patchStage({
          cycloramaVideoAssetId: existing.id,
          cycloramaInteractive: true,
        }),
      )
      shell.setStatus(`Cyclorama wall: ${preset.label}`)
      return
    }
    try {
      shell.setStatus(`Loading ${preset.label}…`)
      const file = await fetchCycloramaVideoPreset(id)
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
      store.dispatch(
        patchStage({
          cycloramaVideoAssetId: assetId,
          cycloramaInteractive: true,
        }),
      )
      shell.setStatus(`Cyclorama wall: ${preset.label}`)
    } catch (err) {
      shell.setStatus(`Could not load ${preset.label}.`, true)
      console.error(err)
    }
  },
  onCycloramaClearVideo: () => {
    store.dispatch(patchStage({ cycloramaVideoAssetId: null }))
    shell.setStatus('Cyclorama video cleared.')
  },
  onStageFloorPreset: async (id) => {
    try {
      shell.setStatus(`Loading ${FLOOR_PRESETS[id].label} ground…`)
      const files = await fetchFloorPresetFiles(id)
      await applyStageTexturePack('floor', files, (message, isError) => shell.setStatus(message, isError))
    } catch (err) {
      shell.setStatus(`Could not load ${FLOOR_PRESETS[id].label} ground.`, true)
      console.error(err)
    }
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
  onBeamEditEnabled: (enabled) => {
    // While the gizmo is on: freeze chase follow + allow free orbit so you can frame
    // lamp seats. Free-drive chase would otherwise keep yanking the camera.
    if (enabled) {
      pauseChaseForBeamEdit()
      const vl = store.getSnapshot().project.vehicleLights
      const cleaned = vehicleSession.getLights().sanitizeBeamProxies(vl.beamProxies ?? [], {
        strict: true,
      })
      if (cleaned.length !== (vl.beamProxies?.length ?? 0)) {
        store.dispatch(patchVehicleLights({ beamProxies: cleaned }))
        shell.setStatus('Cleared invalid beam seats (were far outside the car).', true)
      }
      if (!cleaned.length) {
        const seeded = vehicleSession.getLights().captureLitBeamProxies()
        if (seeded.length) store.dispatch(patchVehicleLights({ beamProxies: seeded }))
      }
      // Always start on Move light — Aim mode puts the gizmo metres ahead of the car.
      beamEditor.setMode('position')
      const handles = vehicleSession.getLights().listBeamHandles()
      const groupsOn = store.getSnapshot().project.vehicleLights.groups
      const preferred =
        (groupsOn.drl ? handles.find((h) => h.groupId === 'drl') : undefined) ??
        handles.find((h) => groupsOn[h.groupId]) ??
        handles.find((h) => h.groupId === 'lowBeam') ??
        handles[0]
      beamEditor.select(preferred?.id ?? null)
      beamEditor.setEnabled(true)
      refreshBeamUi()
      const pos = preferred
        ? `(${preferred.position.x.toFixed(2)}, ${preferred.position.y.toFixed(2)}, ${preferred.position.z.toFixed(2)})`
        : ''
      shell.setStatus(
        preferred
          ? `Beam gizmo on ${preferred.groupId} at ${pos} — chase follow paused; Free camera to orbit. Turn gizmo off to restore free-drive chase.`
          : 'Beam gizmo on — chase follow paused. No beam seats yet.',
      )
      return
    }
    beamEditor.setEnabled(false)
    resumeChaseAfterBeamEdit()
    refreshBeamUi()
    shell.setStatus(
      freeDriveSession.isEnabled()
        ? 'Beam gizmo off — free-drive chase restored.'
        : 'Beam gizmo off.',
    )
  },
  onBeamSelect: (id) => {
    beamEditor.select(id)
    refreshBeamUi()
  },
  onBeamGizmoMode: (mode) => {
    beamEditor.setMode(mode)
  },
  onBeamDuplicate: () => {
    const id = beamEditor.getSelectedId()
    const current = ensureBeamProxiesSeeded()
    const src = current.find((p) => p.id === id) ?? current[0]
    if (!src) {
      shell.setStatus('No beam to duplicate — turn on low beam first.', true)
      return
    }
    const copy: VehicleBeamProxy = {
      id: crypto.randomUUID(),
      groupId: src.groupId,
      position: { x: src.position.x + 0.4, y: src.position.y, z: src.position.z },
      target: { ...src.target },
    }
    store.dispatch(patchVehicleLights({ beamProxies: [...current, copy] }))
    beamEditor.select(copy.id)
    refreshBeamUi()
    shell.setStatus(`Duplicated ${src.groupId} beam.`)
  },
  onBeamAdd: (groupId) => {
    const current = ensureBeamProxiesSeeded()
    const same = current.filter((p) => p.groupId === groupId)
    // Never seed DRL from a long low/high cone — that mismatched the gizmo onto low beam #3.
    const template =
      same[same.length - 1] ??
      (groupId === 'drl'
        ? current.find((p) => p.groupId === 'drl')
        : current.find((p) => p.groupId === groupId) ??
          current.find((p) => p.groupId === 'lowBeam') ??
          current[0])
    const shortDrlAim = (pos: { x: number; y: number; z: number }) => ({
      x: pos.x,
      y: Math.max(0.05, pos.y - 0.15),
      z: pos.z + 1.1,
    })
    const created: VehicleBeamProxy = template
      ? {
          id: crypto.randomUUID(),
          groupId,
          position: {
            x: template.position.x + (groupId === template.groupId ? 0.4 : 0),
            y: template.position.y,
            z: template.position.z,
          },
          target:
            groupId === 'drl' && template.groupId !== 'drl'
              ? shortDrlAim({
                  x: template.position.x,
                  y: template.position.y,
                  z: template.position.z,
                })
              : { ...template.target },
        }
      : {
          id: crypto.randomUUID(),
          groupId,
          position: { x: 0, y: groupId === 'drl' ? 0.7 : 0.55, z: 2.1 },
          target:
            groupId === 'drl'
              ? { x: 0, y: 0.5, z: 3.2 }
              : { x: 0, y: 0, z: 5.4 },
        }
    store.dispatch(patchVehicleLights({ beamProxies: [...current, created] }))
    // Turn the group on so the new cone is visible.
    store.dispatch(patchVehicleLights({ groups: { [groupId]: true } }))
    beamEditor.select(created.id)
    if (!beamEditor.isEnabled()) {
      pauseChaseForBeamEdit()
      beamEditor.setEnabled(true)
      const editToggle = document.querySelector('[data-vlight-beam-edit]') as HTMLInputElement | null
      if (editToggle) editToggle.checked = true
    }
    refreshBeamUi()
    shell.setStatus(`Added ${groupId} beam — chase follow paused while gizmo is on.`)
  },
  onBeamDelete: () => {
    const id = beamEditor.getSelectedId()
    const current = store.getSnapshot().project.vehicleLights.beamProxies ?? []
    if (!id || !current.length) {
      shell.setStatus('No beam selected.', true)
      return
    }
    const next = current.filter((p) => p.id !== id)
    store.dispatch(patchVehicleLights({ beamProxies: next }))
    beamEditor.select(next[0]?.id ?? null)
    refreshBeamUi()
    shell.setStatus(next.length ? 'Beam deleted.' : 'All manual beams cleared — auto placement resumes.')
  },
  onBeamCopyPositions: async () => {
    const lights = vehicleSession.getLights()
    if (!lights.beamSeatsLookReasonable()) {
      shell.setStatus(
        'Beam seats look like free-drive/world junk (hundreds of metres). Turn free drive off, Reset auto, then Copy.',
        true,
      )
      return
    }
    const text = lights.formatBeamPlacementsClipboard()
    shell.setBeamCoordsText(text)
    try {
      await navigator.clipboard.writeText(text)
      shell.setStatus('Beam positions copied — paste into chat to lock defaults.')
    } catch {
      shell.setStatus('Could not write clipboard — copy the text under Beam placement.', true)
    }
  },
  onBeamResetAuto: () => {
    // Park first — auto seats measured while the car is at z≈-480 bake that offset in.
    freeDriveSession.resetToOrigin()
    // Re-run grounding in case a prior normalize-at-offset corrupted the model.
    vehicleSession.setNormalization({})
    const defaults = structuredClone(DEFAULT_BEAM_PROXIES)
    store.dispatch(patchVehicleLights({ beamProxies: defaults }))
    beamEditor.select(null)
    const lights = vehicleSession.getLights()
    lights.apply({
      ...store.getSnapshot().project.vehicleLights,
      beamProxies: defaults,
    })
    lights.remeasureAndRebuildProxies()
    refreshBeamUi()
    const ok = lights.beamSeatsLookReasonable()
    shell.setStatus(
      ok
        ? 'Parked at origin and restored locked beam seats (placement metres).'
        : 'Reset ran, but seats still look wrong — try reimporting the vehicle.',
      !ok,
    )
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
    if (!file) {
      const nextMaps = { ...current.maps }
      delete nextMaps[mapKey]
      store.dispatch(
        patchStage({
          [surface]: { ...current, maps: nextMaps },
        }),
      )
      shell.setStatus(`${surface} ${map} map removed.`)
      return
    }
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
    // Roughness / AO / metal maps show hard tile seams unless Break tiling is on —
    // turn it up automatically on the first assign so the floor doesn't look stamped.
    const autoBreak =
      (current.tileVariation ?? 0) < 0.05
        ? { tileVariation: 0.65, tileSeed: Math.random() * 64 }
        : {}
    store.dispatch(
      patchStage({
        [surface]: {
          ...current,
          ...autoBreak,
          maps: { ...current.maps, [mapKey]: assetId },
        },
      }),
    )
    shell.setStatus(
      autoBreak.tileVariation
        ? `${surface} ${map} map: ${file.name} · Break tiling on (0.65)`
        : `${surface} ${map} map: ${file.name}`,
    )
  },
  onStageTexturePack: (surface, files) =>
    applyStageTexturePack(surface, files, (message, isError) => shell.setStatus(message, isError)),
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
  onObjectPickMode: (enabled, mode = 'object') => {
    objectInspector.setPickEnabled(enabled, mode)
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
      {
        overrideMaps: selectedMaterialOverrideMaps(),
        assets: store.getSnapshot().project.assets,
        liveMaps: objectInspector.getMaterialLiveMaps(),
      },
    )
  },
  onObjectMaterialCommit: () => {
    commitSelectedMaterialOverride()
  },
  onMaterialTexture: async (map, file) => {
    if (!objectInspector.getSelectedObject() || !objectInspector.getMaterialEdit()) {
      shell.setStatus('Pick a material before assigning maps.', true)
      return
    }
    if (map === 'clear') {
      objectInspector.clearAllMaterialMaps()
      const cleared: StageSurfaceMaps = {
        mapAssetId: null,
        normalMapAssetId: null,
        roughnessMapAssetId: null,
        metalnessMapAssetId: null,
        displacementMapAssetId: null,
        aoMapAssetId: null,
        emissiveMapAssetId: null,
      }
      commitSelectedMaterialOverride({ maps: cleared })
      refreshObjectInspector()
      shell.setStatus('Material maps cleared.')
      return
    }
    const key = matMapKey(map)
    const current = { ...selectedMaterialOverrideMaps() }
    if (!file) {
      current[key] = null
      objectInspector.setMaterialMap(map, null)
      commitSelectedMaterialOverride({ maps: current })
      refreshObjectInspector()
      shell.setStatus(`Material ${map} map removed.`)
      return
    }
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
    current[key] = assetId
    const { loadStageTexture } = await import('./stage/stageMaterials')
    const tex = await loadStageTexture(assetId)
    objectInspector.setMaterialMap(map, tex)
    // Scalar multipliers must be 1 when a roughness/metalness map is present.
    if (map === 'roughness') objectInspector.patchMaterial({ roughness: 1 })
    if (map === 'metalness') objectInspector.patchMaterial({ metalness: 1 })
    if (map === 'map') objectInspector.patchMaterial({ color: '#ffffff' })
    // Car UVs vary wildly per panel — keep triplanar on whenever maps are set.
    const edit = objectInspector.getMaterialEdit()
    if (edit?.mapProjection !== 'triplanar') {
      objectInspector.patchMaterial({
        mapProjection: 'triplanar',
        mapRepeat: edit?.mapRepeat && edit.mapRepeat > 1 ? edit.mapRepeat : 2,
        mapTriSeed: edit?.mapTriSeed ?? Math.random() * 64,
        mapTriVariation: edit?.mapTriVariation ?? 0.25,
      })
    }
    commitSelectedMaterialOverride({ maps: current })
    refreshObjectInspector()
    shell.setStatus(`Material ${map} map: ${file.name}`)
  },
  onMaterialTexturePack: async (files) => {
    if (!objectInspector.getSelectedObject() || !objectInspector.getMaterialEdit()) {
      shell.setStatus('Pick a material before loading a pack.', true)
      return
    }
    try {
      const { detectPbrMapsFromFiles, summarizeDetectedPbrMaps } = await import('./stage/detectPbrMaps')
      const detected = detectPbrMapsFromFiles(files)
      const slots = Object.keys(detected.files).filter((s) => s !== 'displacement')
      if (slots.length === 0) {
        shell.setStatus(
          `No PBR maps recognised in folder (expect Color / NormalGL / Roughness / Metalness…).`,
          true,
        )
        return
      }
      // Displacement is skipped on vehicles — body meshes aren't tessellated for height,
      // and Three's default displacementScale of 1 wrecks the car. Null clears any GLB height map.
      const nextMaps: StageSurfaceMaps = {
        mapAssetId: null,
        normalMapAssetId: null,
        roughnessMapAssetId: null,
        metalnessMapAssetId: null,
        displacementMapAssetId: null,
        aoMapAssetId: null,
        emissiveMapAssetId: null,
      }
      objectInspector.clearAllMaterialMaps()
      const { loadStageTexture } = await import('./stage/stageMaterials')
      for (const slot of slots as Array<keyof typeof detected.files>) {
        const file = detected.files[slot]
        if (!file) continue
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
        nextMaps[matMapKey(slot)] = assetId
        const tex = await loadStageTexture(assetId)
        if (!tex) {
          throw new Error(`Failed to decode ${file.name}`)
        }
        objectInspector.setMaterialMap(slot, tex, { normalYFlip: detected.normalYFlip })
      }
      const scalarPatch: Partial<MaterialEditState> = {
        color: '#ffffff',
        // Object-metre density — same size on every panel (ignores GLB UVs).
        mapRepeat: 2,
        mapProjection: 'triplanar',
        mapTriSeed: Math.random() * 64,
        mapTriVariation: 0.25,
      }
      if (detected.files.metalness) scalarPatch.metalness = 1
      else scalarPatch.metalness = 0
      if (detected.files.roughness) scalarPatch.roughness = 1
      // Painted metal / car paint reads better with a clearcoat layer.
      const edit = objectInspector.getMaterialEdit()
      if (edit?.hasPhysical && (edit.clearcoat ?? 0) < 0.5) {
        scalarPatch.clearcoat = 0.85
        scalarPatch.clearcoatRoughness = 0.1
      }
      objectInspector.patchMaterial(scalarPatch)
      commitSelectedMaterialOverride({ maps: nextMaps, normalYFlip: detected.normalYFlip })
      // Re-apply from project so shared materials / async texture cache stay consistent.
      vehicleSession.reapplyMaterials()
      refreshObjectInspector()
      const skippedDisp = detected.files.displacement
        ? ' · displacement skipped (not for car meshes)'
        : ''
      shell.setStatus(
        `Material pack replaced · soft triplanar · ${summarizeDetectedPbrMaps(detected)}${skippedDisp}`,
      )
    } catch (err) {
      shell.setStatus(
        `Material pack failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      )
      refreshObjectInspector()
    }
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

function commitSelectedMaterialOverride(mapPatch?: {
  maps?: StageSurfaceMaps
  normalYFlip?: boolean
}) {
  const model = vehicleSession.getModelRoot() ?? vehicleSession.getPlacementRoot()
  const node = objectInspector.getSelectedObject()
  const edit = objectInspector.getMaterialEdit()
  if (!model || !node || !edit || !store.getSnapshot().project.vehicle) return
  const slot = objectInspector.getSelectedMaterialIndex()
  const ref = refFromObject(model, node)
  const path = ref.path || ref.name || node.uuid
  const existing = store
    .getSnapshot()
    .project.vehicle?.materialOverrides.find((o) => o.id === `${path}#${slot}`)
  const nextMaps =
    mapPatch && 'maps' in mapPatch
      ? mapPatch.maps
      : existing?.props.maps
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
      mapRepeat: edit.mapRepeat,
      mapProjection: edit.mapProjection,
      mapTriSeed: edit.mapTriSeed,
      mapTriVariation: edit.mapTriVariation,
      ...(nextMaps ? { maps: nextMaps } : {}),
      ...(mapPatch?.normalYFlip != null
        ? { normalYFlip: mapPatch.normalYFlip }
        : existing?.props.normalYFlip != null
          ? { normalYFlip: existing.props.normalYFlip }
          : {}),
    },
  }
  store.dispatch(upsertMaterialOverride(entry))
  vehicleSession.setAuthoring({
    materialOverrides: store.getSnapshot().project.vehicle?.materialOverrides ?? [entry],
  })
  shell.setStatus(`Material saved: ${edit.name}`)
}

function selectedMaterialOverrideMaps(): StageSurfaceMaps {
  const model = vehicleSession.getModelRoot() ?? vehicleSession.getPlacementRoot()
  const node = objectInspector.getSelectedObject()
  if (!model || !node) return {}
  const ref = refFromObject(model, node)
  const path = ref.path || ref.name || node.uuid
  const slot = objectInspector.getSelectedMaterialIndex()
  const edit = objectInspector.getMaterialEdit()
  const list = store.getSnapshot().project.vehicle?.materialOverrides ?? []
  const byId = list.find((o) => o.id === `${path}#${slot}`)
  if (byId?.props.maps) return byId.props.maps
  // Shared GLB materials: maps may be stored on another mesh that uses the same material name.
  if (edit?.name) {
    const byName = list.find(
      (o) =>
        o.materialName === edit.name &&
        o.materialSlot === slot &&
        o.props.maps &&
        Object.values(o.props.maps).some((v) => typeof v === 'string' && v),
    )
    if (byName?.props.maps) return byName.props.maps
  }
  return {}
}

function refreshObjectInspector() {
  const tree = objectInspector.listTree()
  const selectedId = objectInspector.getSelectedId()
  const slot = objectInspector.getSelectedMaterialIndex()
  shell.updateObjectTree(tree, selectedId)
  shell.updateObjectMaterial(
    objectInspector.getMaterialEdit(),
    objectInspector.listMaterials(),
    slot,
    {
      overrideMaps: selectedMaterialOverrideMaps(),
      assets: store.getSnapshot().project.assets,
      liveMaps: objectInspector.getMaterialLiveMaps(),
    },
  )
  const mats = objectInspector.listUniqueMaterials()
  const selectedKey = selectedId != null ? `${selectedId}::${slot}` : null
  shell.updateMaterialList(mats, selectedKey)
}

function matMapKey(
  map: string,
): keyof StageSurfaceMaps {
  switch (map) {
    case 'map':
      return 'mapAssetId'
    case 'normal':
      return 'normalMapAssetId'
    case 'roughness':
      return 'roughnessMapAssetId'
    case 'metalness':
      return 'metalnessMapAssetId'
    case 'displacement':
      return 'displacementMapAssetId'
    case 'ao':
      return 'aoMapAssetId'
    case 'emissive':
      return 'emissiveMapAssetId'
    default:
      return 'mapAssetId'
  }
}

function listHotspotMeshOptions(): Array<{ key: string; label: string }> {
  const root = vehicleSession.getPlacementRoot()
  if (!root) return []
  const out: Array<{ key: string; label: string }> = []
  const seen = new Set<string>()
  for (const node of objectInspector.listTree()) {
    const obj = objectInspector.findById(node.id)
    if (!obj?.name || obj.name === 'Scene' || obj.name.startsWith('Hotspot_')) continue
    const key = encodeHotspotMeshKey(refFromObject(root, obj))
    if (!key || seen.has(key)) continue
    seen.add(key)
    const indent = node.depth > 0 ? `${'·'.repeat(Math.min(node.depth, 5))} ` : ''
    out.push({
      key,
      label: `${indent}${node.name}${node.mesh ? '' : ' (group)'}`,
    })
  }
  return out
}

function selectedHotspotMeshKey(): string | null {
  const root = vehicleSession.getPlacementRoot()
  const selectedId = objectInspector.getSelectedId()
  if (!root || !selectedId) return null
  const obj = objectInspector.findById(selectedId)
  if (!obj) return null
  return encodeHotspotMeshKey(refFromObject(root, obj)) || null
}

function setHotspotMeshVisible(
  node: { name?: string; path?: string; iomId?: string },
  visible: boolean,
): boolean {
  const root = vehicleSession.getPlacementRoot()
  if (!root) return false
  const obj = resolveSemanticNode(root, node)
  if (!obj) return false
  obj.visible = visible
  refreshObjectInspector()
  return true
}

function toggleHotspotMeshVisible(node: {
  name?: string
  path?: string
  iomId?: string
}): boolean {
  const root = vehicleSession.getPlacementRoot()
  if (!root) return false
  const obj = resolveSemanticNode(root, node)
  if (!obj) return false
  obj.visible = !obj.visible
  refreshObjectInspector()
  return true
}

function hotspotRuntimeHandlers() {
  return {
    playSemanticAction: (
      id: string,
      opts?: { startSeconds?: number; endSeconds?: number; forcePlay?: boolean; forceToggle?: boolean },
    ) => vehicleSession.playSemanticAction(id, opts),
    goToShot: (shotId: string) => {
      const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId)
      if (shot) applyShot(shot)
    },
    setEnvironmentPreset: (presetId: string) => {
      store.dispatch(setEnvironmentPreset(presetId as EnvironmentPresetId))
    },
    setVehicleLight: (groupId: string, on: boolean) => {
      store.dispatch(patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: on } }))
    },
    toggleVehicleLight: (groupId: string) => {
      const cur = store.getSnapshot().project.vehicleLights.groups[groupId as VehicleLightGroupId]
      store.dispatch(patchVehicleLights({ groups: { [groupId as VehicleLightGroupId]: !cur } }))
    },
    playVehicleLightSequence: (sequenceId: string) => {
      vehicleSession.getLights().playSequence(sequenceId as 'welcome' | 'farewell')
    },
    setMeshVisible: setHotspotMeshVisible,
    toggleMeshVisible: toggleHotspotMeshVisible,
  }
}

const hotspotCard = mountHotspotCard(shell.viewportHost, {
  onRunAction: (action) => {
    const ok = runHotspotAction(action, hotspotRuntimeHandlers())
    if (action.type === 'action.play' || action.type === 'action.toggle') {
      shell.setStatus(ok ? `Action: ${action.actionId}` : `Action failed: ${action.actionId}`, !ok)
      shell.updateVehicle(vehicleSession.getSnapshot())
    } else if (action.type === 'mesh.setVisible' || action.type === 'mesh.toggleVisible') {
      const label = action.node.name || action.node.path || 'mesh'
      shell.setStatus(
        ok
          ? action.type === 'mesh.toggleVisible'
            ? `Toggled mesh: ${label}`
            : `${action.visible ? 'Showed' : 'Hid'} mesh: ${label}`
          : `Mesh not found: ${label}`,
        !ok,
      )
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
    label: `${a.label} (${a.clipDuration.toFixed(1)}s)`,
    duration: a.clipDuration,
  }))
  let videoLabel: string | null = null
  if (hotspot) {
    const videoId = hotspotVideoAssetId(hotspot)
    if (videoId) {
      videoLabel =
        store.getSnapshot().project.assets.find((a) => a.id === videoId)?.filename ?? null
    }
  }
  shell.setHotspotEditor(hotspot, doorActions, {
    videoLabel,
    meshOptions: listHotspotMeshOptions(),
    selectedObjectKey: selectedHotspotMeshKey(),
  })
}

function openHotspot(hotspot: Hotspot) {
  runHotspotActions(hotspot, (action) => {
    runHotspotAction(action, hotspotRuntimeHandlers())
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
      offset: 0.06,
      fallbackVehicleCoordinate: result.fallbackVehicleCoordinate,
    },
    blocks: [
      { type: 'eyebrow', text: nodeLabel },
      { type: 'title', text: nodeLabel.replace(/_/g, ' ') },
      { type: 'richtext', markdown: `Attached to **${nodeLabel}**. The marker follows this node when doors or panels move. Use the **Animation** button below to play the linked door or clip.` },
    ],
    actions: [],
    exploreVisible: true,
    closeBehavior: 'keep-state',
  }
  store.dispatch(upsertHotspot(hotspot))
  hotspotSession.select(hotspot.id)
  shell.setStatus(`Hotspot attached to ${nodeLabel}.`)
}

function repositionHotspotFromPick(
  id: string,
  result: {
    ref: { name?: string; path?: string; iomId?: string }
    localPosition: [number, number, number]
    localNormal: [number, number, number]
    fallbackVehicleCoordinate?: [number, number, number]
  },
) {
  const hotspot = store.getSnapshot().project.hotspots.find((h) => h.id === id)
  if (!hotspot) return
  const nodeLabel = result.ref.name || result.ref.path || 'mesh'
  store.dispatch(
    upsertHotspot({
      ...hotspot,
      markerRotationDeg: undefined,
      anchor: {
        ...hotspot.anchor,
        assetFingerprint: vehicleSession.getRig()?.assetFingerprint ?? hotspot.anchor.assetFingerprint,
        node: { ...result.ref },
        localPosition: result.localPosition,
        localNormal: result.localNormal,
        offset: 0.06,
        fallbackVehicleCoordinate: result.fallbackVehicleCoordinate,
      },
    }),
  )
  hotspotSession.select(id)
  shell.setStatus(`Moved hotspot onto ${nodeLabel}.`)
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
  freeDriveSession.setHeadingFlip(Boolean(state.headingFlip))
  shell.setFreeDriveEnabled(state.enabled)
  studioRenderer?.setInfiniteFloor(state.enabled)
  if (state.enabled) {
    syncRouteVehicle()
    freeDriveSession.setCruiseKmh(state.cruiseKmh)
    freeDriveSession.setAccelMps2(state.accelMps2)
    freeDriveSession.setBrakeMps2(state.brakeMps2)
    freeDriveSession.setMaxSteerDegrees(state.maxSteerDeg)
    freeDriveSession.setMaxBodyRollDegrees(0)
    freeDriveSession.setTireRollRate(state.tireRollRate)
    // Beam gizmo owns the camera while on — don't re-force chase follow mid-edit.
    if (beamEditor.isEnabled()) {
      pauseChaseForBeamEdit()
    } else {
      shell.setChaseLockedForFreeDrive(true)
      applyChaseCamera(true)
    }
    shell.updateRouteStats(freeDriveSession.getStatus())
  } else {
    shell.setChaseLockedForFreeDrive(false)
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
  vehicleSession.getLights().setRouteSignals({
    running: false,
    braking: false,
    reverse: false,
    indicatorLeft: false,
    indicatorRight: false,
  })
  // setRoute will also clear freeDrive.enabled when a route is saved.
}

function applyVehicleLightsFromStore() {
  const vl = store.getSnapshot().project.vehicleLights
  const cleaned = vehicleSession.getLights().sanitizeBeamProxies(vl.beamProxies ?? [], {
    strict: true,
  })
  if (cleaned.length !== (vl.beamProxies?.length ?? 0)) {
    // Drop sideways / model-pivot seats that were saved as "car-local".
    store.dispatch(patchVehicleLights({ beamProxies: cleaned }), { recordHistory: false })
  }
  vehicleSession.getLights().apply({ ...vl, beamProxies: cleaned }, { strictSanitize: true })
  applyVehicleLightsGpuBudget(vl)
  shell.updateVehicleLightCounts(vehicleSession.getLights().getBoundCounts())
  shell.updateVehicleLightBindings(vehicleSession.getLights().getBoundTargets())
  refreshBeamUi()
}

/** Bloom / sun-shadow map size — only when those knobs change (not every lamp checkbox). */
let lastVehicleLightsGpuKey = ''
function applyVehicleLightsGpuBudget(
  vl: Pick<
    VehicleLightsState,
    'performanceMode' | 'bloomEnabled' | 'bloomStrength' | 'bloomThreshold'
  >,
) {
  if (!studioRenderer) return
  const lite = vl.performanceMode === 'lite'
  const bloomOn = !lite && Boolean(vl.bloomEnabled)
  const key = `${lite}|${bloomOn}|${vl.bloomStrength}|${vl.bloomThreshold}`
  if (key === lastVehicleLightsGpuKey) return
  lastVehicleLightsGpuKey = key
  studioRenderer.applyLightsBudget({ lite })
  studioRenderer.applyBloom(lite ? { ...vl, bloomEnabled: false } : vl)
}

function ensureBeamEditorAttached() {
  if (!studioRenderer) return
  beamEditor.attach({
    camera: studioRenderer.camera,
    domElement: studioRenderer.canvas,
    scene: studioRenderer.scene,
    orbit: studioRenderer.controls,
    lights: vehicleSession.getLights(),
    onCommit: () => {
      const lights = vehicleSession.getLights()
      const existing = store.getSnapshot().project.vehicleLights.beamProxies ?? []
      let synced = existing.length
        ? lights.syncBeamProxiesFromLive(existing)
        : lights.captureLitBeamProxies()
      // Keep auto DRL (etc.) when only low/high/reverse were locked in defaults.
      const haveGroups = new Set(synced.map((p) => p.groupId))
      for (const h of lights.listBeamHandles()) {
        if (haveGroups.has(h.groupId)) continue
        synced.push({
          id: h.id,
          groupId: h.groupId,
          position: { ...h.position },
          target: { ...h.target },
        })
      }
      // Soft sanitize only — strict mode was wiping drags and rebuilding auto seats.
      // Store subscribe applies with the same soft path so the cone keeps its drop pose.
      const cleaned = lights.sanitizeBeamProxies(synced, { strict: false })
      store.dispatch(patchVehicleLights({ beamProxies: cleaned }))
      refreshBeamUi()
    },
    onCameraLock: (locked) => {
      // Freeze chase while an axis is dragged. If the whole beam-edit session already
      // paused follow, do not re-enable chase on drag-end (that yanked the camera mid-edit).
      if (beamEditor.isEnabled()) {
        if (locked) chaseCamera.setUpdateBlocked(true)
        return
      }
      chaseCamera.setUpdateBlocked(locked)
    },
  })
}

/** Seed empty beamProxies from live auto seats so Duplicate/Delete have authorable rows. */
function ensureBeamProxiesSeeded(): VehicleBeamProxy[] {
  const vl = store.getSnapshot().project.vehicleLights
  if (vl.beamProxies?.length) return structuredClone(vl.beamProxies)
  const seeded = vehicleSession.getLights().captureLitBeamProxies()
  if (seeded.length) {
    store.dispatch(patchVehicleLights({ beamProxies: seeded }))
  }
  return seeded
}

function refreshBeamUi() {
  if (beamEditor.isDragging()) return
  const lights = vehicleSession.getLights()
  const stored = store.getSnapshot().project.vehicleLights.beamProxies ?? []
  const storedIds = new Set(stored.map((p) => p.id))
  const storedGroups = new Set(stored.map((p) => p.groupId))
  // Keep locked seats for authored groups, but still list auto seats for groups
  // that were never saved (e.g. DRL after adding beam cones) — otherwise the
  // gizmo only shows low/high and looks “shared” with low beam #N.
  const handles = lights
    .listBeamHandles()
    .filter(
      (h) =>
        storedIds.size === 0 ||
        storedIds.has(h.id) ||
        !storedGroups.has(h.groupId),
    )
  const groups = store.getSnapshot().project.vehicleLights.groups
  let selected = beamEditor.getSelectedId()
  // Keep the user's Beam dropdown choice even if that group is currently off —
  // requiring a lit group pinned the gizmo on one seat and looked “stuck”.
  if (selected && !handles.some((h) => h.id === selected)) selected = null
  if (!selected) {
    const lit =
      (groups.drl ? handles.find((h) => h.groupId === 'drl') : undefined) ??
      handles.find((h) => groups[h.groupId]) ??
      handles.find((h) => h.groupId === 'lowBeam') ??
      handles[0]
    selected = lit?.id ?? null
  }
  if (selected !== beamEditor.getSelectedId()) beamEditor.select(selected)
  else beamEditor.refreshAttachment()
  shell.updateBeamList(
    handles.map((h) => ({
      id: h.id,
      groupId: h.groupId,
      position: h.position,
      target: h.target,
    })),
    selected,
  )
  shell.setBeamCoordsText(
    lights.formatBeamPlacementsClipboard(stored.length ? stored : undefined),
  )
}

function currentVisualHeadingYaw(): number {
  if (freeDriveSession.isEnabled()) {
    return freeDriveSession.getVisualHeadingYaw() ?? 0
  }
  return routeSession.getVisualHeadingYaw() ?? vehicleSession.getPlacementRoot()?.rotation.y ?? 0
}

function captureShotChaseOrbit(
  cameraPosition: [number, number, number],
  cameraTarget: [number, number, number],
): ChaseOrbitState | null {
  if (!vehicleSession.getPlacementRoot()) return null
  if (chaseCamera.isEnabled()) return chaseCamera.getOrbitState()
  return deriveChaseOrbitFromWorld(currentVisualHeadingYaw(), cameraPosition, cameraTarget)
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

let worldShotBlend: {
  fromPos: Vector3
  toPos: Vector3
  fromTarget: Vector3
  toTarget: Vector3
  fromFov: number
  toFov: number
  elapsed: number
  duration: number
} | null = null

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function shotDoorActions() {
  return vehicleSession.getSemanticActions().map((a) => ({
    id: a.id,
    label: a.label,
    duration: a.clipDuration,
  }))
}

function refreshShotEditor(shotId: string | null) {
  if (!shotId) {
    shell.setShotEditor(null, shotDoorActions())
    return
  }
  const shot = store.getSnapshot().project.shots.find((s) => s.id === shotId) ?? null
  shell.setShotEditor(shot, shotDoorActions())
}

function playShotAnimation(shot: Shot) {
  if (!shot.playActionId) return
  const ok = vehicleSession.playSemanticAction(shot.playActionId, {
    startSeconds: shot.playActionStartSeconds,
    endSeconds: shot.playActionEndSeconds,
    forcePlay: true,
  })
  if (!ok) {
    shell.setStatus(`View animation missing: ${shot.playActionId}`, true)
  }
}

function applyShot(shot: Shot) {
  if (!studioRenderer) return
  const duration = Math.max(0.25, shot.transitionSeconds || 1)
  const orbit = resolveShotChaseOrbit(shot)

  // Vehicle present → follow-cam transition (works after free-drive moves the car).
  if (orbit) {
    worldShotBlend = null
    applyChaseCamera(true)
    const route = routeSession.getRoute()
    if (route) {
      route.chaseCamera = true
      route.chaseOrbitYawDeg = orbit.yawDeg
      route.chaseOrbitPitchDeg = orbit.pitchDeg
      route.chaseDistance = orbit.distance
      route.chaseLookAhead = orbit.lookAhead
      route.chaseLookSide = orbit.lookSide
    }
    chaseCamera.transitionToOrbit(orbit, duration)
    shell.setChaseOrbit(orbit)
    shell.setChaseCameraEnabled(true)
    if (shot.fov != null) {
      studioRenderer.camera.fov = shot.fov
      studioRenderer.camera.updateProjectionMatrix()
    }
    playShotAnimation(shot)
    return
  }

  if (!shot.cameraPosition) return
  applyChaseCamera(false)
  const route = routeSession.getRoute()
  if (route) route.chaseCamera = false
  studioRenderer.setOrbitEnabled(false)
  shell.setOrbitEnabled(false)
  const target = shot.cameraTarget ?? ([0, 0.8, 0] as [number, number, number])
  worldShotBlend = {
    fromPos: studioRenderer.camera.position.clone(),
    toPos: new Vector3().fromArray(shot.cameraPosition),
    fromTarget: studioRenderer.controls.target.clone(),
    toTarget: new Vector3().fromArray(target),
    fromFov: studioRenderer.camera.fov,
    toFov: shot.fov ?? studioRenderer.camera.fov,
    elapsed: 0,
    duration,
  }
  playShotAnimation(shot)
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
  } else if (wantId && !sceneEmpty) {
    // Vehicle already in scene — still rebind object/material menus to the live root.
    syncRouteVehicle()
    shell.updateVehicle(vehicleSession.getSnapshot())
  } else if (!wantId && !sceneEmpty) {
    vehicleSession.clearActiveVehicle()
    routeSession.setVehicle(null, null)
    freeDriveSession.setVehicle(null, null)
    freeDriveSession.setEnabled(false)
    studioRenderer?.setInfiniteFloor(false)
    objectInspector.setRoot(null)
    refreshObjectInspector()
    shell.updateVehicle(vehicleSession.getSnapshot())
  }
}

function applyGroundOffset(metres: number): boolean {
  const measured = vehicleSession.setNormalization({ groundOffsetMetres: metres })
  if (!measured) return false
  store.dispatch(
    patchVehicleNormalization({
      groundOffsetMetres: metres,
      lengthMetres: measured.length,
      widthMetres: measured.width,
      heightMetres: measured.height,
    }),
  )
  shell.updateVehicle(vehicleSession.getSnapshot())
  return true
}

function applyChaseCamera(enabled: boolean) {
  chaseCamera.setEnabled(enabled)
  shell.setChaseCameraEnabled(enabled)
  if (enabled && studioRenderer && !beamEditor.isEnabled()) {
    studioRenderer.setOrbitEnabled(false)
    shell.setOrbitEnabled(false)
  }
}

/** Freeze free-drive chase + enable orbit so lamp gizmo edits don't fight the follow cam. */
function pauseChaseForBeamEdit() {
  chaseCamera.setInputBlocked(true)
  chaseCamera.setUpdateBlocked(true)
  if (studioRenderer) {
    studioRenderer.setOrbitEnabled(true)
    shell.setOrbitEnabled(true)
  }
  shell.setChaseLockedForFreeDrive(false)
}

function resumeChaseAfterBeamEdit() {
  chaseCamera.setUpdateBlocked(false)
  chaseCamera.setInputBlocked(false)
  if (freeDriveSession.isEnabled()) {
    applyChaseCamera(true)
    shell.setChaseLockedForFreeDrive(true)
    studioRenderer?.setOrbitEnabled(false)
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

let lastAppliedEnvKey = ''
let lastAppliedStageKey = ''
let lastAppliedAccentKey = ''
let lastAppliedLightsKey = ''
let lastAppliedHotspotsKey = ''

store.subscribe((snap) => {
  shell.updateStore(snap)

  // Only push renderer work for slices that actually changed — env preset
  // switches used to rebuild stage geometry + re-apply every lamp every time.
  const envKey = JSON.stringify(snap.project.environment)
  const stageKey = JSON.stringify(snap.project.stage)
  const accentKey = JSON.stringify(snap.project.accentLights)
  const lightsKey = JSON.stringify(snap.project.vehicleLights)
  const hotspotsKey = JSON.stringify(snap.project.hotspots)

  if (envKey !== lastAppliedEnvKey) {
    lastAppliedEnvKey = envKey
    studioRenderer?.applyEnvironmentState(snap.project.environment)
  }
  if (stageKey !== lastAppliedStageKey) {
    lastAppliedStageKey = stageKey
    studioRenderer?.applyStageState(snap.project.stage)
  }
  if (accentKey !== lastAppliedAccentKey) {
    lastAppliedAccentKey = accentKey
    studioRenderer?.applyAccentLights(snap.project.accentLights)
  }
  if (lightsKey !== lastAppliedLightsKey) {
    lastAppliedLightsKey = lightsKey
    const cleanedBeams = vehicleSession
      .getLights()
      .sanitizeBeamProxies(snap.project.vehicleLights.beamProxies ?? [], { strict: false })
    if (cleanedBeams.length !== (snap.project.vehicleLights.beamProxies?.length ?? 0)) {
      store.dispatch(patchVehicleLights({ beamProxies: cleanedBeams }), { recordHistory: false })
    }
    vehicleSession.getLights().apply(
      {
        ...snap.project.vehicleLights,
        beamProxies: cleanedBeams,
      },
      { strictSanitize: false },
    )
    applyVehicleLightsGpuBudget(snap.project.vehicleLights)
    shell.updateVehicleLightCounts(vehicleSession.getLights().getBoundCounts())
    shell.updateVehicleLightBindings(vehicleSession.getLights().getBoundTargets())
    refreshBeamUi()
  }
  if (hotspotsKey !== lastAppliedHotspotsKey) {
    lastAppliedHotspotsKey = hotspotsKey
    hotspotSession.syncFromProject(snap.project.hotspots)
    refreshHotspotEditor()
  }

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

/** DevTools helper: wipe Studio IndexedDB + last-project key, then reload. */
;(window as unknown as { __iomResetAutomotiveStudio?: () => Promise<void> }).__iomResetAutomotiveStudio =
  async () => {
    clearLastProjectId()
    await idbDeleteStudioDatabase()
    console.info(`[automotive-studio] Cleared ${AUTOMOTIVE_STUDIO_IDB_NAME}. Reloading…`)
    location.reload()
  }

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
  const padCodes: string[] = []
  if (throttle > 0) padCodes.push('KeyW')
  if (throttle < 0) padCodes.push('KeyS')
  if (steer < 0) padCodes.push('KeyA')
  if (steer > 0) padCodes.push('KeyD')
  shell.setDrivePadPressed(padCodes)
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
      repositionHotspotId = null
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
  lastVehicleLightsGpuKey = ''
  vehicleSession.bindScene(renderer.scene, renderer.camera, renderer.renderer, renderer.controls)
  vehicleSession.getLights().setOnProxiesBuilt(() => {
    // Compile SpotLight programs off the toggle path (avoids a multi-second hitch).
    requestAnimationFrame(() => studioRenderer?.warmGpu())
  })
  ensureBeamEditorAttached()
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
  objectInspector.setOnSelectionChange(() => {
    refreshObjectInspector()
    refreshHotspotEditor()
  })
  objectInspector.setOnHoverPick((info) => {
    shell.updateMatPickHover(info)
  })
  refreshObjectInspector()
  hotspotSession.setOnSelect((hotspot) => {
    if (hotspot) openHotspot(hotspot)
    else {
      hotspotCard.close()
      refreshHotspotEditor()
    }
  })
  hotspotSession.setOnPickMesh((result) => {
    if (repositionHotspotId) {
      const id = repositionHotspotId
      repositionHotspotId = null
      repositionHotspotFromPick(id, result)
      return
    }
    createHotspotFromPick(result)
  })
  const cycloramaPickBlocked = () =>
    objectInspector.isPickEnabled() || hotspotSession.isPickMeshMode()
  renderer.canvas.addEventListener('click', (event) => {
    if (cycloramaPickBlocked()) return
    void renderer.tryCycloramaClick(event.clientX, event.clientY)
  })
  renderer.canvas.addEventListener('pointermove', (event) => {
    if (cycloramaPickBlocked()) return
    renderer.updateCycloramaHover(event.clientX, event.clientY)
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
            running: true,
            braking,
            reverse: (status.direction ?? 1) < 0 || vel < -0.5,
            indicatorLeft: false,
            indicatorRight: false,
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
          vehicleSession.getLights().setRouteSignals({
            running: false,
            braking: false,
            reverse: false,
            indicatorLeft: false,
            indicatorRight: false,
          })
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
        (Math.abs(vel) < 0.8 && Math.abs(lastRouteVelocityKmh) > 2)
      vehicleSession.getLights().setRouteSignals({
        running: true,
        braking,
        reverse: vel < -0.5 || (status.throttle ?? 0) < -0.05,
        // A/D (and arrows): flash matching side while the wheel is steered.
        indicatorLeft: (status.steerInput ?? 0) < -0.15,
        indicatorRight: (status.steerInput ?? 0) > 0.15,
      })
      lastRouteVelocityKmh = vel
      if (now - lastRouteStatsAt > 150) {
        lastRouteStatsAt = now
        shell.updateRouteStats(status)
      }
    }

    if (worldShotBlend && studioRenderer) {
      worldShotBlend.elapsed += dt
      const u = easeInOutCubic(Math.min(1, worldShotBlend.elapsed / worldShotBlend.duration))
      studioRenderer.camera.position.lerpVectors(worldShotBlend.fromPos, worldShotBlend.toPos, u)
      studioRenderer.controls.target.lerpVectors(
        worldShotBlend.fromTarget,
        worldShotBlend.toTarget,
        u,
      )
      studioRenderer.camera.fov =
        worldShotBlend.fromFov + (worldShotBlend.toFov - worldShotBlend.fromFov) * u
      studioRenderer.camera.updateProjectionMatrix()
      studioRenderer.camera.lookAt(studioRenderer.controls.target)
      studioRenderer.controls.update()
      if (u >= 1) worldShotBlend = null
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
    shell.setStatus('Loading default project…')
    const seed = await ensureBundledDefaultProject()
    const queryId = new URLSearchParams(location.search).get('project')
    const lastId = readLastProjectId()
    const summaries = await idbListProjectSummaries()
    const bootId = resolveBootProjectId({
      queryProjectId: queryId,
      lastProjectId: lastId,
      summaries,
      bundledDefaultProjectId: BUNDLED_DEFAULT_PROJECT_ID,
    })
    let existing: unknown | null = bootId ? await idbLoadProject(bootId) : null
    // Recheck cache: last-opened, bundled default, or newest summary may still load.
    if (!existing && lastId && lastId !== bootId) {
      existing = await idbLoadProject(lastId)
    }
    if (
      !existing &&
      BUNDLED_DEFAULT_PROJECT_ID !== bootId &&
      BUNDLED_DEFAULT_PROJECT_ID !== lastId
    ) {
      existing = await idbLoadProject(BUNDLED_DEFAULT_PROJECT_ID)
    }
    if (!existing && summaries[0] && summaries[0].id !== bootId && summaries[0].id !== lastId) {
      existing = await idbLoadProject(summaries[0].id)
    }
    if (existing) {
      store.loadProject(migrateProject(existing))
      writeLastProjectId(store.getSnapshot().project.id)
      hydrateProjectRuntime()
      shell.setStatus(
        seed.seeded
          ? 'Imported bundled default · restoring vehicle…'
          : 'Restoring vehicle from IndexedDB…',
      )
      try {
        const restored = await vehicleSession.restoreFromProject(
          store.getSnapshot().project,
          (_r, label) => {
            shell.setStatus(label)
          },
        )
        if (restored) {
          // Bind route / free-drive / hotspots / object+material menus to the restored root.
          syncRouteVehicle()
          shell.updateVehicle(vehicleSession.getSnapshot())
          hydrateProjectRuntime()
          shell.setStatus(
            seed.seeded
              ? `Loaded bundled default “${store.getSnapshot().project.name}”.`
              : `Restored “${store.getSnapshot().project.name}” and vehicle from IndexedDB.`,
          )
        } else {
          objectInspector.setRoot(null)
          refreshObjectInspector()
          shell.setStatus(
            `Restored “${store.getSnapshot().project.name}”. Import a GLB to populate the stage.`,
          )
        }
      } catch (err) {
        objectInspector.setRoot(null)
        refreshObjectInspector()
        shell.setStatus(
          `Project metadata restored, but vehicle blob missing: ${err instanceof Error ? err.message : String(err)}`,
          true,
        )
      }
    } else if (seed.reason === 'failed' || seed.reason === 'skipped-missing-asset') {
      shell.setStatus(
        `Default project unavailable${seed.error ? `: ${seed.error}` : ''}. Import a .iomcar or GLB.`,
        true,
      )
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
    void import('./stage/stageMapPreviews').then(({ disposeStageMapPreviews }) => {
      disposeStageMapPreviews()
    })
    void import('./stage/stageMaterials').then(({ disposeStageTextureCache }) => {
      disposeStageTextureCache()
    })
  })
}

boot().catch((err) => {
  shell.setStatus(`Renderer boot failed: ${err instanceof Error ? err.message : String(err)}`, true)
})
