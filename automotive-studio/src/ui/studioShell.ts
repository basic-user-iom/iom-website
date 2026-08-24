import type {
  AccentLightState,
  AssetRecord,
  EnvironmentState,
  ExperienceMode,
  Hotspot,
  Shot,
  StageState,
  StageSurfaceMaps,
  UiChromeTheme,
  VehicleLightGroupId,
  VehicleLightsState,
} from '../persistence/schema'
import { encodeHotspotMeshKey } from '../hotspots/hotspotContent'
import type { StoreSnapshot } from '../persistence/projectStore'
import type { TransportSnapshot } from '../transport/transport'
import type { StudioRenderer } from '../renderer/createRenderer'
import type { VehicleSessionSnapshot } from '../vehicle/vehicleSession'
import { setGroupLabel, setupCollapsibleGroups } from './collapsibleGroups'
import { setupInspectorResize } from './inspectorResize'
import type { MaterialEditState, MaterialLiveMapSlot, ObjectTreeNode } from '../vehicle/objectInspector'
import { formatBytes } from '../assets/importGlb'
import { formatGpuEstimate } from '../assets/analyzeAsset'
import { CHASE_ORBIT_PRESETS } from '../route/chaseCamera'

const CHASE_ORBIT_PRESET_LOOKUP = CHASE_ORBIT_PRESETS as Record<
  string,
  { yawDeg: number; pitchDeg: number; distance: number }
>

function decimalsFromStep(step: string): number {
  if (!step || step === 'any') return 2
  const i = step.indexOf('.')
  return i < 0 ? 0 : step.length - i - 1
}

/** Sync a slider value label (plain text or editable number input). */
function setSliderVal(el: Element | null | undefined, display: string | number): void {
  if (!el) return
  if (el instanceof HTMLInputElement && el.classList.contains('as-slider-num')) {
    if (document.activeElement === el) return
    const n =
      typeof display === 'number'
        ? display
        : Number(String(display).replace(/[^\d.eE+\-]/g, ''))
    if (!Number.isFinite(n)) return
    const dec = decimalsFromStep(el.step)
    el.value = dec > 0 ? n.toFixed(dec) : String(Math.round(n))
    return
  }
  el.textContent = typeof display === 'number' ? String(display) : display
}

/**
 * Convert plain value labels beside panel ranges into editable number fields.
 * Skips timeline scrubbers, existing sun/moon nums, and log2 texture-tile labels.
 */
function enhancePanelSliderNumbers(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((range) => {
    if (range.matches('[data-scrub], [data-clip-scrub]')) return
    const field = range.closest('.as-field')
    if (!field) return
    if (field.querySelector('input.as-slider-num')) return

    const host =
      (field.querySelector('em') as HTMLElement | null) ??
      (field.querySelector('span[data-ground-val], span[data$="-val"]') as HTMLElement | null)
    if (!host || host.tagName === 'INPUT') return
    if ([...host.attributes].some((a) => a.name.endsWith('-repeat-val'))) return
    if ((host.textContent || '').includes('/')) return

    const raw = (host.textContent || '').trim()
    const unitMatch = raw.match(/(×|°|%| m)$/)
    const unit = unitMatch?.[1] ?? ''

    const num = document.createElement('input')
    num.type = 'number'
    num.className = 'as-slider-num'
    num.min = range.min
    num.max = range.max
    num.step = range.step || 'any'
    const dec = decimalsFromStep(num.step)
    const start = Number(range.value)
    num.value = Number.isFinite(start)
      ? dec > 0
        ? start.toFixed(dec)
        : String(Math.round(start))
      : range.value
    for (const attr of host.attributes) {
      if (attr.name.startsWith('data-')) num.setAttribute(attr.name, attr.value)
    }
    const labelText = (field.querySelector('span, label')?.textContent || 'Value')
      .replace(raw, '')
      .replace(/\s+/g, ' ')
      .trim()
    num.setAttribute('aria-label', labelText || 'Value')

    if (unit) {
      const frag = document.createDocumentFragment()
      frag.appendChild(num)
      frag.appendChild(document.createTextNode(unit))
      host.replaceWith(frag)
    } else {
      host.replaceWith(num)
    }

    const clamp = (n: number) => {
      const min = Number(range.min)
      const max = Number(range.max)
      if (!Number.isFinite(n)) return Number(range.value)
      let v = n
      if (Number.isFinite(min)) v = Math.max(min, v)
      if (Number.isFinite(max)) v = Math.min(max, v)
      if (dec <= 0) v = Math.round(v)
      return v
    }
    const syncFromRange = () => {
      if (document.activeElement === num) return
      const n = Number(range.value)
      if (!Number.isFinite(n)) return
      num.value = dec > 0 ? n.toFixed(dec) : String(Math.round(n))
    }
    const applyFromNum = (commit: boolean) => {
      const rawN = Number(num.value)
      if (!Number.isFinite(rawN)) {
        if (commit) syncFromRange()
        return
      }
      const n = clamp(rawN)
      range.value = String(n)
      num.value = dec > 0 ? n.toFixed(dec) : String(Math.round(n))
      range.dispatchEvent(new Event(commit ? 'change' : 'input', { bubbles: true }))
    }
    num.addEventListener('input', () => applyFromNum(false))
    num.addEventListener('change', () => applyFromNum(true))
    num.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      applyFromNum(true)
      num.blur()
    })
    range.addEventListener('input', syncFromRange)
  })
}

/** Bidirectional range ↔ compact number field for live env scrubbing. */
function bindEnvRange(
  range: HTMLInputElement | null | undefined,
  num: HTMLInputElement | null | undefined,
  opts: {
    decimals?: number
    live: (n: number) => void
    commit: (n: number) => void
  },
): { syncFromStore: (n: number) => void } | null {
  if (!range) return null
  const decimals = opts.decimals ?? 0
  const fmt = (n: number) => (decimals > 0 ? n.toFixed(decimals) : String(Math.round(n)))
  const clamp = (n: number) => {
    const min = Number(range.min)
    const max = Number(range.max)
    if (!Number.isFinite(n)) return Number(range.value)
    let v = Math.min(max, Math.max(min, n))
    if (decimals <= 0) v = Math.round(v)
    return v
  }
  const syncNum = (n: number) => {
    if (!num || document.activeElement === num) return
    num.value = fmt(n)
  }
  const apply = (raw: number, commit: boolean) => {
    const n = clamp(raw)
    range.value = String(n)
    syncNum(n)
    if (commit) opts.commit(n)
    else opts.live(n)
  }
  range.addEventListener('input', () => apply(Number(range.value), false))
  range.addEventListener('change', () => apply(Number(range.value), true))
  if (num) {
    num.addEventListener('input', () => {
      const raw = Number(num.value)
      if (!Number.isFinite(raw)) return
      apply(raw, false)
    })
    num.addEventListener('change', () => {
      const raw = Number(num.value)
      if (!Number.isFinite(raw)) {
        syncNum(Number(range.value))
        return
      }
      apply(raw, true)
    })
    num.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const raw = Number(num.value)
      if (Number.isFinite(raw)) apply(raw, true)
      else syncNum(Number(range.value))
      num.blur()
    })
  }
  return {
    syncFromStore(n: number) {
      const v = clamp(n)
      range.value = String(v)
      syncNum(v)
    },
  }
}

const RAIL_ITEMS = [
  'Vehicle',
  'Objects',
  'Materials',
  'Route',
  'Stage',
  'Environment',
  'Lights',
  'Hotspots',
  'Shots',
  'Deliver',
] as const

export type InspectorSection = (typeof RAIL_ITEMS)[number]

export interface StudioShellOptions {
  mode: ExperienceMode
  uiTheme: UiChromeTheme
  onRename: (name: string) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onExport: () => void
  onImportFile: (file: File) => void
  onNew: () => void
  onPreview: () => void
  onPresent: () => void
  onToggleOrbit: () => void
  onPlayPause: () => void
  onSeek: (t: number) => void
  onEnvironmentPreset: (preset: string) => void
  onEnvironmentPatch: (patch: Partial<EnvironmentState>) => void
  onEnvironmentLive: (patch: Partial<EnvironmentState>) => void
  onUiTheme: (theme: UiChromeTheme) => void
  onImportGlb: (
    files: File[],
    role: 'replace-vehicle' | 'add-prop',
    quality: 'auto' | 'vehicle-master' | 'vehicle-high' | 'vehicle-balanced' | 'vehicle-mobile',
  ) => void
  onClearVehicle: () => void
  onSwitchQuality: (role: 'vehicle-master' | 'vehicle-high' | 'vehicle-balanced' | 'vehicle-mobile') => void
  onImportRigManifest: (file: File) => void
  onCreateDemoRoute: () => void
  onCreateOpenRoute: () => void
  onClearRoute: () => void
  onRouteClosed: (closed: boolean) => void
  onRouteSpeed: (kmh: number, opts?: { commit?: boolean }) => void
  onRouteWheelRoll: (enabled: boolean) => void
  onRouteTireRollRate: (rate: number) => void
  onRouteMaxSteer: (degrees: number) => void
  onRouteBodyRoll: (degrees: number) => void
  onRouteAccel: (mps2: number) => void
  onRouteBrake: (mps2: number) => void
  onRouteStartAccel: (mps2: number) => void
  onRouteEndStop: (mps2: number) => void
  onRouteAddPoint: () => void
  onRouteRemovePoint: () => void
  onRouteReverse: (reverse: boolean) => void
  onRouteStressTest: () => void
  onRouteChaseCamera: (enabled: boolean) => void
  onRouteChaseOrbit: (orbit: {
    yawDeg: number
    pitchDeg: number
    distance: number
    lookAhead: number
    lookSide: number
  }) => void
  onRouteChasePreset: (preset: string) => void
  onRouteOvalScale: (scale: number) => void
  onRouteOpenScale: (scale: number) => void
  onRoutePathScaleBegin: () => void
  onRoutePathScale: (factor: number) => void
  onRoutePathScaleEnd: () => void
  onRouteEditPath: (enabled: boolean) => void
  onFreeDriveEnabled: (enabled: boolean) => void
  onFreeDriveHeadingFlip: (flip: boolean) => void
  /** On-screen WASD pad — same codes as keyboard (`KeyW`… / `Space` clears). */
  onDrivePadKey: (code: string, down: boolean) => void
  onTargetLength: (metres: number | null) => void
  onFlip180: () => void
  onGroundOffset: (metres: number) => void
  onSitOnPedestal: () => void
  onSitOnGround: () => void
  onClipPlay: () => void
  onClipStop: () => void
  onClipSeek: (t: number) => void
  onClipSelect: (index: number) => void
  onSemanticAction: (id: string) => void
  onAddHotspot: () => void
  onPickHotspotMesh: () => void
  onAttachHotspotNode: (nodeName: string) => void
  onSelectHotspot: (id: string) => void
  onDeleteHotspot: (id: string) => void
  /** Snap marker back to the attached node’s default outer face (clears tilt). */
  onRecenterHotspot: (id: string) => void
  /** Enter pick mode to move this hotspot onto a new mesh hit. */
  onRepositionHotspot: (id: string) => void
  onHotspotTitle: (id: string, title: string) => void
  onHotspotBody: (id: string, body: string) => void
  onHotspotDoorAction: (
    id: string,
    actionId: string | null,
    opts?: { startSeconds?: number | null; endSeconds?: number | null; mode?: 'play' | 'toggle' },
  ) => void
  onHotspotMeshVisibility: (
    id: string,
    opts: { nodeKey: string; mode: 'show' | 'hide' | 'toggle' } | null,
  ) => void
  onHotspotMarkerRotation: (id: string, rotationDeg: [number, number, number] | null) => void
  onHotspotMarkerLabelLayout: (
    id: string,
    layout: { scale?: number; offset?: [number, number, number] } | null,
  ) => void
  onHotspotVideo: (id: string, file: File) => void
  onHotspotClearVideo: (id: string) => void
  onHotspotTest: (id: string) => void
  onCaptureShot: () => void
  onGoToShot: (id: string) => void
  onDeleteShot: (id: string) => void
  onSelectShot: (id: string) => void
  onShotName: (id: string, name: string) => void
  onShotPlayAction: (
    id: string,
    actionId: string | null,
    opts?: { startSeconds?: number | null; endSeconds?: number | null },
  ) => void
  onStagePatch: (patch: Partial<StageState>) => void
  onAccentLightsPatch: (patch: Partial<AccentLightState>) => void
  onVehicleLightsPatch: (patch: {
    groups?: Partial<VehicleLightsState['groups']>
    intensity?: number
    proxiesEnabled?: boolean
    autoRunningAtNight?: boolean
    targets?: VehicleLightsState['targets']
    bloomEnabled?: boolean
    bloomStrength?: number
    bloomThreshold?: number
    beamProxies?: VehicleLightsState['beamProxies']
    performanceMode?: VehicleLightsState['performanceMode']
  }) => void
  onVehicleLightAssignSelected: (groupId: VehicleLightGroupId) => void
  onVehicleLightClearGroup: (groupId: VehicleLightGroupId) => void
  onVehicleLightClearAllTargets: () => void
  onVehicleLightSequence: (sequenceId: 'welcome' | 'farewell') => void
  onBeamEditEnabled: (enabled: boolean) => void
  onBeamSelect: (id: string | null) => void
  onBeamGizmoMode: (mode: 'position' | 'aim' | 'rotate') => void
  onBeamDuplicate: () => void
  onBeamAdd: (groupId: 'drl' | 'lowBeam' | 'highBeam' | 'reverse') => void
  onBeamDelete: () => void
  onBeamCopyPositions: () => void
  onBeamResetAuto: () => void
  onStageTexture: (
    surface: 'floor' | 'pedestal' | 'cyclorama',
    map:
      | 'map'
      | 'normal'
      | 'roughness'
      | 'metalness'
      | 'displacement'
      | 'ao'
      | 'emissive'
      | 'clear',
    file?: File,
  ) => void
  /** Import a full PBR pack folder (ambientCG / Poly Haven naming). */
  onStageTexturePack: (surface: 'floor' | 'pedestal' | 'cyclorama', files: File[]) => void
  /** Apply a bundled floor PBR pack (Asphalt / Ice). */
  onStageFloorPreset: (id: 'asphalt' | 'ice') => void
  onCycloramaVideo: (file: File) => void
  onCycloramaClearVideo: () => void
  /** Apply a bundled cyclorama wall video (Video 1 / 2 / 3). */
  onCycloramaVideoPreset: (id: '1' | '2' | '3') => void
  onObjectSelect: (id: string | null) => void
  onObjectVisible: (id: string, visible: boolean) => void
  onObjectPickMode: (enabled: boolean, mode?: 'object' | 'material') => void
  onObjectMaterialIndex: (index: number) => void
  onObjectMaterialPatch: (patch: Record<string, unknown>) => void
  /** Commit current material edit into the project (Undo/reload). */
  onObjectMaterialCommit: () => void
  onVehiclePolishMode: (mode: 'auto' | 'off') => void
  onMaterialPick: (meshId: string, slot: number) => void
  onMaterialTexture: (
    map:
      | 'map'
      | 'normal'
      | 'roughness'
      | 'metalness'
      | 'displacement'
      | 'ao'
      | 'emissive'
      | 'clear',
    file?: File,
  ) => void
  onMaterialTexturePack: (files: File[]) => void
}

export function mountStudioShell(
  root: HTMLElement,
  options: StudioShellOptions,
): {
  viewportHost: HTMLElement
  updateMatPickHover: (
    info: {
      clientX: number
      clientY: number
      meshName: string
      materialName: string
      slot: number
    } | null,
  ) => void
  updateStore: (snap: StoreSnapshot) => void
  updateTransport: (snap: TransportSnapshot) => void
  updateVehicle: (snap: VehicleSessionSnapshot) => void
  setClipTransport: (time: number, duration: number, playing: boolean) => void
  setHotspotNodes: (nodes: Array<{ name: string; path: string }>) => void
  setHotspotEditor: (
    hotspot: Hotspot | null,
    doorActions: Array<{ id: string; label: string; duration?: number }>,
    meta?: {
      videoLabel?: string | null
      meshOptions?: Array<{ key: string; label: string }>
      selectedObjectKey?: string | null
    },
  ) => void
  setShotEditor: (
    shot: Shot | null,
    doorActions: Array<{ id: string; label: string; duration?: number }>,
  ) => void
  updateObjectTree: (nodes: ObjectTreeNode[], selectedId: string | null) => void
  updateObjectMaterial: (
    state: MaterialEditState | null,
    slots: Array<{ index: number; name: string }>,
    selectedSlot?: number,
    mapContext?: {
      overrideMaps?: StageSurfaceMaps
      assets?: AssetRecord[]
      liveMaps?: MaterialLiveMapSlot[]
    },
  ) => void
  updateMaterialList: (
    items: Array<{ key: string; name: string; meshId: string; meshName: string; slot: number }>,
    selectedKey: string | null,
  ) => void
  updateVehicleLightCounts: (counts: Record<VehicleLightGroupId, number>) => void
  updateVehicleLightBindings: (
    rows: Array<{ groupId: VehicleLightGroupId; meshName: string; materialName: string; manual: boolean }>,
  ) => void
  updateBeamList: (
    beams: Array<{ id: string; groupId: string; position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }>,
    selectedId: string | null,
  ) => void
  setBeamCoordsText: (text: string) => void
  setRendererInfo: (renderer: StudioRenderer) => void
  setModeLabel: (mode: ExperienceMode) => void
  setStatus: (message: string, warn?: boolean) => void
  setUiTheme: (theme: UiChromeTheme) => void
  setImportProgress: (ratio: number, label: string) => void
  setOrbitEnabled: (enabled: boolean) => void
  setChaseCameraEnabled: (enabled: boolean) => void
  setChaseOrbit: (orbit: {
    yawDeg: number
    pitchDeg: number
    distance: number
    lookAhead: number
    lookSide: number
  }) => void
  setRouteEditEnabled: (enabled: boolean) => void
  setFreeDriveEnabled: (enabled: boolean) => void
  setDrivePadPressed: (codes: Iterable<string>) => void
  setChaseLockedForFreeDrive: (locked: boolean) => void
  updateRouteStats: (stats: {
    enabled: boolean
    lengthMetres: number
    distanceMetres: number
    speedKmh: number
    bindingCount: number
    yawOffsetDeg?: number
    alignmentSource?: string
    tireRollRate?: number
    radiusMetres?: number
    effectiveRadiusMetres?: number
    wheelbaseMetres?: number
    steerDeg?: number
    maxSteerDeg?: number
    bodyRollDeg?: number
    maxBodyRollDeg?: number
    velocityKmh?: number
    direction?: number
    accelMps2?: number
    brakeMps2?: number
    stress?: string | null
    stressOk?: boolean | null
    ovalScale?: number | null
    openScale?: number | null
    waypointCount?: number
    extentMetres?: number
    editing?: boolean
    calibration?: string
    closed?: boolean
    startAccelMps2?: number
    endStopMps2?: number
    freeDrive?: boolean
    throttle?: number
    steerInput?: number
  }) => void
} {
  root.className = 'as-app as-app--studio'
  root.dataset.theme = options.uiTheme
  root.dataset.stageMapPreviews = 'on'
  root.dataset.matMapPreviews = 'on'
  document.documentElement.dataset.theme = options.uiTheme

  root.innerHTML = `
    <header class="as-top" role="banner">
      <div class="as-brand">
        <strong>IOM Automotive Studio</strong>
        <span data-project-name>Untitled</span>
      </div>
      <div class="as-top-actions" role="toolbar" aria-label="Project actions">
        <div class="as-btn-group" role="group" aria-label="UI theme">
          <button type="button" class="as-btn" data-theme="dark" aria-pressed="${options.uiTheme === 'dark'}">Dark UI</button>
          <button type="button" class="as-btn" data-theme="light" aria-pressed="${options.uiTheme === 'light'}">Light UI</button>
        </div>
        <div class="as-btn-group" role="group" aria-label="History">
          <button type="button" class="as-btn" data-action="undo" aria-keyshortcuts="Control+Z">Undo</button>
          <button type="button" class="as-btn" data-action="redo" aria-keyshortcuts="Control+Y">Redo</button>
        </div>
        <div class="as-btn-group" role="group" aria-label="Project file">
          <button type="button" class="as-btn" data-action="save">Save</button>
          <button type="button" class="as-btn" data-action="export">Export</button>
          <button type="button" class="as-btn" data-action="pick-project">Import</button>
          <input data-import type="file" accept=".iomcar,application/zip,application/json" class="as-file-hidden" tabindex="-1" aria-hidden="true" />
          <button type="button" class="as-btn" data-action="new">New</button>
        </div>
        <div class="as-btn-group" role="group" aria-label="Experience">
          <button type="button" class="as-btn" data-action="orbit" aria-pressed="false" title="Drag to orbit, scroll to zoom, right-drag to pan">Free camera</button>
          <button type="button" class="as-btn" data-action="preview">Preview</button>
        </div>
        <button type="button" class="as-btn as-btn--accent" data-action="present">Present</button>
      </div>
    </header>
    <nav class="as-rail" aria-label="Scene sections">
      <p class="as-rail-label">Scene</p>
      ${RAIL_ITEMS.map(
        (item, i) =>
          `<button type="button" data-rail="${item}"${i === 0 ? ' aria-current="true"' : ''}>${item}</button>`,
      ).join('')}
    </nav>
    <main class="as-viewport" data-viewport tabindex="-1" aria-label="3D viewport"></main>
    <div
      class="as-resizer"
      data-inspector-resizer
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector — drag, arrow keys, or double-click to reset"
      tabindex="0"
    ></div>
    <aside class="as-inspector" aria-label="Inspector">
      <h2 data-inspector-title>Vehicle</h2>

      <div data-panel="Vehicle">
        <div class="as-field">
          <label for="as-name">Project name</label>
          <input id="as-name" data-name maxlength="120" />
        </div>
        <div class="as-btn-group as-btn-group--stack" role="group" aria-label="Model import">
          <button type="button" class="as-btn as-btn--accent" data-action="pick-glb">Import GLB</button>
          <input data-import-glb type="file" accept=".glb,model/gltf-binary" multiple class="as-file-hidden" tabindex="-1" aria-hidden="true" />
          <button type="button" class="as-btn" data-action="pick-rig">Import rig manifesto</button>
          <input data-import-rig type="file" accept=".json,application/json" class="as-file-hidden" tabindex="-1" aria-hidden="true" />
          <button type="button" class="as-btn" data-action="clear-vehicle">Clear vehicle</button>
        </div>
        <div class="as-field">
          <label for="as-role">On import</label>
          <select id="as-role" data-import-role>
            <option value="replace-vehicle">Replace Active Vehicle</option>
            <option value="add-prop">Add as Prop</option>
          </select>
        </div>
        <div class="as-field">
          <label for="as-quality-slot">Quality slot</label>
          <select id="as-quality-slot" data-quality-slot>
            <option value="auto">Auto (filename, or size if multi)</option>
            <option value="vehicle-master">Master / source</option>
            <option value="vehicle-high">High</option>
            <option value="vehicle-balanced">Balanced</option>
            <option value="vehicle-mobile">Mobile</option>
          </select>
        </div>
        <p class="as-hint">Multi-select: largest → High, mid → Balanced, smallest → Mobile.</p>
        <div class="as-field">
          <label for="as-active-quality">Active quality</label>
          <select id="as-active-quality" data-active-quality disabled>
            <option value="">Import High / Balanced / Mobile to switch</option>
          </select>
        </div>
        <p class="as-hint" data-import-progress hidden></p>

        <div class="as-field">
          <label for="as-length">Target length (m)</label>
          <input id="as-length" data-target-length type="number" min="0.5" max="20" step="0.01" placeholder="e.g. 5.10" />
        </div>
        <div class="as-btn-group" role="group" aria-label="Orientation">
          <button type="button" class="as-btn" data-action="flip180">Flip 180°</button>
        </div>
        <div class="as-field">
          <label for="as-ground">Ground offset (m) <span data-ground-val>0.00</span></label>
          <input id="as-ground" data-ground type="range" min="-0.2" max="1.5" step="0.01" value="0" />
          <p class="as-hint">Lift so tires clear the floor — or use Stage → Sit on ground / Sit on pedestal.</p>
        </div>

        <h3 class="as-subhead">Animation</h3>
        <div class="as-field">
          <label for="as-clip">Clip</label>
          <select id="as-clip" data-clip></select>
        </div>
        <div class="as-btn-group" role="group" aria-label="Clip playback">
          <button type="button" class="as-btn" data-action="clip-play">Play clip</button>
          <button type="button" class="as-btn" data-action="clip-stop">Stop / reset pose</button>
        </div>
        <div class="as-field">
          <label for="as-clip-scrub">Clip time <span data-clip-time>0.00 / 0.00</span></label>
          <input id="as-clip-scrub" data-clip-scrub type="range" min="0" max="0" step="0.01" value="0" />
        </div>
        <h3 class="as-subhead">Semantic actions</h3>
        <div class="as-btn-group as-btn-group--wrap" data-semantic-actions role="group" aria-label="Semantic actions">
          <span class="as-hint">Import a vehicle with clips to list actions.</span>
        </div>

        <h3 class="as-subhead">Compatibility</h3>
        <dl data-report class="as-report">
          <div><dt>Status</dt><dd>No vehicle imported</dd></div>
        </dl>
      </div>

      <div data-panel="Objects" hidden>
        <p class="as-hint">Select meshes for visibility, pick mode, and material editing. Open Materials to tune PBR.</p>
        <label class="as-field">
          <span>Object</span>
          <select data-object-select aria-label="Vehicle objects">
            <option value="">— none —</option>
          </select>
        </label>
        <div class="as-object-toolbar">
          <label class="as-check"><input type="checkbox" data-object-visible checked disabled /> Visible</label>
          <button type="button" class="as-btn" data-action="object-deselect" disabled>Deselect</button>
          <label class="as-check"><input type="checkbox" data-object-pick /> Click viewport to pick</label>
          <label class="as-check"><input type="checkbox" data-object-filter-hidden /> Off only</label>
        </div>
        <p class="as-hint as-object-meta" data-object-meta hidden></p>
        <p class="as-hint" data-object-hidden-summary hidden></p>
        <div class="as-object-tree" data-object-tree hidden role="listbox" aria-label="Object visibility"></div>
        <p class="as-hint">Material colour, metalness, clearcoat and more live in the <strong>Materials</strong> panel.</p>
      </div>

      <div data-panel="Materials" hidden>
        <p class="as-hint">Click the car to pick a material (eyedropper cursor), or choose from the list. Edits persist on Save / reload / quality switch.</p>
        <label class="as-check"><input type="checkbox" data-vehicle-polish checked /> Auto polish glass / paint / chrome</label>
        <label class="as-check"><input type="checkbox" data-mat-pick checked /> Eyedropper pick in viewport</label>

        <h3 class="as-subhead">Materials</h3>
        <label class="as-field">
          <span>Pick material</span>
          <select data-mat-list aria-label="Vehicle materials">
            <option value="">— import a vehicle first —</option>
          </select>
        </label>

        <label class="as-field">
          <span>Selected mesh</span>
          <select data-mat-object-select aria-label="Material object">
            <option value="">— select or pick —</option>
          </select>
        </label>
        <p class="as-hint as-object-meta" data-mat-object-meta hidden></p>

        <div data-object-material hidden>
          <h3 class="as-subhead">Edit</h3>
          <div class="as-field">
            <label for="as-mat-slot">Slot on mesh</label>
            <select id="as-mat-slot" data-mat-slot></select>
          </div>
          <p class="as-hint" data-mat-name>—</p>

          <h3 class="as-subhead">Presets</h3>
          <div class="as-btn-group as-btn-group--wrap" role="group" aria-label="Material presets">
            <button type="button" class="as-btn" data-mat-preset="white-paint">White paint</button>
            <button type="button" class="as-btn" data-mat-preset="black-paint">Black paint</button>
            <button type="button" class="as-btn" data-mat-preset="chrome">Chrome</button>
            <button type="button" class="as-btn" data-mat-preset="glass">Glass</button>
          </div>

          <h3 class="as-subhead">Base</h3>
          <label class="as-field"><span>Color</span><input data-mat-color type="color" value="#888888" /></label>
          <label class="as-field"><span>Metalness <em data-mat-metal-val>0.00</em></span>
            <input data-mat-metal type="range" min="0" max="1" step="0.01" value="0" /></label>
          <label class="as-field"><span>Roughness <em data-mat-rough-val>0.50</em></span>
            <input data-mat-rough type="range" min="0" max="1" step="0.01" value="0.5" /></label>
          <label class="as-field"><span>Env map intensity <em data-mat-env-val>1.00</em></span>
            <input data-mat-env type="range" min="0" max="3" step="0.05" value="1" /></label>

          <h3 class="as-subhead">Emission</h3>
          <label class="as-field"><span>Emissive</span><input data-mat-emissive type="color" value="#000000" /></label>
          <label class="as-field"><span>Emissive intensity <em data-mat-emi-val>0.00</em></span>
            <input data-mat-emi type="range" min="0" max="4" step="0.05" value="0" /></label>

          <h3 class="as-subhead">Opacity</h3>
          <label class="as-field"><span>Opacity <em data-mat-opacity-val>1.00</em></span>
            <input data-mat-opacity type="range" min="0" max="1" step="0.01" value="1" /></label>
          <label class="as-check"><input type="checkbox" data-mat-transparent /> Transparent</label>

          <div data-mat-physical>
            <h3 class="as-subhead">Physical</h3>
            <label class="as-field"><span>Clearcoat <em data-mat-cc-val>0.00</em></span>
              <input data-mat-cc type="range" min="0" max="1" step="0.01" value="0" /></label>
            <label class="as-field"><span>Clearcoat rough <em data-mat-ccr-val>0.00</em></span>
              <input data-mat-ccr type="range" min="0" max="1" step="0.01" value="0" /></label>
            <label class="as-field"><span>Transmission <em data-mat-trans-val>0.00</em></span>
              <input data-mat-trans type="range" min="0" max="1" step="0.01" value="0" /></label>
          </div>

          <h3 class="as-subhead">Texture maps</h3>
          <p class="as-hint">Preview maps from the GLB, or upload / pack PBR textures. For <a href="https://ambientcg.com/" target="_blank" rel="noopener">ambientCG</a>: download a JPG pack, unzip, then <strong>Load pack folder</strong> (replaces all maps on this material). Click a thumbnail to enlarge. Displacement is skipped on vehicles. We recommend <strong>1K</strong> textures for ground / large surfaces for performance.</p>
          <label class="as-field"><span>Texture tiles <em data-mat-map-repeat-val>1.00×</em></span>
            <input data-mat-map-repeat type="range" min="-4" max="10" step="0.02" value="0" /></label>
          <label class="as-check"><input type="checkbox" data-mat-map-triplanar /> Same size on all panels</label>
          <label class="as-field"><span>Break tiling <em data-mat-map-vary-val>0.25</em></span>
            <input data-mat-map-vary type="range" min="0" max="1" step="0.01" value="0.25" /></label>
          <p class="as-hint">Soft world-space triplanar (no UV atlas, no hard box seams). Keep on for foil/paint packs. Randomize re-seeds cell jitter.</p>
          <label class="as-check"><input type="checkbox" data-mat-map-previews checked /> Show texture map previews</label>
          <div class="as-map-slots" data-mat-maps>
            <div class="as-map-slot" data-mat-map-slot="map">
              <button type="button" class="as-btn" data-mat-map="map">Albedo</button>
              <span class="as-map-slot-file" data-mat-map-file-label="map">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="map" hidden title="Remove albedo">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="normal">
              <button type="button" class="as-btn" data-mat-map="normal">Normal</button>
              <span class="as-map-slot-file" data-mat-map-file-label="normal">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="normal" hidden title="Remove normal">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="roughness">
              <button type="button" class="as-btn" data-mat-map="roughness">Rough</button>
              <span class="as-map-slot-file" data-mat-map-file-label="roughness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="roughness" hidden title="Remove roughness">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="metalness">
              <button type="button" class="as-btn" data-mat-map="metalness">Metal</button>
              <span class="as-map-slot-file" data-mat-map-file-label="metalness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="metalness" hidden title="Remove metalness">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="displacement">
              <button type="button" class="as-btn" data-mat-map="displacement">Depth</button>
              <span class="as-map-slot-file" data-mat-map-file-label="displacement">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="displacement" hidden title="Remove depth">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="ao">
              <button type="button" class="as-btn" data-mat-map="ao">AO</button>
              <span class="as-map-slot-file" data-mat-map-file-label="ao">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="ao" hidden title="Remove AO">Remove</button>
            </div>
            <div class="as-map-slot" data-mat-map-slot="emissive">
              <button type="button" class="as-btn" data-mat-map="emissive">Emit map</button>
              <span class="as-map-slot-file" data-mat-map-file-label="emissive">None</span>
              <button type="button" class="as-btn as-btn--compact" data-mat-map-remove="emissive" hidden title="Remove emissive">Remove</button>
            </div>
            <button type="button" class="as-btn" data-mat-map-clear>Clear maps</button>
            <button type="button" class="as-btn as-btn--accent" data-mat-map-reseed title="Shift and spin the triplanar pattern without changing size">Randomize pattern</button>
            <button type="button" class="as-btn as-btn--accent" data-mat-map-pack title="Replaces all maps on this material with the folder (Color, NormalGL, Roughness…)">Load pack folder</button>
          </div>
          <input data-mat-map-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden />
          <input data-mat-map-pack-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple webkitdirectory directory hidden />
        </div>
        <p class="as-hint" data-mat-empty>Pick a material in the viewport or choose one from the list.</p>
      </div>

      <div data-panel="Environment" hidden>
        <div class="as-field">
          <label for="as-env">Scene preset</label>
          <select id="as-env" data-env>
            <option value="studio">Studio</option>
            <option value="day">Day</option>
            <option value="golden-hour">Golden Hour</option>
            <option value="night">Night</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <label class="as-field"><span>Camera exposure <em data-exposure-val>1.00</em></span>
          <input data-exposure type="range" min="0.4" max="1.8" step="0.01" value="1" /></label>
        <label class="as-field"><span>IBL intensity <em data-env-intensity-val>1.00</em></span>
          <input data-env-intensity type="range" min="0.2" max="2.5" step="0.01" value="1" /></label>
        <label class="as-check"><input data-hdr type="checkbox" checked /> Soft sky response</label>
        <label class="as-check"><input data-stars type="checkbox" /> Stars</label>

        <h3 class="as-subhead">Sun</h3>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-sun-enabled type="checkbox" checked /> Sun light</label>
          <label class="as-check"><input data-sun-disc type="checkbox" checked /> Sun disc</label>
        </div>
        <div class="as-field">
          <label for="as-sun-az">Azimuth
            <input class="as-slider-num" data-sun-az-val type="number" min="0" max="360" step="1" value="135" aria-label="Sun azimuth degrees" />°</label>
          <input id="as-sun-az" data-sun-az type="range" min="0" max="360" step="1" value="135" />
        </div>
        <div class="as-field">
          <label for="as-sun-el">Elevation
            <input class="as-slider-num" data-sun-el-val type="number" min="-20" max="85" step="1" value="42" aria-label="Sun elevation degrees" />°</label>
          <input id="as-sun-el" data-sun-el type="range" min="-20" max="85" step="1" value="42" />
        </div>
        <label class="as-field"><span>Light intensity
            <input class="as-slider-num" data-sun-intensity-val type="number" min="0" max="2" step="0.05" value="1" aria-label="Sun light intensity" /></span>
          <input data-sun-intensity type="range" min="0" max="2" step="0.05" value="1" /></label>
        <label class="as-field"><span>Angular size °
            <input class="as-slider-num" data-sun-ang-val type="number" min="0.2" max="3" step="0.01" value="0.53" aria-label="Sun angular size degrees" /></span>
          <input data-sun-ang type="range" min="0.2" max="3" step="0.01" value="0.53" /></label>
        <label class="as-field"><span>Artistic size
            <input class="as-slider-num" data-sun-disc-scale-val type="number" min="0.2" max="3" step="0.05" value="1" aria-label="Sun artistic size" />×</span>
          <input data-sun-disc-scale type="range" min="0.2" max="3" step="0.05" value="1" /></label>

        <h3 class="as-subhead">Moon</h3>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-moon type="checkbox" /> Moon visible</label>
          <label class="as-check"><input data-moon-key type="checkbox" /> Use as key light</label>
        </div>
        <div class="as-field">
          <label for="as-moon-az">Azimuth
            <input class="as-slider-num" data-moon-az-val type="number" min="0" max="360" step="1" value="295" aria-label="Moon azimuth degrees" />°</label>
          <input id="as-moon-az" data-moon-az type="range" min="0" max="360" step="1" value="295" />
        </div>
        <div class="as-field">
          <label for="as-moon-el">Elevation
            <input class="as-slider-num" data-moon-el-val type="number" min="-20" max="85" step="1" value="28" aria-label="Moon elevation degrees" />°</label>
          <input id="as-moon-el" data-moon-el type="range" min="-20" max="85" step="1" value="28" />
        </div>
        <label class="as-field"><span>Brightness
            <input class="as-slider-num" data-moon-intensity-val type="number" min="0.1" max="3" step="0.05" value="1" aria-label="Moon brightness" /></span>
          <input data-moon-intensity type="range" min="0.1" max="3" step="0.05" value="1" /></label>
        <label class="as-field"><span>Angular size °
            <input class="as-slider-num" data-moon-ang-val type="number" min="0.2" max="3" step="0.01" value="0.53" aria-label="Moon angular size degrees" /></span>
          <input data-moon-ang type="range" min="0.2" max="3" step="0.01" value="0.53" /></label>
        <label class="as-field"><span>Artistic size
            <input class="as-slider-num" data-moon-scale-val type="number" min="0.2" max="3" step="0.05" value="1" aria-label="Moon artistic size" />×</span>
          <input data-moon-scale type="range" min="0.2" max="3" step="0.05" value="1" /></label>
        <label class="as-field"><span>Phase
            <input class="as-slider-num" data-moon-phase-val type="number" min="0" max="1" step="0.01" value="0.5" aria-label="Moon phase" /></span>
          <input data-moon-phase type="range" min="0" max="1" step="0.01" value="0.5" /></label>
        <p class="as-hint">Sun and moon are independent. Night presets enable the moon as key light; Day uses the sun. Camera-relative sky — no parallax on long routes. Type a value next to any slider, or drag.</p>
      </div>

      <div data-panel="Route" hidden>
        <p class="as-hint">Route follow or free drive (WASD). Free drive uses an infinite floor so you never leave the pad.</p>

        <h3 class="as-subhead">Free drive</h3>
        <label class="as-check"><input data-free-drive type="checkbox" /> Free drive (WASD)</label>
        <label class="as-check"><input data-free-drive-heading-flip type="checkbox" /> Invert drive direction</label>
        <p class="as-hint"><strong>W</strong> forward · <strong>S</strong> reverse · <strong>A/D</strong> steer · <strong>Space</strong> stop — keyboard or the on-screen pad. If W still goes toward the rear, tick <em>Invert drive direction</em> (saved with the project). A/D always steer relative to the car body.</p>

        <h3 class="as-subhead">Route</h3>
        <div class="as-btn-group as-btn-group--stack" role="group" aria-label="Route actions">
          <button type="button" class="as-btn as-btn--accent" data-action="route-demo">Create demo oval</button>
          <button type="button" class="as-btn" data-action="route-open">Create open path</button>
          <button type="button" class="as-btn" data-action="route-clear">Clear route</button>
          <button type="button" class="as-btn" data-action="route-stress">Run 5-lap check</button>
        </div>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-route-closed type="checkbox" checked /> Closed loop</label>
          <label class="as-check"><input data-route-roll type="checkbox" checked /> Distance-linked tire roll</label>
          <label class="as-check"><input data-route-chase type="checkbox" /> Chase camera</label>
          <label class="as-check"><input data-route-edit type="checkbox" /> Edit path</label>
          <label class="as-check"><input data-route-reverse type="checkbox" /> Reverse</label>
        </div>
        <div class="as-field">
          <label for="as-route-speed">Cruise (km/h) <span data-route-speed-val>18</span></label>
          <input id="as-route-speed" data-route-speed type="range" min="5" max="60" step="1" value="18" />
        </div>
        <div class="as-field">
          <label for="as-route-accel">Cruise accel (m/s²) <span data-route-accel-val>2.2</span></label>
          <input id="as-route-accel" data-route-accel type="range" min="0.5" max="8" step="0.1" value="2.2" />
        </div>
        <div class="as-field">
          <label for="as-route-brake">Cruise brake (m/s²) <span data-route-brake-val>4.0</span></label>
          <input id="as-route-brake" data-route-brake type="range" min="1" max="12" step="0.1" value="4" />
        </div>
        <div class="as-field">
          <label for="as-route-start-accel">Open start accel <span data-route-start-accel-val>2.2</span></label>
          <input id="as-route-start-accel" data-route-start-accel type="range" min="0.5" max="10" step="0.1" value="2.2" />
        </div>
        <div class="as-field">
          <label for="as-route-end-stop">Open end stop <span data-route-end-stop-val>4.5</span></label>
          <input id="as-route-end-stop" data-route-end-stop type="range" min="1" max="14" step="0.1" value="4.5" />
        </div>
        <div class="as-btn-group as-btn-group--wrap" role="group" aria-label="Waypoint edit">
          <button type="button" class="as-btn as-btn--compact" data-action="route-add-point">+ Point</button>
          <button type="button" class="as-btn as-btn--compact" data-action="route-remove-point">− Point</button>
        </div>
        <p class="as-hint">Edit path: drag markers. <strong>Alt-click</strong> ground to add · <strong>Delete</strong> removes selected. Open paths ease in at start and brake to a stop at the end.</p>
        <div class="as-field" data-chase-orbit-block>
          <span class="as-label">Chase view</span>
          <div class="as-btn-group as-btn-group--wrap" role="group" aria-label="Chase angle presets">
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="rear">Rear</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="three-quarter-left">¾ L</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="three-quarter-right">¾ R</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="side-left">Side L</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="side-right">Side R</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="front">Front</button>
            <button type="button" class="as-btn as-btn--compact" data-chase-preset="high">High</button>
          </div>
        </div>
        <div class="as-field">
          <label for="as-chase-yaw">Orbit yaw <span data-chase-yaw-val>28°</span></label>
          <input id="as-chase-yaw" data-chase-yaw type="range" min="-180" max="180" step="1" value="28" />
        </div>
        <div class="as-field">
          <label for="as-chase-pitch">Orbit pitch <span data-chase-pitch-val>18°</span></label>
          <input id="as-chase-pitch" data-chase-pitch type="range" min="5" max="70" step="1" value="18" />
        </div>
        <div class="as-field">
          <label for="as-chase-dist">Chase distance <span data-chase-dist-val>7.8 m</span></label>
          <input id="as-chase-dist" data-chase-dist type="range" min="3.5" max="24" step="0.1" value="7.8" />
        </div>
        <div class="as-field">
          <label for="as-chase-target">Target forward <span data-chase-target-val>1.0 m</span></label>
          <input id="as-chase-target" data-chase-target type="range" min="-1.5" max="4" step="0.05" value="1" />
        </div>
        <p class="as-hint">Drag = orbit · scroll = zoom · <strong>Shift-drag</strong> or right-drag = nudge framing · Shift-scroll = target forward.</p>
        <div class="as-field" data-oval-size-block>
          <label for="as-route-oval">New oval size <span data-route-oval-val>1.00×</span></label>
          <input id="as-route-oval" data-route-oval type="range" min="0.45" max="2.2" step="0.05" value="1" />
        </div>
        <div class="as-field" data-open-size-block hidden>
          <label for="as-route-open">New open size <span data-route-open-val>1.00×</span></label>
          <input id="as-route-open" data-route-open type="range" min="0.45" max="2.2" step="0.05" value="1" />
        </div>
        <div class="as-field">
          <label for="as-route-path-scale">Scale path <span data-route-path-scale-val>1.00×</span></label>
          <input id="as-route-path-scale" data-route-path-scale type="range" min="0.5" max="10" step="0.05" value="1" />
        </div>
        <div class="as-field">
          <label for="as-route-roll-rate">Tire roll speed <span data-route-roll-rate-val>1.00×</span></label>
          <input id="as-route-roll-rate" data-route-roll-rate type="range" min="0.3" max="2" step="0.02" value="1" />
        </div>
        <div class="as-field">
          <label for="as-route-steer">Steering lock <span data-route-steer-val>35°</span></label>
          <input id="as-route-steer" data-route-steer type="range" min="0" max="50" step="1" value="35" />
        </div>
        <div class="as-field">
          <label for="as-route-body-roll">Body lean <span data-route-body-roll-val>3.5°</span></label>
          <input id="as-route-body-roll" data-route-body-roll type="range" min="0" max="10" step="0.5" value="3.5" />
        </div>
        <dl data-route-stats class="as-report">
          <div><dt>Status</dt><dd>No route</dd></div>
        </dl>
                <p class="as-hint">Import a *-rigged.glb + manifesto, then create an oval or open path. <strong>Scale path</strong> resizes the current shape. <strong>New oval/open size</strong> rebuilds that template (only shown for the matching path type).</p>
      </div>

      <div data-panel="Hotspots" hidden>
        <p class="as-hint">Add markers, then open one in the list to edit it. Markers parent to a mesh/door so they follow animation. Link a door/clip under <strong>Door / animation on open</strong> — the card’s Animation button plays it.</p>
        <button type="button" class="as-btn as-btn--accent" data-action="hotspot-pick">Pick mesh / door</button>
        <button type="button" class="as-btn" data-action="hotspot-add">Add at vehicle center</button>
        <label class="as-field">
          <span>Attach to node</span>
          <select data-hotspot-nodes>
            <option value="">— load a vehicle first —</option>
          </select>
        </label>
        <button type="button" class="as-btn" data-action="hotspot-attach-node">Add on selected node</button>
        <h3 class="as-subhead">Hotspots</h3>
        <p class="as-hint" data-hotspot-list-hint>Click a hotspot to expand actions and edit.</p>
        <div class="as-hotspot-list" data-hotspot-list></div>
        <div class="as-hotspot-editor-park" data-hotspot-editor-park hidden>
          <div class="as-hotspot-editor" data-hotspot-editor hidden>
            <h3 data-hotspot-editor-heading>Edit hotspot</h3>
            <label class="as-field">
              <span>Title</span>
              <input type="text" data-hotspot-title maxlength="80" />
            </label>
            <label class="as-field">
              <span>Text (appears on open)</span>
              <textarea data-hotspot-body rows="4" placeholder="Describe this feature…"></textarea>
            </label>
            <label class="as-field">
              <span>Door / animation on open</span>
              <select data-hotspot-door-action>
                <option value="">— none —</option>
              </select>
            </label>
            <label class="as-field">
              <span>Playback</span>
              <select data-hotspot-door-mode>
                <option value="toggle">Toggle open / close (reverse)</option>
                <option value="play">Play once (always open)</option>
              </select>
            </label>
            <div class="as-row as-hotspot-clip-range">
              <label class="as-field">
                <span>Start at (s)</span>
                <input type="number" data-hotspot-clip-start min="0" step="0.05" placeholder="0" />
              </label>
              <label class="as-field">
                <span>End at (s)</span>
                <input type="number" data-hotspot-clip-end min="0" step="0.05" placeholder="full" />
              </label>
            </div>
            <p class="as-hint" data-hotspot-clip-hint>
              Skip empty lead-in — e.g. start at 1.2 if the door only moves after that.
            </p>
            <h3 class="as-subhead">Mesh visibility on open</h3>
            <p class="as-hint">Show, hide, or toggle a vehicle mesh when this hotspot opens (use Objects panel to pick one).</p>
            <label class="as-field">
              <span>Mesh / node</span>
              <select data-hotspot-mesh-node>
                <option value="">— none —</option>
              </select>
            </label>
            <label class="as-field">
              <span>Visibility</span>
              <select data-hotspot-mesh-mode>
                <option value="hide">Hide mesh</option>
                <option value="show">Show mesh</option>
                <option value="toggle">Toggle visibility</option>
              </select>
            </label>
            <button type="button" class="as-btn" data-action="hotspot-mesh-use-selected">Use selected object</button>
            <h3 class="as-subhead">Marker on surface</h3>
            <p class="as-hint">Rings and title sit on the door plane. Tilt if the pick missed the surface.</p>
            <label class="as-field"><span>Tilt X <em data-hotspot-rot-x-val>0°</em></span>
              <input data-hotspot-rot-x type="range" min="-180" max="180" step="1" value="0" /></label>
            <label class="as-field"><span>Tilt Y <em data-hotspot-rot-y-val>0°</em></span>
              <input data-hotspot-rot-y type="range" min="-180" max="180" step="1" value="0" /></label>
            <label class="as-field"><span>Tilt Z <em data-hotspot-rot-z-val>0°</em></span>
              <input data-hotspot-rot-z type="range" min="-180" max="180" step="1" value="0" /></label>
            <button type="button" class="as-btn" data-action="hotspot-rot-reset">Reset tilt to surface</button>
            <h3 class="as-subhead">Title plate</h3>
            <p class="as-hint">Aligned to the door like the rings. Move with offset; Z lifts off the paint.</p>
            <label class="as-field"><span>Size <em data-hotspot-label-scale-val>1.00×</em></span>
              <input data-hotspot-label-scale type="range" min="0.3" max="3" step="0.05" value="1" /></label>
            <label class="as-field"><span>Offset X <em data-hotspot-label-ox-val>0.00</em></span>
              <input data-hotspot-label-ox type="range" min="-6" max="6" step="0.05" value="0" /></label>
            <label class="as-field"><span>Offset Y <em data-hotspot-label-oy-val>2.40</em></span>
              <input data-hotspot-label-oy type="range" min="-6" max="6" step="0.05" value="2.4" /></label>
            <label class="as-field"><span>Lift Z <em data-hotspot-label-oz-val>0.04</em></span>
              <input data-hotspot-label-oz type="range" min="-0.5" max="1.5" step="0.01" value="0.04" /></label>
            <button type="button" class="as-btn" data-action="hotspot-label-reset">Reset title size &amp; position</button>
            <label class="as-field">
              <span>Video (plays on open)</span>
              <input type="file" data-hotspot-video accept="video/*,.mp4,.webm,.mov" />
            </label>
            <p class="as-hint" data-hotspot-video-label>No video attached.</p>
            <div class="as-row">
              <button type="button" class="as-btn" data-action="hotspot-clear-video">Clear video</button>
              <button type="button" class="as-btn as-btn--accent" data-action="hotspot-test">Test open</button>
            </div>
          </div>
        </div>
      </div>

      <div data-panel="Shots" hidden>
        <p class="as-hint">Capture a camera view (follows the car). Optionally play a door/clip animation when the view is recalled.</p>
        <button type="button" class="as-btn as-btn--accent" data-action="shot-capture">Capture current camera</button>
        <div class="as-item-list" data-shot-list></div>
        <div class="as-shot-editor" data-shot-editor hidden>
          <h3 data-shot-editor-heading>Edit view</h3>
          <label class="as-field">
            <span>Name</span>
            <input type="text" data-shot-name maxlength="80" />
          </label>
          <label class="as-field">
            <span>Play animation on go</span>
            <select data-shot-play-action>
              <option value="">— none —</option>
            </select>
          </label>
          <div class="as-row as-hotspot-clip-range">
            <label class="as-field">
              <span>Start at (s)</span>
              <input type="number" data-shot-clip-start min="0" step="0.05" placeholder="0" />
            </label>
            <label class="as-field">
              <span>End at (s)</span>
              <input type="number" data-shot-clip-end min="0" step="0.05" placeholder="full" />
            </label>
          </div>
          <p class="as-hint" data-shot-clip-hint>
            Same clip trim as hotspots — skip empty lead-in if the door moves late.
          </p>
          <div class="as-row">
            <button type="button" class="as-btn as-btn--accent" data-action="shot-go-edit">Go to view</button>
            <button type="button" class="as-btn" data-action="shot-delete-edit">Delete</button>
          </div>
        </div>
      </div>

      <div data-panel="Stage" hidden>
        <p class="as-hint">Floor, pedestal and cyclorama — size, colour, PBR maps, emissive. For <a href="https://ambientcg.com/" target="_blank" rel="noopener">ambientCG</a>: download a JPG pack, unzip, then <strong>Load pack folder</strong> (replaces all maps on that surface). Click a thumbnail to enlarge. We recommend <strong>1K</strong> textures for the floor / ground for performance.</p>
        <label class="as-check"><input type="checkbox" data-stage-map-previews checked /> Show texture map previews</label>
        <div class="as-stage-surface" data-stage-surface="floor">
          <h3>Floor</h3>
          <label class="as-check"><input type="checkbox" data-stage-floor checked /> Visible</label>
          <label class="as-field"><span>Size (diameter m) <em data-stage-floor-size-val>28</em></span>
            <input data-stage-floor-size type="range" min="8" max="120" step="1" value="28" /></label>
          <button type="button" class="as-btn as-btn--accent as-btn--block" data-action="sit-on-ground">Sit car on ground</button>
          <p class="as-hint">Sets Vehicle ground offset to 0 so tires rest on the floor (not the pedestal).</p>
          <label class="as-field"><span>Color</span><input data-stage-floor-color type="color" value="#161a22" /></label>
          <label class="as-field"><span>Metalness <em data-stage-floor-metal-val>0.35</em></span>
            <input data-stage-floor-metal type="range" min="0" max="1" step="0.01" value="0.35" /></label>
          <label class="as-field"><span>Roughness <em data-stage-floor-rough-val>0.55</em></span>
            <input data-stage-floor-rough type="range" min="0" max="1" step="0.01" value="0.55" /></label>
          <label class="as-field"><span>Emissive</span><input data-stage-floor-emissive type="color" value="#000000" /></label>
          <label class="as-field"><span>Emissive intensity <em data-stage-floor-emi-val>0.00</em></span>
            <input data-stage-floor-emi type="range" min="0" max="8" step="0.05" value="0" /></label>
          <label class="as-field"><span>Texture tiles <em data-stage-floor-repeat-val>1.00×</em></span>
            <input data-stage-floor-repeat type="range" min="-4" max="10" step="0.02" value="0" /></label>
          <label class="as-field"><span>Depth scale <em data-stage-floor-disp-val>0.00</em></span>
            <input data-stage-floor-disp type="range" min="0" max="0.4" step="0.01" value="0" /></label>
          <label class="as-field"><span>Break tiling <em data-stage-floor-vary-val>0.00</em></span>
            <input data-stage-floor-vary type="range" min="0" max="1" step="0.01" value="0" /></label>
          <p class="as-hint">Randomise spins maps on the static pad. While free-driving, only soft shader de-tile is used so the road stays locked to the car heading.</p>
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-floor-reseed>Randomise pattern</button>
          </div>
          <div class="as-map-slots" data-stage-maps="floor">
            <div class="as-map-slot" data-stage-map-slot="floor:map">
              <button type="button" class="as-btn" data-stage-map="floor:map">Albedo</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:map">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:map" hidden title="Remove albedo">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:normal">
              <button type="button" class="as-btn" data-stage-map="floor:normal">Normal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:normal">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:normal" hidden title="Remove normal">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:roughness">
              <button type="button" class="as-btn" data-stage-map="floor:roughness">Rough</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:roughness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:roughness" hidden title="Remove roughness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:metalness">
              <button type="button" class="as-btn" data-stage-map="floor:metalness">Metal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:metalness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:metalness" hidden title="Remove metalness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:displacement">
              <button type="button" class="as-btn" data-stage-map="floor:displacement">Depth</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:displacement">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:displacement" hidden title="Remove depth">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:ao">
              <button type="button" class="as-btn" data-stage-map="floor:ao">AO</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:ao">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:ao" hidden title="Remove AO">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="floor:emissive">
              <button type="button" class="as-btn" data-stage-map="floor:emissive">Emit map</button>
              <span class="as-map-slot-file" data-stage-map-file-label="floor:emissive">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="floor:emissive" hidden title="Remove emissive">Remove</button>
            </div>
            <button type="button" class="as-btn" data-stage-map-clear="floor">Clear maps</button>
            <button type="button" class="as-btn as-btn--accent" data-stage-map-pack="floor" title="Replaces all maps on this surface with the folder (Color, NormalGL, Roughness…)">Load pack folder</button>
            <div class="as-map-row">
              <button type="button" class="as-btn" data-stage-floor-preset="asphalt" title="Apply bundled Asphalt 011 ground maps">Asphalt</button>
              <button type="button" class="as-btn" data-stage-floor-preset="ice" title="Apply bundled Ice ground maps">Ice</button>
            </div>
          </div>
        </div>
        <div class="as-stage-surface" data-stage-surface="pedestal">
          <h3>Pedestal</h3>
          <label class="as-check"><input type="checkbox" data-stage-pedestal checked /> Visible</label>
          <label class="as-field"><span>Size (diameter m) <em data-stage-pedestal-size-val>4.8</em></span>
            <input data-stage-pedestal-size type="range" min="0.5" max="20" step="0.1" value="4.8" /></label>
          <label class="as-field"><span>Thickness (m) <em data-stage-pedestal-height-val>0.12</em></span>
            <input data-stage-pedestal-height type="range" min="0.02" max="0.8" step="0.01" value="0.12" /></label>
          <button type="button" class="as-btn as-btn--accent as-btn--block" data-action="sit-on-pedestal">Sit car on pedestal</button>
          <p class="as-hint">Matches Vehicle ground offset to pedestal top so tires don’t sink through.</p>
          <label class="as-field"><span>Color</span><input data-stage-pedestal-color type="color" value="#1c222c" /></label>
          <label class="as-field"><span>Metalness <em data-stage-pedestal-metal-val>0.45</em></span>
            <input data-stage-pedestal-metal type="range" min="0" max="1" step="0.01" value="0.45" /></label>
          <label class="as-field"><span>Roughness <em data-stage-pedestal-rough-val>0.40</em></span>
            <input data-stage-pedestal-rough type="range" min="0" max="1" step="0.01" value="0.40" /></label>
          <label class="as-field"><span>Emissive</span><input data-stage-pedestal-emissive type="color" value="#000000" /></label>
          <label class="as-field"><span>Emissive intensity <em data-stage-pedestal-emi-val>0.00</em></span>
            <input data-stage-pedestal-emi type="range" min="0" max="8" step="0.05" value="0" /></label>
          <label class="as-field"><span>Texture tiles <em data-stage-pedestal-repeat-val>1.00×</em></span>
            <input data-stage-pedestal-repeat type="range" min="-4" max="10" step="0.02" value="0" /></label>
          <label class="as-field"><span>Depth scale <em data-stage-pedestal-disp-val>0.00</em></span>
            <input data-stage-pedestal-disp type="range" min="0" max="0.4" step="0.01" value="0" /></label>
          <label class="as-field"><span>Break tiling <em data-stage-pedestal-vary-val>0.00</em></span>
            <input data-stage-pedestal-vary type="range" min="0" max="1" step="0.01" value="0" /></label>
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-pedestal-reseed>Randomise pattern</button>
          </div>
          <div class="as-map-slots" data-stage-maps="pedestal">
            <div class="as-map-slot" data-stage-map-slot="pedestal:map">
              <button type="button" class="as-btn" data-stage-map="pedestal:map">Albedo</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:map">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:map" hidden title="Remove albedo">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:normal">
              <button type="button" class="as-btn" data-stage-map="pedestal:normal">Normal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:normal">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:normal" hidden title="Remove normal">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:roughness">
              <button type="button" class="as-btn" data-stage-map="pedestal:roughness">Rough</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:roughness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:roughness" hidden title="Remove roughness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:metalness">
              <button type="button" class="as-btn" data-stage-map="pedestal:metalness">Metal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:metalness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:metalness" hidden title="Remove metalness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:displacement">
              <button type="button" class="as-btn" data-stage-map="pedestal:displacement">Depth</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:displacement">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:displacement" hidden title="Remove depth">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:ao">
              <button type="button" class="as-btn" data-stage-map="pedestal:ao">AO</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:ao">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:ao" hidden title="Remove AO">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="pedestal:emissive">
              <button type="button" class="as-btn" data-stage-map="pedestal:emissive">Emit map</button>
              <span class="as-map-slot-file" data-stage-map-file-label="pedestal:emissive">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="pedestal:emissive" hidden title="Remove emissive">Remove</button>
            </div>
            <button type="button" class="as-btn" data-stage-map-clear="pedestal">Clear maps</button>
            <button type="button" class="as-btn as-btn--accent" data-stage-map-pack="pedestal" title="Replaces all maps on this surface with the folder (Color, NormalGL, Roughness…)">Load pack folder</button>
          </div>
        </div>
        <div class="as-stage-surface" data-stage-surface="cyclorama">
          <h3>Cyclorama</h3>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama checked /> Visible</label>
          <label class="as-field"><span>Size (radius m) <em data-stage-cyclorama-size-val>14</em></span>
            <input data-stage-cyclorama-size type="range" min="6" max="80" step="0.5" value="14" /></label>
          <label class="as-field"><span>Height (m) <em data-stage-cyclorama-height-val>10</em></span>
            <input data-stage-cyclorama-height type="range" min="2" max="40" step="0.5" value="10" /></label>
          <label class="as-field"><span>Crop top <em data-stage-cyclorama-crop-val>0%</em></span>
            <input data-stage-cyclorama-crop type="range" min="0" max="75" step="1" value="0" /></label>
          <p class="as-hint">Crop top shortens the wall from above and crops the video the same way — framing stays centered (Height alone used to squash the picture toward the floor).</p>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama-volume /> Soft volumetric glow</label>
          <label class="as-field"><span>Volume intensity <em data-stage-cyclorama-volume-intensity-val>1.00</em></span>
            <input data-stage-cyclorama-volume-intensity type="range" min="0" max="2" step="0.05" value="1" /></label>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama-interactive checked /> Interactive wall (click play/pause)</label>
          <p class="as-hint">Wall video — choose a bundled clip or upload your own. Click the wall to play/pause when Interactive is on.</p>
          <div class="as-map-row" data-stage-cyclorama-video-presets>
            <button type="button" class="as-btn" data-stage-cyclorama-video-preset="1">Video 1</button>
            <button type="button" class="as-btn" data-stage-cyclorama-video-preset="2">Video 2</button>
            <button type="button" class="as-btn" data-stage-cyclorama-video-preset="3">Video 3</button>
          </div>
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-cyclorama-video>Upload video</button>
            <button type="button" class="as-btn" data-stage-cyclorama-video-clear>Clear video</button>
          </div>
          <input data-stage-cyclorama-video-file type="file" accept="video/mp4,video/webm,video/*,.mp4,.webm" hidden />
          <p class="as-hint" data-stage-cyclorama-video-label>No video — pick Video 1 / 2 / 3 or upload MP4/WebM.</p>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama-video-muted checked /> Mute</label>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama-video-loop checked /> Loop</label>
          <label class="as-field"><span>Video fit</span>
            <select data-stage-cyclorama-video-fit>
              <option value="cover" selected>Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
          <label class="as-field"><span>Color</span><input data-stage-cyclorama-color type="color" value="#1a1f28" /></label>
          <label class="as-field"><span>Metalness <em data-stage-cyclorama-metal-val>0.05</em></span>
            <input data-stage-cyclorama-metal type="range" min="0" max="1" step="0.01" value="0.05" /></label>
          <label class="as-field"><span>Roughness <em data-stage-cyclorama-rough-val>0.92</em></span>
            <input data-stage-cyclorama-rough type="range" min="0" max="1" step="0.01" value="0.92" /></label>
          <label class="as-field"><span>Emissive</span><input data-stage-cyclorama-emissive type="color" value="#1a1f28" /></label>
          <label class="as-field"><span>Emissive intensity <em data-stage-cyclorama-emi-val>0.00</em></span>
            <input data-stage-cyclorama-emi type="range" min="0" max="8" step="0.05" value="0" /></label>
          <label class="as-field"><span>Texture tiles <em data-stage-cyclorama-repeat-val>1.00×</em></span>
            <input data-stage-cyclorama-repeat type="range" min="-4" max="10" step="0.02" value="0" /></label>
          <label class="as-field"><span>Depth scale <em data-stage-cyclorama-disp-val>0.00</em></span>
            <input data-stage-cyclorama-disp type="range" min="0" max="0.4" step="0.01" value="0" /></label>
          <label class="as-field"><span>Break tiling <em data-stage-cyclorama-vary-val>0.00</em></span>
            <input data-stage-cyclorama-vary type="range" min="0" max="1" step="0.01" value="0" /></label>
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-cyclorama-reseed>Randomise pattern</button>
          </div>
          <div class="as-map-slots" data-stage-maps="cyclorama">
            <div class="as-map-slot" data-stage-map-slot="cyclorama:map">
              <button type="button" class="as-btn" data-stage-map="cyclorama:map">Albedo</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:map">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:map" hidden title="Remove albedo">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:normal">
              <button type="button" class="as-btn" data-stage-map="cyclorama:normal">Normal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:normal">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:normal" hidden title="Remove normal">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:roughness">
              <button type="button" class="as-btn" data-stage-map="cyclorama:roughness">Rough</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:roughness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:roughness" hidden title="Remove roughness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:metalness">
              <button type="button" class="as-btn" data-stage-map="cyclorama:metalness">Metal</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:metalness">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:metalness" hidden title="Remove metalness">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:displacement">
              <button type="button" class="as-btn" data-stage-map="cyclorama:displacement">Depth</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:displacement">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:displacement" hidden title="Remove depth">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:ao">
              <button type="button" class="as-btn" data-stage-map="cyclorama:ao">AO</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:ao">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:ao" hidden title="Remove AO">Remove</button>
            </div>
            <div class="as-map-slot" data-stage-map-slot="cyclorama:emissive">
              <button type="button" class="as-btn" data-stage-map="cyclorama:emissive">Emit map</button>
              <span class="as-map-slot-file" data-stage-map-file-label="cyclorama:emissive">None</span>
              <button type="button" class="as-btn as-btn--compact" data-stage-map-remove="cyclorama:emissive" hidden title="Remove emissive">Remove</button>
            </div>
            <button type="button" class="as-btn" data-stage-map-clear="cyclorama">Clear maps</button>
            <button type="button" class="as-btn as-btn--accent" data-stage-map-pack="cyclorama" title="Replaces all maps on this surface with the folder (Color, NormalGL, Roughness…)">Load pack folder</button>
          </div>
        </div>
        <input data-stage-map-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden />
        <input data-stage-map-pack-file type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple webkitdirectory directory hidden />
        <dialog class="as-map-lightbox" data-stage-map-lightbox>
          <form method="dialog" class="as-map-lightbox__panel">
            <img data-stage-map-lightbox-img alt="" />
            <p class="as-hint" data-stage-map-lightbox-caption></p>
            <button type="submit" class="as-btn as-btn--accent">Close</button>
          </form>
        </dialog>
      </div>

      <div data-panel="Lights" hidden>
        <p class="as-hint">Extra product-studio accents on top of the environment key/fill/rim.</p>
        <label class="as-check"><input type="checkbox" data-accent-enabled /> Accent lights</label>
        <label class="as-check"><input type="checkbox" data-accent-volumetric /> Soft volumetric glow</label>
        <label class="as-field">
          <span>Accent intensity <em data-accent-intensity-val>1.00</em></span>
          <input data-accent-intensity type="range" min="0" max="2" step="0.05" value="1" />
        </label>

        <h3 class="as-subhead">Vehicle lamps</h3>
        <p class="as-hint">FrontLight + Black housing (e.g. GeometryNode_743) = DRL / low / high beam seats. Orange = front indicators. TailLight/RedGlass = tail, brake, rear indicators.</p>
        <div class="as-field as-field--checks" data-vehicle-light-groups>
          <label class="as-check"><input type="checkbox" data-vlight="drl" /> DRL <em data-vlight-count="drl"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="lowBeam" /> Low beam <em data-vlight-count="lowBeam"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="highBeam" /> High beam <em data-vlight-count="highBeam"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="tail" /> Tail <em data-vlight-count="tail"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="brake" /> Brake <em data-vlight-count="brake"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="indicatorLeft" /> Indicator L <em data-vlight-count="indicatorLeft"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="indicatorRight" /> Indicator R <em data-vlight-count="indicatorRight"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="hazards" /> Hazards <em data-vlight-count="hazards"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="reverse" /> Reverse <em data-vlight-count="reverse"></em></label>
          <label class="as-check"><input type="checkbox" data-vlight="interior" /> Interior <em data-vlight-count="interior"></em></label>
        </div>
        <label class="as-field"><span>Lamp intensity <em data-vlight-intensity-val>1.00</em></span>
          <input data-vlight-intensity type="range" min="0" max="4" step="0.05" value="1" /></label>
        <label class="as-check"><input type="checkbox" data-vlight-proxies checked /> Proxy point lights</label>
        <label class="as-check"><input type="checkbox" data-vlight-lite /> Lite lights (faster)</label>
        <p class="as-hint">Lite skips proxy points, bloom, and fill shadows — keeps head/tail beam cones.</p>
        <label class="as-check"><input type="checkbox" data-vlight-auto-night checked /> Auto DRL+tail at night</label>
        <div class="as-btn-group as-btn-group--wrap">
          <button type="button" class="as-btn" data-action="vlight-all-off">All off</button>
          <button type="button" class="as-btn" data-action="vlight-night">Night running</button>
          <button type="button" class="as-btn" data-action="vlight-welcome">Welcome</button>
          <button type="button" class="as-btn" data-action="vlight-farewell">Farewell</button>
        </div>

        <h3 class="as-subhead">Beam placement</h3>
        <p class="as-hint">Park the car (free drive off / Reset auto) before copying. Positions must be a few metres — not hundreds.</p>
        <label class="as-check"><input type="checkbox" data-vlight-beam-edit autocomplete="off" /> Edit beams (gizmo)</label>
        <div class="as-field">
          <label for="as-vlight-beam-select">Beam</label>
          <select id="as-vlight-beam-select" data-vlight-beam-select></select>
        </div>
        <div class="as-field as-field--checks">
          <label class="as-check"><input type="radio" name="as-beam-gizmo" data-vlight-beam-gizmo value="position" checked autocomplete="off" /> Move light</label>
          <label class="as-check"><input type="radio" name="as-beam-gizmo" data-vlight-beam-gizmo value="aim" autocomplete="off" /> Move aim point</label>
          <label class="as-check"><input type="radio" name="as-beam-gizmo" data-vlight-beam-gizmo value="rotate" autocomplete="off" /> Rotate</label>
        </div>
        <div class="as-btn-group as-btn-group--wrap">
          <button type="button" class="as-btn" data-action="vlight-beam-dup">Duplicate</button>
          <button type="button" class="as-btn" data-action="vlight-beam-add-drl">Add DRL</button>
          <button type="button" class="as-btn" data-action="vlight-beam-add-low">Add low beam</button>
          <button type="button" class="as-btn" data-action="vlight-beam-del">Delete</button>
          <button type="button" class="as-btn" data-action="vlight-beam-copy">Copy positions</button>
          <button type="button" class="as-btn" data-action="vlight-beam-reset">Reset auto</button>
        </div>
        <pre class="as-hint" data-vlight-beam-coords style="white-space:pre-wrap;font-size:11px;max-height:9rem;overflow:auto;user-select:text"></pre>

        <h3 class="as-subhead">Lamp bloom</h3>
        <p class="as-hint" data-bloom-hint>Selective bloom (WebGL2) — only lit vehicle lamps glow. Sun/moon stay sharp.</p>
        <label class="as-check"><input type="checkbox" data-vlight-bloom /> Enable bloom</label>
        <label class="as-field"><span>Bloom strength <em data-vlight-bloom-str-val>0.22</em></span>
          <input data-vlight-bloom-str type="range" min="0" max="1.2" step="0.05" value="0.22" /></label>
        <label class="as-field"><span>Bloom threshold <em data-vlight-bloom-thr-val>1.05</em></span>
          <input data-vlight-bloom-thr type="range" min="0.6" max="1.4" step="0.01" value="1.05" /></label>

        <h3 class="as-subhead">Target remap</h3>
        <p class="as-hint">Select a mesh in Objects, choose a lamp group, then Assign. Manual groups replace auto-detect.</p>
        <div class="as-field">
          <label for="as-vlight-remap-group">Group</label>
          <select id="as-vlight-remap-group" data-vlight-remap-group>
            <option value="drl">Daytime running</option>
            <option value="lowBeam">Low beam</option>
            <option value="highBeam">High beam</option>
            <option value="tail">Tail</option>
            <option value="brake">Brake</option>
            <option value="indicatorLeft">Indicator L</option>
            <option value="indicatorRight">Indicator R</option>
            <option value="hazards">Hazards</option>
            <option value="reverse">Reverse</option>
            <option value="interior">Interior</option>
          </select>
        </div>
        <div class="as-btn-group as-btn-group--wrap">
          <button type="button" class="as-btn" data-action="vlight-assign">Assign selected mesh</button>
          <button type="button" class="as-btn" data-action="vlight-clear-group">Clear group (auto)</button>
          <button type="button" class="as-btn" data-action="vlight-clear-all-targets">Clear all manual</button>
        </div>
        <ul class="as-hint" data-vlight-bindings></ul>
      </div>

      <div data-panel="general" hidden>
        <dl>
          <div><dt>Mode</dt><dd data-mode>${options.mode}</dd></div>
          <div><dt>Dirty</dt><dd data-dirty>clean</dd></div>
          <div><dt>Renderer</dt><dd data-backend>—</dd></div>
          <div><dt>Access policy</dt><dd data-access>unlisted</dd></div>
        </dl>
        <p class="as-hint">Authoring tools for this section arrive in later phases.</p>
      </div>

      <p class="as-status" data-status role="status" aria-live="polite">Phase 4 — route demo + tire roll on rigged variants</p>
    </aside>
    <footer class="as-transport" role="group" aria-label="Transport">
      <button type="button" class="as-btn" data-action="playpause" aria-keyshortcuts="Space">Play</button>
      <label class="as-sr-only" for="as-scrub">Timeline</label>
      <input id="as-scrub" data-scrub type="range" min="0" max="0" step="0.01" value="0" />
      <span class="as-time" data-time>0.00 / 0.00</span>
    </footer>
  `

  enhancePanelSliderNumbers(root)

  const viewportHost = root.querySelector('[data-viewport]') as HTMLElement
  const nameInput = root.querySelector('[data-name]') as HTMLInputElement
  const envSelect = root.querySelector('[data-env]') as HTMLSelectElement
  const sunAz = root.querySelector('[data-sun-az]') as HTMLInputElement
  const sunEl = root.querySelector('[data-sun-el]') as HTMLInputElement
  const hdr = root.querySelector('[data-hdr]') as HTMLInputElement
  const stars = root.querySelector('[data-stars]') as HTMLInputElement
  const moon = root.querySelector('[data-moon]') as HTMLInputElement
  const exposure = root.querySelector('[data-exposure]') as HTMLInputElement
  const envIntensity = root.querySelector('[data-env-intensity]') as HTMLInputElement
  const exposureVal = root.querySelector('[data-exposure-val]') as HTMLElement
  const envIntensityVal = root.querySelector('[data-env-intensity-val]') as HTMLElement
  const scrub = root.querySelector('[data-scrub]') as HTMLInputElement
  const statusEl = root.querySelector('[data-status]') as HTMLElement
  const progressEl = root.querySelector('[data-import-progress]') as HTMLElement
  const roleSelect = root.querySelector('[data-import-role]') as HTMLSelectElement
  const qualitySlot = root.querySelector('[data-quality-slot]') as HTMLSelectElement
  const activeQuality = root.querySelector('[data-active-quality]') as HTMLSelectElement
  const lengthInput = root.querySelector('[data-target-length]') as HTMLInputElement
  const groundInput = root.querySelector('[data-ground]') as HTMLInputElement
  const clipSelect = root.querySelector('[data-clip]') as HTMLSelectElement
  const clipScrub = root.querySelector('[data-clip-scrub]') as HTMLInputElement
  const reportEl = root.querySelector('[data-report]') as HTMLElement
  let syncingQuality = false
  const inspectorTitle = root.querySelector('[data-inspector-title]') as HTMLElement
  const vehiclePanel = root.querySelector('[data-panel="Vehicle"]') as HTMLElement
  const objectsPanel = root.querySelector('[data-panel="Objects"]') as HTMLElement
  const materialsPanel = root.querySelector('[data-panel="Materials"]') as HTMLElement
  const envPanel = root.querySelector('[data-panel="Environment"]') as HTMLElement
  const routePanel = root.querySelector('[data-panel="Route"]') as HTMLElement
  const hotspotsPanel = root.querySelector('[data-panel="Hotspots"]') as HTMLElement
  const shotsPanel = root.querySelector('[data-panel="Shots"]') as HTMLElement
  const stagePanel = root.querySelector('[data-panel="Stage"]') as HTMLElement
  const lightsPanel = root.querySelector('[data-panel="Lights"]') as HTMLElement
  const generalPanel = root.querySelector('[data-panel="general"]') as HTMLElement
  const objectSelect = root.querySelector('[data-object-select]') as HTMLSelectElement
  const matObjectSelect = root.querySelector('[data-mat-object-select]') as HTMLSelectElement
  const matList = root.querySelector('[data-mat-list]') as HTMLSelectElement
  const objectVisible = root.querySelector('[data-object-visible]') as HTMLInputElement
  const objectDeselect = root.querySelector('[data-action="object-deselect"]') as HTMLButtonElement
  const objectMeta = root.querySelector('[data-object-meta]') as HTMLElement
  const matObjectMeta = root.querySelector('[data-mat-object-meta]') as HTMLElement
  const objectTree = root.querySelector('[data-object-tree]') as HTMLElement | null
  const objectHiddenSummary = root.querySelector('[data-object-hidden-summary]') as HTMLElement | null
  const objectFilterHidden = root.querySelector('[data-object-filter-hidden]') as HTMLInputElement | null
  const objectMaterialPanel = root.querySelector('[data-object-material]') as HTMLElement
  const matEmpty = root.querySelector('[data-mat-empty]') as HTMLElement
  const objectPick = root.querySelector('[data-object-pick]') as HTMLInputElement
  const matPick = root.querySelector('[data-mat-pick]') as HTMLInputElement
  const vehiclePolish = root.querySelector('[data-vehicle-polish]') as HTMLInputElement
  let objectNodesById = new Map<string, ObjectTreeNode>()
  let lastObjectTreeNodes: ObjectTreeNode[] = []
  let lastObjectTreeSelectedId: string | null = null
  let syncingObjectTreeVis = false
  let syncingObjectSelect = false
  let activeSection: InspectorSection = 'Vehicle'
  const matSlot = root.querySelector('[data-mat-slot]') as HTMLSelectElement
  const matName = root.querySelector('[data-mat-name]') as HTMLElement
  const matColor = root.querySelector('[data-mat-color]') as HTMLInputElement
  const matMetal = root.querySelector('[data-mat-metal]') as HTMLInputElement
  const matMetalVal = root.querySelector('[data-mat-metal-val]') as HTMLElement
  const matRough = root.querySelector('[data-mat-rough]') as HTMLInputElement
  const matRoughVal = root.querySelector('[data-mat-rough-val]') as HTMLElement
  const matEmissive = root.querySelector('[data-mat-emissive]') as HTMLInputElement
  const matEmi = root.querySelector('[data-mat-emi]') as HTMLInputElement
  const matEmiVal = root.querySelector('[data-mat-emi-val]') as HTMLElement
  const matOpacity = root.querySelector('[data-mat-opacity]') as HTMLInputElement
  const matOpacityVal = root.querySelector('[data-mat-opacity-val]') as HTMLElement
  const matTransparent = root.querySelector('[data-mat-transparent]') as HTMLInputElement
  const matEnv = root.querySelector('[data-mat-env]') as HTMLInputElement
  const matEnvVal = root.querySelector('[data-mat-env-val]') as HTMLElement
  const matPhysical = root.querySelector('[data-mat-physical]') as HTMLElement
  const matCc = root.querySelector('[data-mat-cc]') as HTMLInputElement
  const matCcVal = root.querySelector('[data-mat-cc-val]') as HTMLElement
  const matCcr = root.querySelector('[data-mat-ccr]') as HTMLInputElement
  const matCcrVal = root.querySelector('[data-mat-ccr-val]') as HTMLElement
  const matTrans = root.querySelector('[data-mat-trans]') as HTMLInputElement
  const matTransVal = root.querySelector('[data-mat-trans-val]') as HTMLElement
  const matMapRepeat = root.querySelector('[data-mat-map-repeat]') as HTMLInputElement
  const matMapRepeatVal = root.querySelector('[data-mat-map-repeat-val]') as HTMLElement
  const matMapTriplanar = root.querySelector('[data-mat-map-triplanar]') as HTMLInputElement
  const matMapVary = root.querySelector('[data-mat-map-vary]') as HTMLInputElement
  const matMapVaryVal = root.querySelector('[data-mat-map-vary-val]') as HTMLElement
  const matMapReseed = root.querySelector('[data-mat-map-reseed]') as HTMLButtonElement
  const matMapFile = root.querySelector('[data-mat-map-file]') as HTMLInputElement
  const matMapPackFile = root.querySelector('[data-mat-map-pack-file]') as HTMLInputElement
  let pendingMatMap: string | null = null
  let pendingMatMapPack = false
  const stageFloor = root.querySelector('[data-stage-floor]') as HTMLInputElement
  const stagePedestal = root.querySelector('[data-stage-pedestal]') as HTMLInputElement
  const stageCyclorama = root.querySelector('[data-stage-cyclorama]') as HTMLInputElement
  const stageMapFile = root.querySelector('[data-stage-map-file]') as HTMLInputElement
  const stageMapPackFile = root.querySelector('[data-stage-map-pack-file]') as HTMLInputElement
  let pendingStageMapPack: 'floor' | 'pedestal' | 'cyclorama' | null = null
  let pendingStageMap: { surface: 'floor' | 'pedestal' | 'cyclorama'; map: string } | null = null
  const accentEnabled = root.querySelector('[data-accent-enabled]') as HTMLInputElement
  const accentVolumetric = root.querySelector('[data-accent-volumetric]') as HTMLInputElement
  const accentIntensity = root.querySelector('[data-accent-intensity]') as HTMLInputElement
  const accentIntensityVal = root.querySelector('[data-accent-intensity-val]') as HTMLElement
  const vlightIntensity = root.querySelector('[data-vlight-intensity]') as HTMLInputElement
  const vlightProxies = root.querySelector('[data-vlight-proxies]') as HTMLInputElement
  const vlightLite = root.querySelector('[data-vlight-lite]') as HTMLInputElement
  const vlightAutoNight = root.querySelector('[data-vlight-auto-night]') as HTMLInputElement
  const vlightBloom = root.querySelector('[data-vlight-bloom]') as HTMLInputElement
  const vlightBloomStr = root.querySelector('[data-vlight-bloom-str]') as HTMLInputElement
  const vlightBloomThr = root.querySelector('[data-vlight-bloom-thr]') as HTMLInputElement
  const vlightRemapGroup = root.querySelector('[data-vlight-remap-group]') as HTMLSelectElement
  const vlightBindings = root.querySelector('[data-vlight-bindings]') as HTMLElement
  const vlightBeamEdit = root.querySelector('[data-vlight-beam-edit]') as HTMLInputElement
  const vlightBeamSelect = root.querySelector('[data-vlight-beam-select]') as HTMLSelectElement
  const vlightBeamCoords = root.querySelector('[data-vlight-beam-coords]') as HTMLElement
  // Chrome restores checkbox `checked` across a reload independently of app state. Force
  // this back to unchecked/off so it can never show "on" while beamEditor/chaseCamera
  // input-blocking are actually still false — that mismatch let the chase-camera orbit
  // drag hijack the pointer while the user thought they were dragging the beam gizmo.
  if (vlightBeamEdit) vlightBeamEdit.checked = false
  root.querySelectorAll<HTMLInputElement>('[data-vlight-beam-gizmo]').forEach((el) => {
    el.checked = el.value === 'position'
  })
  const sunDisc = root.querySelector('[data-sun-disc]') as HTMLInputElement
  const sunEnabled = root.querySelector('[data-sun-enabled]') as HTMLInputElement
  const sunIntensity = root.querySelector('[data-sun-intensity]') as HTMLInputElement
  const sunAng = root.querySelector('[data-sun-ang]') as HTMLInputElement
  const sunDiscScale = root.querySelector('[data-sun-disc-scale]') as HTMLInputElement
  const moonAz = root.querySelector('[data-moon-az]') as HTMLInputElement
  const moonEl = root.querySelector('[data-moon-el]') as HTMLInputElement
  const moonKey = root.querySelector('[data-moon-key]') as HTMLInputElement
  const moonScale = root.querySelector('[data-moon-scale]') as HTMLInputElement
  const moonIntensity = root.querySelector('[data-moon-intensity]') as HTMLInputElement
  const moonAng = root.querySelector('[data-moon-ang]') as HTMLInputElement
  const moonPhase = root.querySelector('[data-moon-phase]') as HTMLInputElement
  const hotspotList = root.querySelector('[data-hotspot-list]') as HTMLElement
  const hotspotListHint = root.querySelector('[data-hotspot-list-hint]') as HTMLElement | null
  const hotspotEditorPark = root.querySelector('[data-hotspot-editor-park]') as HTMLElement
  const hotspotEditor = root.querySelector('[data-hotspot-editor]') as HTMLElement
  const hotspotTitleInput = root.querySelector('[data-hotspot-title]') as HTMLInputElement
  const hotspotBodyInput = root.querySelector('[data-hotspot-body]') as HTMLTextAreaElement
  const hotspotDoorSelect = root.querySelector('[data-hotspot-door-action]') as HTMLSelectElement
  const hotspotDoorMode = root.querySelector('[data-hotspot-door-mode]') as HTMLSelectElement
  const hotspotClipStart = root.querySelector('[data-hotspot-clip-start]') as HTMLInputElement
  const hotspotClipEnd = root.querySelector('[data-hotspot-clip-end]') as HTMLInputElement
  const hotspotClipHint = root.querySelector('[data-hotspot-clip-hint]') as HTMLElement
  const hotspotMeshNode = root.querySelector('[data-hotspot-mesh-node]') as HTMLSelectElement
  const hotspotMeshMode = root.querySelector('[data-hotspot-mesh-mode]') as HTMLSelectElement
  const hotspotRotX = root.querySelector('[data-hotspot-rot-x]') as HTMLInputElement
  const hotspotRotY = root.querySelector('[data-hotspot-rot-y]') as HTMLInputElement
  const hotspotRotZ = root.querySelector('[data-hotspot-rot-z]') as HTMLInputElement
  const hotspotRotXVal = root.querySelector('[data-hotspot-rot-x-val]') as HTMLElement
  const hotspotRotYVal = root.querySelector('[data-hotspot-rot-y-val]') as HTMLElement
  const hotspotRotZVal = root.querySelector('[data-hotspot-rot-z-val]') as HTMLElement
  const hotspotLabelScale = root.querySelector('[data-hotspot-label-scale]') as HTMLInputElement
  const hotspotLabelOx = root.querySelector('[data-hotspot-label-ox]') as HTMLInputElement
  const hotspotLabelOy = root.querySelector('[data-hotspot-label-oy]') as HTMLInputElement
  const hotspotLabelOz = root.querySelector('[data-hotspot-label-oz]') as HTMLInputElement
  const hotspotLabelScaleVal = root.querySelector('[data-hotspot-label-scale-val]') as HTMLElement
  const hotspotLabelOxVal = root.querySelector('[data-hotspot-label-ox-val]') as HTMLElement
  const hotspotLabelOyVal = root.querySelector('[data-hotspot-label-oy-val]') as HTMLElement
  const hotspotLabelOzVal = root.querySelector('[data-hotspot-label-oz-val]') as HTMLElement
  const hotspotVideoInput = root.querySelector('[data-hotspot-video]') as HTMLInputElement
  const hotspotVideoLabel = root.querySelector('[data-hotspot-video-label]') as HTMLElement
  let editingHotspotId: string | null = null
  let syncingHotspotEditor = false
  let lastHotspotListFingerprint = ''

  const parkHotspotEditor = () => {
    if (hotspotEditor.parentElement !== hotspotEditorPark) {
      hotspotEditorPark.appendChild(hotspotEditor)
    }
  }

  const hotspotListFingerprint = (hotspots: Hotspot[]) =>
    hotspots
      .map((h) => {
        const node = h.anchor.node.name || h.anchor.node.path || ''
        const door = h.actions.some((a) => a.type === 'action.play' || a.type === 'action.toggle')
        const video = h.blocks.some((b) => b.type === 'video')
        const text = h.blocks.some((b) => b.type === 'richtext')
        return `${h.id}\0${h.name}\0${node}\0${door ? 1 : 0}\0${video ? 1 : 0}\0${text ? 1 : 0}`
      })
      .join('\n')

  const mountHotspotEditorIntoList = (id: string | null) => {
    parkHotspotEditor()
    hotspotList.querySelectorAll('.as-hotspot-item').forEach((el) => {
      const item = el as HTMLElement
      const open = Boolean(id && item.dataset.hotspotItem === id)
      item.classList.toggle('as-hotspot-item--open', open)
      item.classList.toggle('as-hotspot-item--active', open)
      const panel = item.querySelector('[data-hotspot-panel]') as HTMLElement | null
      if (panel) panel.hidden = !open
      const toggle = item.querySelector('[data-action="hotspot-toggle"]') as HTMLElement | null
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      const chevron = item.querySelector('.as-hotspot-item__chevron')
      if (chevron) chevron.textContent = open ? '▾' : '▸'
      let badge = item.querySelector('.as-hotspot-item__badge') as HTMLElement | null
      if (open) {
        if (!badge && toggle) {
          badge = document.createElement('span')
          badge.className = 'as-hotspot-item__badge'
          badge.textContent = 'editing'
          toggle.appendChild(badge)
        }
      } else {
        badge?.remove()
      }
    })
    if (!id) {
      hotspotEditor.hidden = true
      if (hotspotListHint) {
        hotspotListHint.textContent = 'Click a hotspot to expand actions and edit.'
      }
      return
    }
    const slot = hotspotList.querySelector(
      `[data-hotspot-item="${CSS.escape(id)}"] [data-hotspot-editor-slot]`,
    ) as HTMLElement | null
    if (slot) {
      slot.appendChild(hotspotEditor)
      hotspotEditor.hidden = false
    } else {
      hotspotEditor.hidden = true
    }
  }

  const renderHotspotList = (hotspots: Hotspot[], force = false) => {
    if (editingHotspotId && !hotspots.some((h) => h.id === editingHotspotId)) {
      editingHotspotId = null
      parkHotspotEditor()
      hotspotEditor.hidden = true
    }
    const fp = hotspotListFingerprint(hotspots)
    if (!force && fp === lastHotspotListFingerprint) {
      mountHotspotEditorIntoList(editingHotspotId)
      if (hotspotListHint) {
        hotspotListHint.textContent = hotspots.length
          ? editingHotspotId
            ? `Editing · ${hotspots.find((h) => h.id === editingHotspotId)?.name ?? 'hotspot'}`
            : 'Click a hotspot to expand actions and edit.'
          : 'No hotspots yet — pick a mesh or add at center.'
      }
      return
    }
    lastHotspotListFingerprint = fp
    parkHotspotEditor()
    if (hotspotListHint) {
      hotspotListHint.textContent = hotspots.length
        ? editingHotspotId
          ? `Editing · ${hotspots.find((h) => h.id === editingHotspotId)?.name ?? 'hotspot'}`
          : 'Click a hotspot to expand actions and edit.'
        : 'No hotspots yet — pick a mesh or add at center.'
    }
    hotspotList.innerHTML = hotspots.length
      ? hotspots
          .map((hotspot) => {
            const node = hotspot.anchor.node.name || hotspot.anchor.node.path || 'vehicle'
            const door = hotspot.actions.find(
              (a) => a.type === 'action.play' || a.type === 'action.toggle',
            )
            const hasVideo = hotspot.blocks.some((b) => b.type === 'video')
            const hasMesh = hotspot.actions.some(
              (a) => a.type === 'mesh.setVisible' || a.type === 'mesh.toggleVisible',
            )
            const tags = [
              door ? 'door' : null,
              hasMesh ? 'mesh' : null,
              hasVideo ? 'video' : null,
              hotspot.blocks.some((b) => b.type === 'richtext') ? 'text' : null,
            ]
              .filter(Boolean)
              .join(' · ')
            const open = hotspot.id === editingHotspotId
            return `
            <div class="as-hotspot-item${open ? ' as-hotspot-item--open as-hotspot-item--active' : ''}" data-hotspot-item="${escapeAttr(hotspot.id)}">
              <button type="button" class="as-hotspot-item__toggle" data-action="hotspot-toggle" data-hotspot-id="${escapeAttr(hotspot.id)}" aria-expanded="${open ? 'true' : 'false'}">
                <span class="as-hotspot-item__chevron" aria-hidden="true">${open ? '▾' : '▸'}</span>
                <span class="as-hotspot-item__main">
                  <span class="as-hotspot-item__name">${escapeHtml(hotspot.name)}</span>
                  <span class="as-hint">· ${escapeHtml(node)}${tags ? ` · ${tags}` : ''}</span>
                </span>
                ${open ? '<span class="as-hotspot-item__badge">editing</span>' : ''}
              </button>
              <div class="as-hotspot-item__panel" data-hotspot-panel ${open ? '' : 'hidden'}>
                <div class="as-row as-hotspot-item__actions">
                  <button type="button" class="as-btn as-btn--accent" data-action="hotspot-recenter" data-hotspot-id="${escapeAttr(hotspot.id)}" title="Snap to default position on the attached node">Recenter</button>
                  <button type="button" class="as-btn" data-action="hotspot-reposition" data-hotspot-id="${escapeAttr(hotspot.id)}" title="Click a mesh in the viewport to move this marker">Move (pick)</button>
                  <button type="button" class="as-btn" data-action="hotspot-test-item" data-hotspot-id="${escapeAttr(hotspot.id)}">Test open</button>
                  <button type="button" class="as-btn" data-action="hotspot-delete" data-hotspot-id="${escapeAttr(hotspot.id)}" aria-label="Delete ${escapeAttr(hotspot.name)}">Delete</button>
                </div>
                <div data-hotspot-editor-slot></div>
              </div>
            </div>`
          })
          .join('')
      : '<p class="as-hint">No hotspots yet.</p>'
    mountHotspotEditorIntoList(editingHotspotId)
  }

  const shotList = root.querySelector('[data-shot-list]') as HTMLElement
  const shotEditor = root.querySelector('[data-shot-editor]') as HTMLElement
  const shotNameInput = root.querySelector('[data-shot-name]') as HTMLInputElement
  const shotPlaySelect = root.querySelector('[data-shot-play-action]') as HTMLSelectElement
  const shotClipStart = root.querySelector('[data-shot-clip-start]') as HTMLInputElement
  const shotClipEnd = root.querySelector('[data-shot-clip-end]') as HTMLInputElement
  const shotClipHint = root.querySelector('[data-shot-clip-hint]') as HTMLElement
  let editingShotId: string | null = null
  let syncingShotEditor = false
  let lastShotDoorActions: Array<{ id: string; label: string; duration?: number }> = []
  let lastShots: Shot[] = []

  function fillShotEditor(
    shot: Shot | null,
    doorActions: Array<{ id: string; label: string; duration?: number }>,
  ) {
    if (!shotEditor) return
    syncingShotEditor = true
    editingShotId = shot?.id ?? null
    if (!shot) {
      shotEditor.hidden = true
      syncingShotEditor = false
      return
    }
    shotEditor.hidden = false
    const heading = root.querySelector('[data-shot-editor-heading]') as HTMLElement | null
    if (heading) setGroupLabel(heading, `Edit · ${shot.name}`)
    if (shotNameInput) shotNameInput.value = shot.name
    if (shotPlaySelect) {
      shotPlaySelect.innerHTML =
        `<option value="">— none —</option>` +
        doorActions
          .map(
            (a) =>
              `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`,
          )
          .join('')
      const selected = shot.playActionId ?? ''
      shotPlaySelect.value = selected
      if (selected && shotPlaySelect.value !== selected) {
        shotPlaySelect.innerHTML += `<option value="${escapeHtml(selected)}">${escapeHtml(selected)}</option>`
        shotPlaySelect.value = selected
      }
    }
    if (shotClipStart) {
      shotClipStart.value =
        shot.playActionStartSeconds != null ? String(shot.playActionStartSeconds) : ''
    }
    if (shotClipEnd) {
      shotClipEnd.value =
        shot.playActionEndSeconds != null ? String(shot.playActionEndSeconds) : ''
    }
    const clipDur = doorActions.find((a) => a.id === shot.playActionId)?.duration
    if (shotClipHint) {
      shotClipHint.textContent =
        clipDur != null && clipDur > 0
          ? `Clip is ${clipDur.toFixed(2)}s — skip empty lead-in (e.g. start 1.2). Leave end empty for full clip.`
          : 'Same clip trim as hotspots — skip empty lead-in if the door moves late.'
    }
    syncingShotEditor = false
  }

  const routeStats = root.querySelector('[data-route-stats]') as HTMLElement
  const routeSpeed = root.querySelector('[data-route-speed]') as HTMLInputElement
  const routeRoll = root.querySelector('[data-route-roll]') as HTMLInputElement
  const routeClosed = root.querySelector('[data-route-closed]') as HTMLInputElement
  const routeChase = root.querySelector('[data-route-chase]') as HTMLInputElement
  const freeDrive = root.querySelector('[data-free-drive]') as HTMLInputElement
  const freeDriveHeadingFlip = root.querySelector(
    '[data-free-drive-heading-flip]',
  ) as HTMLInputElement | null
  const chaseYaw = root.querySelector('[data-chase-yaw]') as HTMLInputElement
  const chasePitch = root.querySelector('[data-chase-pitch]') as HTMLInputElement
  const chaseDist = root.querySelector('[data-chase-dist]') as HTMLInputElement
  const chaseTarget = root.querySelector('[data-chase-target]') as HTMLInputElement
  let lastChaseLookSide = 0
  const routeEdit = root.querySelector('[data-route-edit]') as HTMLInputElement
  const routeReverse = root.querySelector('[data-route-reverse]') as HTMLInputElement
  const routeOval = root.querySelector('[data-route-oval]') as HTMLInputElement
  const routeOpen = root.querySelector('[data-route-open]') as HTMLInputElement
  const ovalSizeBlock = root.querySelector('[data-oval-size-block]') as HTMLElement
  const openSizeBlock = root.querySelector('[data-open-size-block]') as HTMLElement
  const routePathScale = root.querySelector('[data-route-path-scale]') as HTMLInputElement
  const routeRollRate = root.querySelector('[data-route-roll-rate]') as HTMLInputElement
  const routeSteer = root.querySelector('[data-route-steer]') as HTMLInputElement
  const routeBodyRoll = root.querySelector('[data-route-body-roll]') as HTMLInputElement
  const routeAccel = root.querySelector('[data-route-accel]') as HTMLInputElement
  const routeBrake = root.querySelector('[data-route-brake]') as HTMLInputElement
  const routeStartAccel = root.querySelector('[data-route-start-accel]') as HTMLInputElement
  const routeEndStop = root.querySelector('[data-route-end-stop]') as HTMLInputElement

  const badge = document.createElement('div')
  badge.className = 'as-viewport-badge'
  badge.textContent = 'Import a .glb as Active Vehicle — Lixiang is local/prototype only.'
  viewportHost.appendChild(badge)

  const drivePad = document.createElement('div')
  drivePad.className = 'as-drive-pad'
  drivePad.hidden = true
  drivePad.setAttribute('role', 'group')
  drivePad.setAttribute('aria-label', 'Free drive controls')
  drivePad.innerHTML = `
    <button type="button" class="as-drive-pad__btn" data-drive-key="KeyW" aria-label="Forward">W</button>
    <button type="button" class="as-drive-pad__btn" data-drive-key="KeyA" aria-label="Steer left">A</button>
    <button type="button" class="as-drive-pad__btn" data-drive-key="KeyS" aria-label="Reverse">S</button>
    <button type="button" class="as-drive-pad__btn" data-drive-key="KeyD" aria-label="Steer right">D</button>
    <button type="button" class="as-drive-pad__btn" data-drive-key="Space" aria-label="Stop">Stop</button>
  `
  viewportHost.appendChild(drivePad)

  const matPickHud = document.createElement('div')
  matPickHud.className = 'as-mat-pick-hud'
  matPickHud.hidden = true
  matPickHud.innerHTML = `
    <div class="as-mat-pick-cursor" data-mat-pick-cursor aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 20l6.5-6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M12.2 5.2l6.6 6.6-3.3 3.3-6.6-6.6 3.3-3.3z" stroke="currentColor" stroke-width="1.6" fill="rgb(210 180 140 / 22%)"/>
        <circle cx="9.5" cy="9.5" r="1.2" fill="currentColor"/>
      </svg>
    </div>
    <div class="as-mat-pick-chip" data-mat-pick-chip>
      <strong data-mat-pick-mat>Click a panel</strong>
      <span data-mat-pick-mesh>Eyedropper — pick material</span>
    </div>
  `
  viewportHost.appendChild(matPickHud)
  const matPickCursor = matPickHud.querySelector('[data-mat-pick-cursor]') as HTMLElement
  const matPickChip = matPickHud.querySelector('[data-mat-pick-chip]') as HTMLElement
  const matPickMatLabel = matPickHud.querySelector('[data-mat-pick-mat]') as HTMLElement
  const matPickMeshLabel = matPickHud.querySelector('[data-mat-pick-mesh]') as HTMLElement

  const setMatPickHudVisible = (on: boolean) => {
    matPickHud.hidden = !on
    viewportHost.classList.toggle('as-viewport--mat-pick', on)
    if (!on) {
      matPickMatLabel.textContent = 'Click a panel'
      matPickMeshLabel.textContent = 'Eyedropper — pick material'
    }
  }

  const updateMatPickHud = (info: {
    clientX: number
    clientY: number
    meshName: string
    materialName: string
    slot: number
  } | null) => {
    if (!info) {
      matPickMatLabel.textContent = 'Click a panel'
      matPickMeshLabel.textContent = 'Eyedropper — pick material'
      return
    }
    const rect = viewportHost.getBoundingClientRect()
    const x = info.clientX - rect.left
    const y = info.clientY - rect.top
    matPickCursor.style.transform = `translate(${x}px, ${y}px)`
    matPickChip.style.transform = `translate(${Math.min(x + 18, rect.width - 160)}px, ${Math.min(y + 14, rect.height - 56)}px)`
    matPickMatLabel.textContent = info.materialName || 'Click a panel'
    matPickMeshLabel.textContent = info.meshName
      ? `${info.meshName} · slot ${info.slot}`
      : 'Eyedropper — pick material'
  }

  const drivePadHeld = new Map<number, string>()
  const setDrivePadBtnActive = (code: string, active: boolean) => {
    const btn = drivePad.querySelector(`[data-drive-key="${code}"]`) as HTMLElement | null
    btn?.classList.toggle('is-active', active)
  }
  const releaseDrivePadPointer = (pointerId: number) => {
    const code = drivePadHeld.get(pointerId)
    if (!code) return
    drivePadHeld.delete(pointerId)
    setDrivePadBtnActive(code, false)
    if (code === 'Space') return
    options.onDrivePadKey(code, false)
  }
  drivePad.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest?.('[data-drive-key]') as HTMLElement | null
    if (!btn || !drivePad.contains(btn)) return
    const code = btn.dataset.driveKey
    if (!code) return
    e.preventDefault()
    e.stopPropagation()
    btn.setPointerCapture?.(e.pointerId)
    drivePadHeld.set(e.pointerId, code)
    setDrivePadBtnActive(code, true)
    if (code === 'Space') {
      options.onDrivePadKey('Space', true)
      return
    }
    options.onDrivePadKey(code, true)
  })
  const onDrivePadPointerEnd = (e: PointerEvent) => {
    if (!drivePadHeld.has(e.pointerId)) return
    e.preventDefault()
    e.stopPropagation()
    releaseDrivePadPointer(e.pointerId)
  }
  drivePad.addEventListener('pointerup', onDrivePadPointerEnd)
  drivePad.addEventListener('pointercancel', onDrivePadPointerEnd)
  drivePad.addEventListener('lostpointercapture', onDrivePadPointerEnd)
  // Block orbit / route-edit from treating pad presses as viewport drags.
  drivePad.addEventListener('pointermove', (e) => {
    if (drivePadHeld.has(e.pointerId)) e.stopPropagation()
  })
  drivePad.addEventListener('contextmenu', (e) => e.preventDefault())

  const setUiThemeLocal = (theme: UiChromeTheme) => {
    root.dataset.theme = theme
    document.documentElement.dataset.theme = theme
    root.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme') === theme))
    })
  }

  const showSection = (section: InspectorSection) => {
    activeSection = section
    const isVehicle = section === 'Vehicle'
    const isObjects = section === 'Objects'
    const isMaterials = section === 'Materials'
    const isEnv = section === 'Environment'
    const isRoute = section === 'Route'
    const isHotspots = section === 'Hotspots'
    const isShots = section === 'Shots'
    const isStage = section === 'Stage'
    const isLights = section === 'Lights'
    vehiclePanel.hidden = !isVehicle
    objectsPanel.hidden = !isObjects
    materialsPanel.hidden = !isMaterials
    envPanel.hidden = !isEnv
    routePanel.hidden = !isRoute
    hotspotsPanel.hidden = !isHotspots
    shotsPanel.hidden = !isShots
    stagePanel.hidden = !isStage
    lightsPanel.hidden = !isLights
    generalPanel.hidden =
      isVehicle ||
      isObjects ||
      isMaterials ||
      isEnv ||
      isRoute ||
      isHotspots ||
      isShots ||
      isStage ||
      isLights
    inspectorTitle.textContent = section
    if (isMaterials && matPick && !matPick.checked) {
      matPick.checked = true
      if (objectPick) objectPick.checked = false
    }
    const pickOn =
      (isObjects && objectPick.checked) || (isMaterials && matPick.checked)
    const pickMode = isMaterials && matPick.checked ? 'material' : 'object'
    options.onObjectPickMode(pickOn, pickMode)
    setMatPickHudVisible(Boolean(isMaterials && matPick?.checked))
  }

  root.querySelector('[data-action="undo"]')?.addEventListener('click', options.onUndo)
  root.querySelector('[data-action="redo"]')?.addEventListener('click', options.onRedo)
  root.querySelector('[data-action="save"]')?.addEventListener('click', options.onSave)
  root.querySelector('[data-action="export"]')?.addEventListener('click', options.onExport)
  root.querySelector('[data-action="new"]')?.addEventListener('click', options.onNew)
  root.querySelector('[data-action="preview"]')?.addEventListener('click', options.onPreview)
  root.querySelector('[data-action="present"]')?.addEventListener('click', options.onPresent)
  root.querySelector('[data-action="orbit"]')?.addEventListener('click', options.onToggleOrbit)
  root.querySelector('[data-action="playpause"]')?.addEventListener('click', options.onPlayPause)
  root.querySelector('[data-action="route-demo"]')?.addEventListener('click', options.onCreateDemoRoute)
  root.querySelector('[data-action="route-open"]')?.addEventListener('click', options.onCreateOpenRoute)
  root.querySelector('[data-action="route-clear"]')?.addEventListener('click', options.onClearRoute)
  root.querySelector('[data-action="route-stress"]')?.addEventListener('click', options.onRouteStressTest)
  root.querySelector('[data-action="route-add-point"]')?.addEventListener('click', options.onRouteAddPoint)
  root.querySelector('[data-action="route-remove-point"]')?.addEventListener('click', options.onRouteRemovePoint)
  root.querySelector('[data-action="clear-vehicle"]')?.addEventListener('click', options.onClearVehicle)
  root.querySelector('[data-action="flip180"]')?.addEventListener('click', options.onFlip180)
  root.querySelector('[data-action="clip-play"]')?.addEventListener('click', options.onClipPlay)
  root.querySelector('[data-action="clip-stop"]')?.addEventListener('click', options.onClipStop)
  root.querySelector('[data-action="hotspot-add"]')?.addEventListener('click', options.onAddHotspot)
  root.querySelector('[data-action="hotspot-pick"]')?.addEventListener('click', options.onPickHotspotMesh)
  root.querySelector('[data-action="hotspot-attach-node"]')?.addEventListener('click', () => {
    const select = root.querySelector('[data-hotspot-nodes]') as HTMLSelectElement
    if (select.value) options.onAttachHotspotNode(select.value)
  })
  hotspotTitleInput.addEventListener('change', () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    options.onHotspotTitle(editingHotspotId, hotspotTitleInput.value)
  })
  hotspotBodyInput.addEventListener('change', () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    options.onHotspotBody(editingHotspotId, hotspotBodyInput.value)
  })
  const commitHotspotDoor = () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    const parseOpt = (el: HTMLInputElement): number | null | undefined => {
      const raw = el.value.trim()
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    options.onHotspotDoorAction(editingHotspotId, hotspotDoorSelect.value || null, {
      mode: hotspotDoorMode?.value === 'play' ? 'play' : 'toggle',
      startSeconds: parseOpt(hotspotClipStart),
      endSeconds: parseOpt(hotspotClipEnd),
    })
  }
  hotspotDoorSelect.addEventListener('change', commitHotspotDoor)
  hotspotDoorMode?.addEventListener('change', commitHotspotDoor)
  hotspotClipStart?.addEventListener('change', commitHotspotDoor)
  hotspotClipEnd?.addEventListener('change', commitHotspotDoor)

  const commitHotspotMeshVisibility = () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    const key = hotspotMeshNode?.value || ''
    if (!key) {
      options.onHotspotMeshVisibility(editingHotspotId, null)
      return
    }
    const modeRaw = hotspotMeshMode?.value || 'hide'
    const mode = modeRaw === 'show' || modeRaw === 'toggle' ? modeRaw : 'hide'
    options.onHotspotMeshVisibility(editingHotspotId, { nodeKey: key, mode })
  }
  hotspotMeshNode?.addEventListener('change', commitHotspotMeshVisibility)
  hotspotMeshMode?.addEventListener('change', commitHotspotMeshVisibility)
  root.querySelector('[data-action="hotspot-mesh-use-selected"]')?.addEventListener('click', () => {
    if (!editingHotspotId || !hotspotMeshNode) return
    const selectedKey = hotspotMeshNode.dataset.selectedObjectKey || ''
    if (!selectedKey) return
    if (![...hotspotMeshNode.options].some((o) => o.value === selectedKey)) return
    hotspotMeshNode.value = selectedKey
    commitHotspotMeshVisibility()
  })

  const commitHotspotRotation = () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    const x = Number(hotspotRotX?.value || 0)
    const y = Number(hotspotRotY?.value || 0)
    const z = Number(hotspotRotZ?.value || 0)
    setSliderVal(hotspotRotXVal, Math.round(x))
    setSliderVal(hotspotRotYVal, Math.round(y))
    setSliderVal(hotspotRotZVal, Math.round(z))
    options.onHotspotMarkerRotation(editingHotspotId, [x, y, z])
  }
  hotspotRotX?.addEventListener('input', commitHotspotRotation)
  hotspotRotY?.addEventListener('input', commitHotspotRotation)
  hotspotRotZ?.addEventListener('input', commitHotspotRotation)
  root.querySelector('[data-action="hotspot-rot-reset"]')?.addEventListener('click', () => {
    if (!editingHotspotId) return
    if (hotspotRotX) hotspotRotX.value = '0'
    if (hotspotRotY) hotspotRotY.value = '0'
    if (hotspotRotZ) hotspotRotZ.value = '0'
    setSliderVal(hotspotRotXVal, 0)
    setSliderVal(hotspotRotYVal, 0)
    setSliderVal(hotspotRotZVal, 0)
    options.onHotspotMarkerRotation(editingHotspotId, null)
  })

  const commitHotspotLabelLayout = () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    const scale = Number(hotspotLabelScale?.value || 1)
    const ox = Number(hotspotLabelOx?.value || 0)
    const oy = Number(hotspotLabelOy?.value || 0)
    const oz = Number(hotspotLabelOz?.value || 0)
    setSliderVal(hotspotLabelScaleVal, scale)
    setSliderVal(hotspotLabelOxVal, ox)
    setSliderVal(hotspotLabelOyVal, oy)
    setSliderVal(hotspotLabelOzVal, oz)
    options.onHotspotMarkerLabelLayout(editingHotspotId, {
      scale,
      offset: [ox, oy, oz],
    })
  }
  hotspotLabelScale?.addEventListener('input', commitHotspotLabelLayout)
  hotspotLabelOx?.addEventListener('input', commitHotspotLabelLayout)
  hotspotLabelOy?.addEventListener('input', commitHotspotLabelLayout)
  hotspotLabelOz?.addEventListener('input', commitHotspotLabelLayout)
  root.querySelector('[data-action="hotspot-label-reset"]')?.addEventListener('click', () => {
    if (!editingHotspotId) return
    if (hotspotLabelScale) hotspotLabelScale.value = '1'
    if (hotspotLabelOx) hotspotLabelOx.value = '0'
    if (hotspotLabelOy) hotspotLabelOy.value = '2.4'
    if (hotspotLabelOz) hotspotLabelOz.value = '0.04'
    setSliderVal(hotspotLabelScaleVal, 1)
    setSliderVal(hotspotLabelOxVal, 0)
    setSliderVal(hotspotLabelOyVal, 2.4)
    setSliderVal(hotspotLabelOzVal, 0.04)
    options.onHotspotMarkerLabelLayout(editingHotspotId, null)
  })

  hotspotVideoInput.addEventListener('change', () => {
    if (!editingHotspotId) return
    const file = hotspotVideoInput.files?.[0]
    if (file) options.onHotspotVideo(editingHotspotId, file)
    hotspotVideoInput.value = ''
  })
  root.querySelector('[data-action="hotspot-clear-video"]')?.addEventListener('click', () => {
    if (editingHotspotId) options.onHotspotClearVideo(editingHotspotId)
  })
  root.querySelector('[data-action="hotspot-test"]')?.addEventListener('click', () => {
    if (editingHotspotId) options.onHotspotTest(editingHotspotId)
  })
  root.querySelector('[data-action="shot-capture"]')?.addEventListener('click', options.onCaptureShot)
  root.querySelector('[data-action="pick-project"]')?.addEventListener('click', () => {
    ;(root.querySelector('[data-import]') as HTMLInputElement | null)?.click()
  })
  root.querySelector('[data-action="pick-glb"]')?.addEventListener('click', () => {
    ;(root.querySelector('[data-import-glb]') as HTMLInputElement | null)?.click()
  })
  root.querySelector('[data-action="pick-rig"]')?.addEventListener('click', () => {
    ;(root.querySelector('[data-import-rig]') as HTMLInputElement | null)?.click()
  })

  root.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      options.onUiTheme(btn.getAttribute('data-theme') as UiChromeTheme)
    })
  })

  root.querySelector('[data-import]')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) options.onImportFile(file)
    input.value = ''
  })

  root.querySelector('[data-import-glb]')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement
    const list = input.files
    if (list?.length) {
      const role = roleSelect.value as 'replace-vehicle' | 'add-prop'
      const quality = qualitySlot.value as
        | 'auto'
        | 'vehicle-master'
        | 'vehicle-high'
        | 'vehicle-balanced'
        | 'vehicle-mobile'
      options.onImportGlb(Array.from(list), role, quality)
    }
    input.value = ''
  })

  root.querySelector('[data-import-rig]')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) options.onImportRigManifest(file)
    input.value = ''
  })

  activeQuality.addEventListener('change', () => {
    if (syncingQuality) return
    const role = activeQuality.value as
      | 'vehicle-master'
      | 'vehicle-high'
      | 'vehicle-balanced'
      | 'vehicle-mobile'
      | ''
    if (role) options.onSwitchQuality(role)
  })

  hotspotList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-hotspot-id]')
    if (!button || !hotspotList.contains(button)) return
    const id = button.dataset.hotspotId
    if (!id) return
    const action = button.dataset.action
    if (action === 'hotspot-delete') {
      options.onDeleteHotspot(id)
      return
    }
    if (action === 'hotspot-recenter') {
      options.onRecenterHotspot(id)
      return
    }
    if (action === 'hotspot-reposition') {
      options.onRepositionHotspot(id)
      return
    }
    if (action === 'hotspot-test-item') {
      options.onHotspotTest(id)
      return
    }
    if (action === 'hotspot-toggle') {
      if (editingHotspotId === id && !hotspotEditor.hidden) {
        editingHotspotId = null
        mountHotspotEditorIntoList(null)
        return
      }
      options.onSelectHotspot(id)
    }
  })

  shotList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-shot-id]')
    if (!button) return
    const id = button.dataset.shotId
    if (!id) return
    if (button.dataset.action === 'shot-delete') options.onDeleteShot(id)
    else if (button.dataset.action === 'shot-go') options.onGoToShot(id)
    else if (button.dataset.action === 'shot-edit') options.onSelectShot(id)
  })
  shotNameInput?.addEventListener('change', () => {
    if (syncingShotEditor || !editingShotId) return
    options.onShotName(editingShotId, shotNameInput.value.trim() || 'Shot')
  })
  const commitShotPlayAction = () => {
    if (syncingShotEditor || !editingShotId) return
    const parseOpt = (el: HTMLInputElement): number | null => {
      const raw = el.value.trim()
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    options.onShotPlayAction(editingShotId, shotPlaySelect.value || null, {
      startSeconds: parseOpt(shotClipStart),
      endSeconds: parseOpt(shotClipEnd),
    })
  }
  shotPlaySelect?.addEventListener('change', commitShotPlayAction)
  shotClipStart?.addEventListener('change', commitShotPlayAction)
  shotClipEnd?.addEventListener('change', commitShotPlayAction)
  root.querySelector('[data-action="shot-go-edit"]')?.addEventListener('click', () => {
    if (editingShotId) options.onGoToShot(editingShotId)
  })
  root.querySelector('[data-action="shot-delete-edit"]')?.addEventListener('click', () => {
    if (!editingShotId) return
    options.onDeleteShot(editingShotId)
  })

  nameInput.addEventListener('change', () => options.onRename(nameInput.value))
  envSelect.addEventListener('change', () => options.onEnvironmentPreset(envSelect.value))
  lengthInput.addEventListener('change', () => {
    const v = lengthInput.value === '' ? null : Number(lengthInput.value)
    options.onTargetLength(v != null && Number.isFinite(v) ? v : null)
  })
  groundInput.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-ground-val]'), Number(groundInput.value))
  })
  groundInput.addEventListener('change', () => options.onGroundOffset(Number(groundInput.value)))
  clipSelect.addEventListener('change', () => options.onClipSelect(Number(clipSelect.value)))
  clipScrub.addEventListener('input', () => options.onClipSeek(Number(clipScrub.value)))

  const syncSunLabels = () => {
    const azNum = root.querySelector('[data-sun-az-val]') as HTMLInputElement | null
    const elNum = root.querySelector('[data-sun-el-val]') as HTMLInputElement | null
    if (azNum && document.activeElement !== azNum) azNum.value = sunAz.value
    if (elNum && document.activeElement !== elNum) elNum.value = sunEl.value
  }
  const syncMoonLabels = () => {
    const azNum = root.querySelector('[data-moon-az-val]') as HTMLInputElement | null
    const elNum = root.querySelector('[data-moon-el-val]') as HTMLInputElement | null
    if (moonAz && azNum && document.activeElement !== azNum) azNum.value = moonAz.value
    if (moonEl && elNum && document.activeElement !== elNum) elNum.value = moonEl.value
  }

  bindEnvRange(sunAz, root.querySelector('[data-sun-az-val]') as HTMLInputElement, {
    live: (n) => options.onEnvironmentLive({ sunAzimuthDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ sunAzimuthDeg: n }),
  })
  bindEnvRange(sunEl, root.querySelector('[data-sun-el-val]') as HTMLInputElement, {
    live: (n) => options.onEnvironmentLive({ sunElevationDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ sunElevationDeg: n }),
  })
  hdr.addEventListener('change', () => options.onEnvironmentPatch({ hdrBackground: hdr.checked }))
  stars.addEventListener('change', () => options.onEnvironmentPatch({ starsEnabled: stars.checked }))
  moon.addEventListener('change', () => options.onEnvironmentPatch({ moonEnabled: moon.checked }))
  moonKey?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonAsKeyLight: moonKey.checked }),
  )
  bindEnvRange(moonAz, root.querySelector('[data-moon-az-val]') as HTMLInputElement, {
    live: (n) => options.onEnvironmentLive({ moonAzimuthDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ moonAzimuthDeg: n }),
  })
  bindEnvRange(moonEl, root.querySelector('[data-moon-el-val]') as HTMLInputElement, {
    live: (n) => options.onEnvironmentLive({ moonElevationDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ moonElevationDeg: n }),
  })
  exposure?.addEventListener('input', () => {
    setSliderVal(exposureVal, Number(exposure.value))
    options.onEnvironmentLive({ exposure: Number(exposure.value) })
  })
  exposure?.addEventListener('change', () =>
    options.onEnvironmentPatch({ exposure: Number(exposure.value) }),
  )
  envIntensity?.addEventListener('input', () => {
    setSliderVal(envIntensityVal, Number(envIntensity.value))
    options.onEnvironmentLive({ environmentIntensity: Number(envIntensity.value) })
  })
  envIntensity?.addEventListener('change', () =>
    options.onEnvironmentPatch({ environmentIntensity: Number(envIntensity.value) }),
  )
  scrub.addEventListener('input', () => options.onSeek(Number(scrub.value)))

  routeSpeed.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-speed-val]'), Number(routeSpeed.value))
    options.onRouteSpeed(Number(routeSpeed.value))
  })
  routeSpeed.addEventListener('change', () => {
    options.onRouteSpeed(Number(routeSpeed.value), { commit: true })
  })
  routeRoll.addEventListener('change', () => options.onRouteWheelRoll(routeRoll.checked))
  routeClosed.addEventListener('change', () => options.onRouteClosed(routeClosed.checked))
  routeChase.addEventListener('change', () => options.onRouteChaseCamera(routeChase.checked))
  freeDrive?.addEventListener('change', () => options.onFreeDriveEnabled(freeDrive.checked))
  freeDriveHeadingFlip?.addEventListener('change', () =>
    options.onFreeDriveHeadingFlip(freeDriveHeadingFlip.checked),
  )

  const syncChaseLabels = () => {
    setSliderVal(root.querySelector('[data-chase-yaw-val]'), Math.round(Number(chaseYaw.value)))
    setSliderVal(root.querySelector('[data-chase-pitch-val]'), Math.round(Number(chasePitch.value)))
    setSliderVal(root.querySelector('[data-chase-dist-val]'), Number(chaseDist.value))
    setSliderVal(root.querySelector('[data-chase-target-val]'), Number(chaseTarget.value))
  }
  const emitChaseOrbit = () => {
    options.onRouteChaseOrbit({
      yawDeg: Number(chaseYaw.value),
      pitchDeg: Number(chasePitch.value),
      distance: Number(chaseDist.value),
      lookAhead: Number(chaseTarget.value),
      lookSide: lastChaseLookSide,
    })
  }
  chaseYaw.addEventListener('input', () => {
    syncChaseLabels()
    emitChaseOrbit()
  })
  chasePitch.addEventListener('input', () => {
    syncChaseLabels()
    emitChaseOrbit()
  })
  chaseDist.addEventListener('input', () => {
    syncChaseLabels()
    emitChaseOrbit()
  })
  chaseTarget.addEventListener('input', () => {
    syncChaseLabels()
    emitChaseOrbit()
  })
  root.querySelectorAll('[data-chase-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = (btn as HTMLElement).dataset.chasePreset
      if (preset) options.onRouteChasePreset(preset)
    })
  })

  routeEdit.addEventListener('change', () => options.onRouteEditPath(routeEdit.checked))
  routeReverse.addEventListener('change', () => options.onRouteReverse(routeReverse.checked))
  routeAccel.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-accel-val]'), Number(routeAccel.value))
    options.onRouteAccel(Number(routeAccel.value))
  })
  routeBrake.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-brake-val]'), Number(routeBrake.value))
    options.onRouteBrake(Number(routeBrake.value))
  })
  routeStartAccel.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-start-accel-val]'), Number(routeStartAccel.value))
    options.onRouteStartAccel(Number(routeStartAccel.value))
  })
  routeEndStop.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-end-stop-val]'), Number(routeEndStop.value))
    options.onRouteEndStop(Number(routeEndStop.value))
  })
  routeOval.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-oval-val]'), Number(routeOval.value))
    options.onRouteOvalScale(Number(routeOval.value))
  })
  routeOpen.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-open-val]'), Number(routeOpen.value))
    options.onRouteOpenScale(Number(routeOpen.value))
  })
  const syncPathScaleLabel = () => {
    setSliderVal(root.querySelector('[data-route-path-scale-val]'), Number(routePathScale.value))
  }
  routePathScale.addEventListener('pointerdown', () => options.onRoutePathScaleBegin())
  routePathScale.addEventListener('input', () => {
    syncPathScaleLabel()
    options.onRoutePathScale(Number(routePathScale.value))
  })
  const endPathScaleUi = () => {
    options.onRoutePathScaleEnd()
    routePathScale.value = '1'
    syncPathScaleLabel()
  }
  routePathScale.addEventListener('pointerup', endPathScaleUi)
  routePathScale.addEventListener('change', endPathScaleUi)
  routeRollRate.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-roll-rate-val]'), Number(routeRollRate.value))
    options.onRouteTireRollRate(Number(routeRollRate.value))
  })
  routeSteer.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-steer-val]'), Number(routeSteer.value))
    options.onRouteMaxSteer(Number(routeSteer.value))
  })
  routeBodyRoll.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-route-body-roll-val]'), Number(routeBodyRoll.value))
    options.onRouteBodyRoll(Number(routeBodyRoll.value))
  })

  stageFloor.addEventListener('change', () => {
    options.onStagePatch({ floorVisible: stageFloor.checked })
  })
  stagePedestal.addEventListener('change', () => {
    options.onStagePatch({ pedestalVisible: stagePedestal.checked })
  })
  stageCyclorama.addEventListener('change', () => {
    options.onStagePatch({ cycloramaVisible: stageCyclorama.checked })
  })

  type StageSurfaceKey = 'floor' | 'pedestal' | 'cyclorama'
  const repeatLabelRefresh: Partial<Record<StageSurfaceKey, () => void>> = {}

  const bindSurface = (key: StageSurfaceKey) => {
    const size = root.querySelector(`[data-stage-${key}-size]`) as HTMLInputElement
    const sizeVal = root.querySelector(`[data-stage-${key}-size-val]`) as HTMLElement
    const color = root.querySelector(`[data-stage-${key}-color]`) as HTMLInputElement
    const metal = root.querySelector(`[data-stage-${key}-metal]`) as HTMLInputElement
    const metalVal = root.querySelector(`[data-stage-${key}-metal-val]`) as HTMLElement
    const rough = root.querySelector(`[data-stage-${key}-rough]`) as HTMLInputElement
    const roughVal = root.querySelector(`[data-stage-${key}-rough-val]`) as HTMLElement
    const emissive = root.querySelector(`[data-stage-${key}-emissive]`) as HTMLInputElement
    const emi = root.querySelector(`[data-stage-${key}-emi]`) as HTMLInputElement
    const emiVal = root.querySelector(`[data-stage-${key}-emi-val]`) as HTMLElement
    const repeat = root.querySelector(`[data-stage-${key}-repeat]`) as HTMLInputElement
    const repeatVal = root.querySelector(`[data-stage-${key}-repeat-val]`) as HTMLElement
    const disp = root.querySelector(`[data-stage-${key}-disp]`) as HTMLInputElement
    const dispVal = root.querySelector(`[data-stage-${key}-disp-val]`) as HTMLElement
    const vary = root.querySelector(`[data-stage-${key}-vary]`) as HTMLInputElement | null
    const varyVal = root.querySelector(`[data-stage-${key}-vary-val]`) as HTMLElement | null
    const reseed = root.querySelector(`[data-stage-${key}-reseed]`) as HTMLButtonElement | null

    const patchSurface = (partial: Record<string, unknown>) => {
      options.onStagePatch({ [key]: partial } as unknown as Partial<StageState>)
    }

    // The tiles slider is log2(tiles), so one control spans 0.06× → 1024×.
    const tilesFromSlider = () => 2 ** Number(repeat?.value ?? 0)
    const showTiles = () => {
      if (!repeatVal) return
      const tiles = tilesFromSlider()
      const spanMetres = (key === 'cyclorama' ? 2 : 1) * Number(size?.value || 0)
      const perTile = spanMetres > 0 ? spanMetres / tiles : 0
      const tileText = tiles < 10 ? `${tiles.toFixed(2)}×` : `${Math.round(tiles)}×`
      repeatVal.textContent = perTile
        ? `${tileText} · ${perTile < 1 ? perTile.toFixed(2) : perTile.toFixed(1)} m`
        : tileText
    }
    repeatLabelRefresh[key] = showTiles

    size?.addEventListener('input', () => {
      setSliderVal(sizeVal, Number(size.value))
      const num = Number(size.value)
      if (key === 'floor') options.onStagePatch({ floorSize: num })
      else if (key === 'pedestal') options.onStagePatch({ pedestalSize: num })
      else options.onStagePatch({ cycloramaSize: num })
      showTiles()
    })
    color?.addEventListener('input', () => patchSurface({ color: color.value }))
    metal?.addEventListener('input', () => {
      setSliderVal(metalVal, Number(metal.value))
      patchSurface({ metalness: Number(metal.value) })
    })
    rough?.addEventListener('input', () => {
      setSliderVal(roughVal, Number(rough.value))
      patchSurface({ roughness: Number(rough.value) })
    })
    emissive?.addEventListener('input', () => patchSurface({ emissive: emissive.value }))
    emi?.addEventListener('input', () => {
      const intensity = Number(emi.value)
      setSliderVal(emiVal, intensity)
      // Black emissive cancels glow — seed from albedo when intensity rises.
      const isBlack = !emissive?.value || /^#0{3,8}$/i.test(emissive.value)
      if (intensity > 0 && isBlack && color?.value) {
        emissive.value = color.value
        patchSurface({ emissive: color.value, emissiveIntensity: intensity })
      } else {
        patchSurface({ emissiveIntensity: intensity })
      }
    })
    repeat?.addEventListener('input', () => {
      showTiles()
      patchSurface({ mapRepeat: tilesFromSlider() })
    })
    disp?.addEventListener('input', () => {
      setSliderVal(dispVal, Number(disp.value))
      patchSurface({ displacementScale: Number(disp.value) })
    })
    vary?.addEventListener('input', () => {
      const amount = Number(vary.value)
      setSliderVal(varyVal, amount)
      patchSurface({ tileVariation: amount })
    })
    reseed?.addEventListener('click', () => {
      // A new seed does nothing while the blend is off, so lift it to a visible default.
      const amount = Number(vary?.value || 0) > 0.02 ? Number(vary?.value) : 0.65
      if (vary) vary.value = String(amount)
      setSliderVal(varyVal, amount)
      patchSurface({ tileVariation: amount, tileSeed: Math.random() * 64 })
      const assignedKinds = [
        'map',
        'normal',
        'roughness',
        'metalness',
        'displacement',
        'ao',
        'emissive',
      ].filter((m) =>
        root
          .querySelector(`[data-stage-map-slot="${key}:${m}"]`)
          ?.classList.contains('as-map-slot--set'),
      )
      if (assignedKinds.length === 0) {
        statusEl.textContent = 'Randomise needs at least one texture map assigned on this surface.'
        statusEl.classList.add('as-status--warn')
      } else {
        statusEl.textContent = `Randomised ${key} · ${assignedKinds.length} map${assignedKinds.length === 1 ? '' : 's'} (break tiling ${amount.toFixed(2)}).`
        statusEl.classList.remove('as-status--warn')
      }
    })
    showTiles()
  }
  bindSurface('floor')
  bindSurface('pedestal')
  bindSurface('cyclorama')

  const stageCycHeight = root.querySelector('[data-stage-cyclorama-height]') as HTMLInputElement | null
  const stageCycHeightVal = root.querySelector('[data-stage-cyclorama-height-val]') as HTMLElement | null
  stageCycHeight?.addEventListener('input', () => {
    const h = Number(stageCycHeight.value)
    setSliderVal(stageCycHeightVal, h)
    options.onStagePatch({ cycloramaHeight: h })
  })
  const stageCycCrop = root.querySelector('[data-stage-cyclorama-crop]') as HTMLInputElement | null
  const stageCycCropVal = root.querySelector('[data-stage-cyclorama-crop-val]') as HTMLElement | null
  stageCycCrop?.addEventListener('input', () => {
    const pct = Number(stageCycCrop.value)
    setSliderVal(stageCycCropVal, Math.round(pct))
    options.onStagePatch({ cycloramaCropTop: Math.max(0, Math.min(0.75, pct / 100)) })
  })

  const stagePedHeight = root.querySelector('[data-stage-pedestal-height]') as HTMLInputElement | null
  const stagePedHeightVal = root.querySelector('[data-stage-pedestal-height-val]') as HTMLElement | null
  stagePedHeight?.addEventListener('input', () => {
    const h = Number(stagePedHeight.value)
    setSliderVal(stagePedHeightVal, h)
    options.onStagePatch({ pedestalHeight: h })
    // Keep tires on the top face while authoring thickness.
    options.onSitOnPedestal()
  })
  root.querySelector('[data-action="sit-on-pedestal"]')?.addEventListener('click', () => {
    options.onSitOnPedestal()
  })
  root.querySelector('[data-action="sit-on-ground"]')?.addEventListener('click', () => {
    options.onSitOnGround()
  })

  const stageCycVolume = root.querySelector(
    '[data-stage-cyclorama-volume]',
  ) as HTMLInputElement | null
  const stageCycVolumeIntensity = root.querySelector(
    '[data-stage-cyclorama-volume-intensity]',
  ) as HTMLInputElement | null
  const stageCycVolumeIntensityVal = root.querySelector(
    '[data-stage-cyclorama-volume-intensity-val]',
  ) as HTMLElement | null
  const stageCycInteractive = root.querySelector(
    '[data-stage-cyclorama-interactive]',
  ) as HTMLInputElement | null
  const stageCycVideoMuted = root.querySelector(
    '[data-stage-cyclorama-video-muted]',
  ) as HTMLInputElement | null
  const stageCycVideoLoop = root.querySelector(
    '[data-stage-cyclorama-video-loop]',
  ) as HTMLInputElement | null
  const stageCycVideoFit = root.querySelector(
    '[data-stage-cyclorama-video-fit]',
  ) as HTMLSelectElement | null
  const stageCycVideoFile = root.querySelector(
    '[data-stage-cyclorama-video-file]',
  ) as HTMLInputElement | null
  const stageCycVideoLabel = root.querySelector(
    '[data-stage-cyclorama-video-label]',
  ) as HTMLElement | null

  stageCycVolume?.addEventListener('change', () => {
    options.onStagePatch({ cycloramaVolumeGlow: stageCycVolume.checked })
  })
  stageCycVolumeIntensity?.addEventListener('input', () => {
    const v = Number(stageCycVolumeIntensity.value)
    setSliderVal(stageCycVolumeIntensityVal, v)
    options.onStagePatch({ cycloramaVolumeIntensity: v })
  })
  stageCycInteractive?.addEventListener('change', () => {
    options.onStagePatch({ cycloramaInteractive: stageCycInteractive.checked })
  })
  stageCycVideoMuted?.addEventListener('change', () => {
    options.onStagePatch({ cycloramaVideoMuted: stageCycVideoMuted.checked })
  })
  stageCycVideoLoop?.addEventListener('change', () => {
    options.onStagePatch({ cycloramaVideoLoop: stageCycVideoLoop.checked })
  })
  stageCycVideoFit?.addEventListener('change', () => {
    const fit = stageCycVideoFit.value === 'contain' ? 'contain' : 'cover'
    options.onStagePatch({ cycloramaVideoFit: fit })
  })
  root.querySelector('[data-stage-cyclorama-video]')?.addEventListener('click', () => {
    stageCycVideoFile?.click()
  })
  stageCycVideoFile?.addEventListener('change', () => {
    const file = stageCycVideoFile.files?.[0]
    stageCycVideoFile.value = ''
    if (file) options.onCycloramaVideo(file)
  })
  root.querySelectorAll('[data-stage-cyclorama-video-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.stageCycloramaVideoPreset
      if (id === '1' || id === '2' || id === '3') options.onCycloramaVideoPreset(id)
    })
  })
  root.querySelector('[data-stage-cyclorama-video-clear]')?.addEventListener('click', () => {
    options.onCycloramaClearVideo()
  })
  root.querySelectorAll('[data-stage-floor-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.stageFloorPreset
      if (id !== 'asphalt' && id !== 'ice') return
      const hasMaps = root.querySelectorAll('[data-stage-map-slot^="floor:"].as-map-slot--set').length
      if (hasMaps > 0) {
        const ok = window.confirm(
          `Replace all ${hasMaps} floor map(s) with the ${id === 'asphalt' ? 'Asphalt' : 'Ice'} pack?\n\n` +
            'This clears previous maps first, then loads the bundled textures.',
        )
        if (!ok) return
      }
      options.onStageFloorPreset(id)
    })
  })

  root.querySelectorAll('[data-stage-map]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = (btn as HTMLElement).dataset.stageMap || ''
      const [surface, map] = token.split(':')
      if (!surface || !map) return
      const slot = root.querySelector(
        `[data-stage-map-slot="${CSS.escape(token)}"]`,
      ) as HTMLElement | null
      const assigned = slot?.classList.contains('as-map-slot--set')
      const fileLabel =
        root.querySelector(`[data-stage-map-file-label="${CSS.escape(token)}"]`)?.textContent ||
        'texture'
      if (assigned) {
        const replace = window.confirm(
          `${mapLabel(map)} already has “${fileLabel}”.\n\nOK = choose a new file to replace it.\nCancel = keep the current map.`,
        )
        if (!replace) return
      }
      pendingStageMap = {
        surface: surface as 'floor' | 'pedestal' | 'cyclorama',
        map,
      }
      stageMapFile.value = ''
      stageMapFile.click()
    })
  })
  root.querySelectorAll('[data-stage-map-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = (btn as HTMLElement).dataset.stageMapRemove || ''
      const [surface, map] = token.split(':')
      if (!surface || !map) return
      options.onStageTexture(
        surface as 'floor' | 'pedestal' | 'cyclorama',
        map as
          | 'map'
          | 'normal'
          | 'roughness'
          | 'metalness'
          | 'displacement'
          | 'ao'
          | 'emissive',
      )
    })
  })
  root.querySelectorAll('[data-stage-map-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const surface = (btn as HTMLElement).dataset.stageMapClear as
        | 'floor'
        | 'pedestal'
        | 'cyclorama'
      if (!surface) return
      options.onStageTexture(surface, 'clear')
    })
  })
  stageMapFile.addEventListener('change', () => {
    const file = stageMapFile.files?.[0]
    if (!file || !pendingStageMap) return
    options.onStageTexture(
      pendingStageMap.surface,
      pendingStageMap.map as
        | 'map'
        | 'normal'
        | 'roughness'
        | 'metalness'
        | 'displacement'
        | 'ao'
        | 'emissive',
      file,
    )
    pendingStageMap = null
  })
  root.querySelectorAll('[data-stage-map-pack]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const surface = (btn as HTMLElement).dataset.stageMapPack as
        | 'floor'
        | 'pedestal'
        | 'cyclorama'
      if (!surface) return
      const hasMaps = root.querySelectorAll(
        `[data-stage-map-slot^="${CSS.escape(surface)}:"].as-map-slot--set`,
      ).length
      if (hasMaps > 0) {
        const ok = window.confirm(
          `Replace all ${hasMaps} map(s) on ${surface} with this pack?\n\n` +
            'Load pack clears previous maps first — that is why leftover rock normals/depth made asphalt still look rocky.',
        )
        if (!ok) return
      }
      pendingStageMapPack = surface
      stageMapPackFile.value = ''
      stageMapPackFile.click()
    })
  })
  stageMapPackFile?.addEventListener('change', () => {
    const list = stageMapPackFile.files
    if (!list?.length || !pendingStageMapPack) return
    options.onStageTexturePack(pendingStageMapPack, Array.from(list))
    pendingStageMapPack = null
  })

  const stageMapPreviewsToggle = root.querySelector(
    '[data-stage-map-previews]',
  ) as HTMLInputElement | null
  stageMapPreviewsToggle?.addEventListener('change', () => {
    root.dataset.stageMapPreviews = stageMapPreviewsToggle.checked ? 'on' : 'off'
  })

  type MatMapKind =
    | 'map'
    | 'normal'
    | 'roughness'
    | 'metalness'
    | 'displacement'
    | 'ao'
    | 'emissive'
  root.querySelectorAll('[data-mat-map]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const map = (btn as HTMLElement).dataset.matMap || ''
      if (!map) return
      const slot = root.querySelector(
        `[data-mat-map-slot="${CSS.escape(map)}"]`,
      ) as HTMLElement | null
      const assigned = slot?.classList.contains('as-map-slot--set')
      const fileLabel =
        root.querySelector(`[data-mat-map-file-label="${CSS.escape(map)}"]`)?.textContent ||
        'texture'
      if (assigned) {
        const replace = window.confirm(
          `${mapLabel(map)} already has “${fileLabel}”.\n\nOK = choose a new file to replace it.\nCancel = keep the current map.`,
        )
        if (!replace) return
      }
      pendingMatMap = map
      matMapFile.value = ''
      matMapFile.click()
    })
  })
  root.querySelectorAll('[data-mat-map-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const map = (btn as HTMLElement).dataset.matMapRemove as MatMapKind | undefined
      if (!map) return
      options.onMaterialTexture(map)
    })
  })
  root.querySelector('[data-mat-map-clear]')?.addEventListener('click', () => {
    options.onMaterialTexture('clear')
  })
  matMapFile?.addEventListener('change', () => {
    const file = matMapFile.files?.[0]
    if (!file || !pendingMatMap) return
    options.onMaterialTexture(pendingMatMap as MatMapKind, file)
    pendingMatMap = null
  })
  root.querySelector('[data-mat-map-pack]')?.addEventListener('click', () => {
    const hasMaps = root.querySelectorAll('[data-mat-map-slot].as-map-slot--set').length
    if (hasMaps > 0) {
      const ok = window.confirm(
        `Replace all ${hasMaps} map(s) on this material with this pack?\n\n` +
          'Load pack clears previous maps first.',
      )
      if (!ok) return
    }
    pendingMatMapPack = true
    matMapPackFile.value = ''
    matMapPackFile.click()
  })
  matMapPackFile?.addEventListener('change', () => {
    const list = matMapPackFile.files
    if (!list?.length || !pendingMatMapPack) return
    options.onMaterialTexturePack(Array.from(list))
    pendingMatMapPack = false
  })
  const matMapPreviewsToggle = root.querySelector(
    '[data-mat-map-previews]',
  ) as HTMLInputElement | null
  matMapPreviewsToggle?.addEventListener('change', () => {
    root.dataset.matMapPreviews = matMapPreviewsToggle.checked ? 'on' : 'off'
  })

  const mapLightbox = root.querySelector('[data-stage-map-lightbox]') as HTMLDialogElement | null
  const mapLightboxImg = root.querySelector('[data-stage-map-lightbox-img]') as HTMLImageElement | null
  const mapLightboxCaption = root.querySelector(
    '[data-stage-map-lightbox-caption]',
  ) as HTMLElement | null
  root.addEventListener('click', (event) => {
    const preview = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-stage-map-preview], button[data-mat-map-preview]',
    )
    if (!preview || !mapLightbox || !mapLightboxImg) return
    const img = preview.querySelector('img')
    if (!img?.src) return
    mapLightboxImg.src = img.src
    if (mapLightboxCaption) {
      mapLightboxCaption.textContent = preview.title || img.alt || 'Texture map'
    }
    mapLightbox.showModal()
  })

  accentEnabled.addEventListener('change', () => {
    options.onAccentLightsPatch({ enabled: accentEnabled.checked })
  })
  accentVolumetric.addEventListener('change', () => {
    options.onAccentLightsPatch({ volumetricEnabled: accentVolumetric.checked })
  })
  accentIntensity.addEventListener('input', () => {
    const value = Number(accentIntensity.value)
    setSliderVal(accentIntensityVal, value)
    options.onAccentLightsPatch({ intensity: value })
  })

  root.querySelectorAll<HTMLInputElement>('[data-vlight]').forEach((el) => {
    el.addEventListener('change', () => {
      const groupId = el.getAttribute('data-vlight') as VehicleLightGroupId
      if (!groupId) return
      options.onVehicleLightsPatch({ groups: { [groupId]: el.checked } })
    })
  })
  vlightIntensity?.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-vlight-intensity-val]'), Number(vlightIntensity.value))
    options.onVehicleLightsPatch({ intensity: Number(vlightIntensity.value) })
  })
  vlightProxies?.addEventListener('change', () => {
    if (vlightProxies.checked) {
      options.onVehicleLightsPatch({ proxiesEnabled: true, performanceMode: 'full' })
    } else {
      options.onVehicleLightsPatch({ proxiesEnabled: false })
    }
  })
  vlightLite?.addEventListener('change', () => {
    if (vlightLite.checked) {
      options.onVehicleLightsPatch({
        performanceMode: 'lite',
        proxiesEnabled: false,
        bloomEnabled: false,
      })
    } else {
      options.onVehicleLightsPatch({
        performanceMode: 'full',
        proxiesEnabled: true,
      })
    }
  })
  vlightAutoNight?.addEventListener('change', () =>
    options.onVehicleLightsPatch({ autoRunningAtNight: vlightAutoNight.checked }),
  )
  root.querySelector('[data-action="vlight-all-off"]')?.addEventListener('click', () => {
    options.onVehicleLightsPatch({
      groups: {
        drl: false,
        lowBeam: false,
        highBeam: false,
        tail: false,
        brake: false,
        indicatorLeft: false,
        indicatorRight: false,
        hazards: false,
        reverse: false,
        interior: false,
      },
    })
  })
  root.querySelector('[data-action="vlight-night"]')?.addEventListener('click', () => {
    options.onVehicleLightsPatch({
      groups: {
        drl: true,
        lowBeam: false,
        highBeam: false,
        tail: true,
        brake: false,
        indicatorLeft: false,
        indicatorRight: false,
        hazards: false,
        reverse: false,
        interior: false,
      },
    })
  })
  root.querySelector('[data-action="vlight-welcome"]')?.addEventListener('click', () => {
    options.onVehicleLightSequence('welcome')
  })
  root.querySelector('[data-action="vlight-farewell"]')?.addEventListener('click', () => {
    options.onVehicleLightSequence('farewell')
  })
  vlightBloom?.addEventListener('change', () => {
    if (vlightBloom.checked) {
      options.onVehicleLightsPatch({ bloomEnabled: true, performanceMode: 'full' })
    } else {
      options.onVehicleLightsPatch({ bloomEnabled: false })
    }
  })
  vlightBloomStr?.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-vlight-bloom-str-val]'), Number(vlightBloomStr.value))
    options.onVehicleLightsPatch({ bloomStrength: Number(vlightBloomStr.value) })
  })
  vlightBloomThr?.addEventListener('input', () => {
    setSliderVal(root.querySelector('[data-vlight-bloom-thr-val]'), Number(vlightBloomThr.value))
    options.onVehicleLightsPatch({ bloomThreshold: Number(vlightBloomThr.value) })
  })
  root.querySelector('[data-action="vlight-assign"]')?.addEventListener('click', () => {
    const groupId = (vlightRemapGroup?.value || 'lowBeam') as VehicleLightGroupId
    options.onVehicleLightAssignSelected(groupId)
  })
  root.querySelector('[data-action="vlight-clear-group"]')?.addEventListener('click', () => {
    const groupId = (vlightRemapGroup?.value || 'lowBeam') as VehicleLightGroupId
    options.onVehicleLightClearGroup(groupId)
  })
  root.querySelector('[data-action="vlight-clear-all-targets"]')?.addEventListener('click', () => {
    options.onVehicleLightClearAllTargets()
  })
  vlightBeamEdit?.addEventListener('change', () => {
    options.onBeamEditEnabled(vlightBeamEdit.checked)
  })
  vlightBeamSelect?.addEventListener('change', () => {
    options.onBeamSelect(vlightBeamSelect.value || null)
  })
  root.querySelectorAll<HTMLInputElement>('[data-vlight-beam-gizmo]').forEach((el) => {
    el.addEventListener('change', () => {
      if (!el.checked) return
      const mode = el.value === 'aim' ? 'aim' : el.value === 'rotate' ? 'rotate' : 'position'
      options.onBeamGizmoMode(mode)
    })
  })
  root.querySelector('[data-action="vlight-beam-dup"]')?.addEventListener('click', () => {
    options.onBeamDuplicate()
  })
  root.querySelector('[data-action="vlight-beam-add-drl"]')?.addEventListener('click', () => {
    options.onBeamAdd('drl')
  })
  root.querySelector('[data-action="vlight-beam-add-low"]')?.addEventListener('click', () => {
    options.onBeamAdd('lowBeam')
  })
  root.querySelector('[data-action="vlight-beam-del"]')?.addEventListener('click', () => {
    options.onBeamDelete()
  })
  root.querySelector('[data-action="vlight-beam-copy"]')?.addEventListener('click', () => {
    options.onBeamCopyPositions()
  })
  root.querySelector('[data-action="vlight-beam-reset"]')?.addEventListener('click', () => {
    options.onBeamResetAuto()
  })

  sunDisc?.addEventListener('change', () => options.onEnvironmentPatch({ sunDiscVisible: sunDisc.checked }))
  sunEnabled?.addEventListener('change', () =>
    options.onEnvironmentPatch({ sunEnabled: sunEnabled.checked }),
  )
  bindEnvRange(sunIntensity, root.querySelector('[data-sun-intensity-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ sunIntensity: n }),
    commit: (n) => options.onEnvironmentPatch({ sunIntensity: n }),
  })
  bindEnvRange(sunAng, root.querySelector('[data-sun-ang-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ sunAngularDiameterDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ sunAngularDiameterDeg: n }),
  })
  bindEnvRange(sunDiscScale, root.querySelector('[data-sun-disc-scale-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ sunDiscScale: n }),
    commit: (n) => options.onEnvironmentPatch({ sunDiscScale: n }),
  })
  bindEnvRange(moonScale, root.querySelector('[data-moon-scale-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ moonScale: n }),
    commit: (n) => options.onEnvironmentPatch({ moonScale: n }),
  })
  bindEnvRange(moonIntensity, root.querySelector('[data-moon-intensity-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ moonIntensity: n }),
    commit: (n) => options.onEnvironmentPatch({ moonIntensity: n }),
  })
  bindEnvRange(moonAng, root.querySelector('[data-moon-ang-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ moonAngularDiameterDeg: n }),
    commit: (n) => options.onEnvironmentPatch({ moonAngularDiameterDeg: n }),
  })
  bindEnvRange(moonPhase, root.querySelector('[data-moon-phase-val]') as HTMLInputElement, {
    decimals: 2,
    live: (n) => options.onEnvironmentLive({ moonPhase: n }),
    commit: (n) => options.onEnvironmentPatch({ moonPhase: n }),
  })

  objectPick?.addEventListener('change', () => {
    if (objectPick.checked && matPick) matPick.checked = false
    const pickOn =
      (activeSection === 'Objects' && objectPick.checked) ||
      (activeSection === 'Materials' && Boolean(matPick?.checked))
    const pickMode =
      activeSection === 'Materials' && matPick?.checked ? 'material' : 'object'
    options.onObjectPickMode(pickOn, pickMode)
    setMatPickHudVisible(Boolean(activeSection === 'Materials' && matPick?.checked))
  })
  matPick?.addEventListener('change', () => {
    if (matPick.checked && objectPick) objectPick.checked = false
    const pickOn =
      (activeSection === 'Materials' && matPick.checked) ||
      (activeSection === 'Objects' && Boolean(objectPick?.checked))
    const pickMode =
      activeSection === 'Materials' && matPick.checked ? 'material' : 'object'
    options.onObjectPickMode(pickOn, pickMode)
    setMatPickHudVisible(Boolean(activeSection === 'Materials' && matPick.checked))
  })
  objectSelect?.addEventListener('change', () => {
    if (syncingObjectSelect) return
    const id = objectSelect.value || null
    if (matObjectSelect) matObjectSelect.value = objectSelect.value
    options.onObjectSelect(id)
  })
  matObjectSelect?.addEventListener('change', () => {
    if (syncingObjectSelect) return
    const id = matObjectSelect.value || null
    if (objectSelect) objectSelect.value = matObjectSelect.value
    options.onObjectSelect(id)
  })
  matList?.addEventListener('change', () => {
    const value = matList.value
    if (!value) return
    const [meshId, slotStr] = value.split('::')
    const slot = Number(slotStr)
    if (!meshId || Number.isNaN(slot)) return
    options.onMaterialPick(meshId, slot)
  })

  const MATERIAL_PRESETS: Record<string, Record<string, unknown>> = {
    'white-paint': {
      color: '#f2f4f7',
      metalness: 0.18,
      roughness: 0.28,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      transmission: 0,
      opacity: 1,
      transparent: false,
      envMapIntensity: 1.15,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
    'black-paint': {
      color: '#0c0e12',
      metalness: 0.22,
      roughness: 0.32,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      transmission: 0,
      opacity: 1,
      transparent: false,
      envMapIntensity: 1.25,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
    chrome: {
      color: '#d8dde6',
      metalness: 1,
      roughness: 0.12,
      clearcoat: 0.2,
      clearcoatRoughness: 0.05,
      transmission: 0,
      opacity: 1,
      transparent: false,
      envMapIntensity: 1.4,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
    glass: {
      color: '#c8d8e8',
      metalness: 0,
      roughness: 0.05,
      clearcoat: 0.4,
      clearcoatRoughness: 0.05,
      transmission: 0.92,
      opacity: 0.35,
      transparent: true,
      envMapIntensity: 1.1,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
  }
  root.querySelectorAll('[data-mat-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-mat-preset') || ''
      const preset = MATERIAL_PRESETS[key]
      if (!preset) return
      options.onObjectMaterialPatch(preset)
      options.onObjectMaterialCommit()
    })
  })
  objectVisible?.addEventListener('change', () => {
    if (syncingObjectSelect) return
    const id = objectSelect.value
    if (id) options.onObjectVisible(id, objectVisible.checked)
  })
  objectFilterHidden?.addEventListener('change', () => {
    renderObjectVisibilityTree(lastObjectTreeNodes, lastObjectTreeSelectedId)
  })
  objectTree?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const row = target.closest('[data-object-row]') as HTMLElement | null
    if (!row) return
    const id = row.dataset.objectRow || ''
    if (!id) return
    // Visibility checkbox / its label — don't also change selection focus.
    if (target.closest('.as-object-vis')) return
    options.onObjectSelect(id)
  })
  objectTree?.addEventListener('change', (event) => {
    if (syncingObjectTreeVis) return
    const input = event.target as HTMLInputElement
    if (!input.matches('[data-object-row-vis]')) return
    const id = input.dataset.objectRowVis || ''
    if (id) options.onObjectVisible(id, input.checked)
  })
  objectDeselect?.addEventListener('click', () => {
    options.onObjectSelect(null)
  })
  matSlot?.addEventListener('change', () => options.onObjectMaterialIndex(Number(matSlot.value)))
  matColor?.addEventListener('input', () => options.onObjectMaterialPatch({ color: matColor.value }))
  matColor?.addEventListener('change', () => options.onObjectMaterialCommit())
  matMetal?.addEventListener('input', () => {
    setSliderVal(matMetalVal, Number(matMetal.value))
    options.onObjectMaterialPatch({ metalness: Number(matMetal.value) })
  })
  matMetal?.addEventListener('change', () => options.onObjectMaterialCommit())
  matRough?.addEventListener('input', () => {
    setSliderVal(matRoughVal, Number(matRough.value))
    options.onObjectMaterialPatch({ roughness: Number(matRough.value) })
  })
  matRough?.addEventListener('change', () => options.onObjectMaterialCommit())
  matEmissive?.addEventListener('input', () => options.onObjectMaterialPatch({ emissive: matEmissive.value }))
  matEmissive?.addEventListener('change', () => options.onObjectMaterialCommit())
  matEmi?.addEventListener('input', () => {
    setSliderVal(matEmiVal, Number(matEmi.value))
    options.onObjectMaterialPatch({ emissiveIntensity: Number(matEmi.value) })
  })
  matEmi?.addEventListener('change', () => options.onObjectMaterialCommit())
  matOpacity?.addEventListener('input', () => {
    setSliderVal(matOpacityVal, Number(matOpacity.value))
    options.onObjectMaterialPatch({ opacity: Number(matOpacity.value) })
  })
  matOpacity?.addEventListener('change', () => options.onObjectMaterialCommit())
  matTransparent?.addEventListener('change', () => {
    options.onObjectMaterialPatch({ transparent: matTransparent.checked })
    options.onObjectMaterialCommit()
  })
  matEnv?.addEventListener('input', () => {
    setSliderVal(matEnvVal, Number(matEnv.value))
    options.onObjectMaterialPatch({ envMapIntensity: Number(matEnv.value) })
  })
  matEnv?.addEventListener('change', () => options.onObjectMaterialCommit())
  const showMatMapTiles = () => {
    if (!matMapRepeatVal || !matMapRepeat) return
    const tiles = 2 ** Number(matMapRepeat.value)
    matMapRepeatVal.textContent =
      tiles < 10 ? `${tiles.toFixed(2)}×` : `${Math.round(tiles)}×`
  }
  matMapRepeat?.addEventListener('input', () => {
    showMatMapTiles()
    options.onObjectMaterialPatch({ mapRepeat: 2 ** Number(matMapRepeat.value) })
  })
  matMapRepeat?.addEventListener('change', () => options.onObjectMaterialCommit())
  matMapTriplanar?.addEventListener('change', () => {
    options.onObjectMaterialPatch({
      mapProjection: matMapTriplanar.checked ? 'triplanar' : 'uv',
      mapRepeat: matMapRepeat ? 2 ** Number(matMapRepeat.value) : 2,
      mapTriVariation: matMapVary ? Number(matMapVary.value) : 0.25,
    })
    options.onObjectMaterialCommit()
  })
  matMapVary?.addEventListener('input', () => {
    const v = Number(matMapVary.value)
    setSliderVal(matMapVaryVal, v)
    if (!matMapTriplanar?.checked) matMapTriplanar.checked = true
    options.onObjectMaterialPatch({
      mapProjection: 'triplanar',
      mapRepeat: matMapRepeat ? 2 ** Number(matMapRepeat.value) : 2,
      mapTriVariation: v,
    })
  })
  matMapVary?.addEventListener('change', () => options.onObjectMaterialCommit())
  matMapReseed?.addEventListener('click', () => {
    if (!matMapTriplanar?.checked) matMapTriplanar.checked = true
    let variation = matMapVary ? Number(matMapVary.value) : 0.25
    if (variation < 0.05) {
      variation = 0.25
      if (matMapVary) matMapVary.value = '0.25'
      setSliderVal(matMapVaryVal, 0.25)
    }
    options.onObjectMaterialPatch({
      mapProjection: 'triplanar',
      mapRepeat: matMapRepeat ? 2 ** Number(matMapRepeat.value) : 2,
      mapTriSeed: Math.random() * 64,
      mapTriVariation: variation,
    })
    options.onObjectMaterialCommit()
  })
  matCc?.addEventListener('input', () => {
    setSliderVal(matCcVal, Number(matCc.value))
    options.onObjectMaterialPatch({ clearcoat: Number(matCc.value) })
  })
  matCc?.addEventListener('change', () => options.onObjectMaterialCommit())
  matCcr?.addEventListener('input', () => {
    setSliderVal(matCcrVal, Number(matCcr.value))
    options.onObjectMaterialPatch({ clearcoatRoughness: Number(matCcr.value) })
  })
  matCcr?.addEventListener('change', () => options.onObjectMaterialCommit())
  matTrans?.addEventListener('input', () => {
    setSliderVal(matTransVal, Number(matTrans.value))
    options.onObjectMaterialPatch({ transmission: Number(matTrans.value) })
  })
  matTrans?.addEventListener('change', () => options.onObjectMaterialCommit())
  vehiclePolish?.addEventListener('change', () =>
    options.onVehiclePolishMode(vehiclePolish.checked ? 'auto' : 'off'),
  )

  root.querySelectorAll('[data-rail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-rail]').forEach((b) => b.removeAttribute('aria-current'))
      btn.setAttribute('aria-current', 'true')
      const section = (btn.textContent || 'Vehicle') as InspectorSection
      showSection(section)
      statusEl.textContent =
        section === 'Vehicle'
          ? 'Vehicle — import GLB, normalize scale, play embedded clips.'
              : section === 'Environment'
                ? 'Environment — separate Sun and Moon controls, IBL, stars.'
            : section === 'Route'
              ? 'Route — demo oval, Play transport to drive; tire roll needs a *-rigged.glb + manifesto.'
              : section === 'Objects'
                ? 'Objects — choose a mesh from the dropdown or pick in the viewport.'
              : section === 'Materials'
                ? 'Materials — edit colour, metalness, clearcoat, glass; presets for paint and chrome.'
              : section === 'Hotspots'
                ? 'Hotspots — pick a mesh/door or choose a node; markers follow animation.'
                : section === 'Shots'
                  ? 'Shots — capture and recall camera poses.'
                  : section === 'Stage'
                    ? 'Stage — size, colour, emissive and PBR maps for floor / pedestal / cyclorama.'
                    : section === 'Lights'
                      ? 'Lights — studio accents and semantic vehicle lamps (DRL, beams, brake…).'
                      : `${section} — tools arrive in later phases.`
      statusEl.classList.remove('as-status--warn')
    })
  })

  setupCollapsibleGroups(root)
  setupInspectorResize(root)
  showSection('Vehicle')

  const renderObjectVisibilityTree = (
    nodes: ObjectTreeNode[],
    selectedId: string | null,
  ) => {
    if (!objectTree) return
    if (!nodes.length) {
      objectTree.hidden = true
      objectTree.innerHTML = ''
      return
    }
    const offOnly = Boolean(objectFilterHidden?.checked)
    const rows = offOnly ? nodes.filter((n) => !n.effectiveVisible) : nodes
    objectTree.hidden = false
    syncingObjectTreeVis = true
    objectTree.innerHTML = rows
      .map((node) => {
        const selected = node.id === selectedId ? ' as-object-row--selected' : ''
        const off = !node.effectiveVisible ? ' as-object-row--off' : ''
        const indent = Math.min(node.depth, 10) * 10
        const title = !node.visible
          ? 'Turned off'
          : !node.effectiveVisible
            ? 'Hidden by a parent'
            : 'Visible'
        const badge = !node.visible ? 'off' : !node.effectiveVisible ? 'under' : ''
        const badgeHtml = badge
          ? `<span class="as-object-badge as-object-badge--${badge}">${badge === 'off' ? 'off' : '···'}</span>`
          : ''
        return `<div class="as-object-row${selected}${off}" data-object-row="${escapeAttr(node.id)}" role="option" aria-selected="${node.id === selectedId ? 'true' : 'false'}">
          <label class="as-object-vis" title="${title}">
            <input type="checkbox" data-object-row-vis="${escapeAttr(node.id)}" ${node.visible ? 'checked' : ''} aria-label="Visible: ${escapeAttr(node.name)}" />
          </label>
          <button type="button" class="as-object-name" style="padding-left:${indent}px">${escapeHtml(node.name)}${node.mesh ? '' : ` <em>${escapeHtml(node.type)}</em>`}${badgeHtml}</button>
        </div>`
      })
      .join('')
    if (offOnly && rows.length === 0) {
      objectTree.innerHTML =
        '<p class="as-hint as-object-tree-empty">Nothing is turned off.</p>'
    }
    syncingObjectTreeVis = false
  }

  return {
    viewportHost,
    updateMatPickHover(info: {
      clientX: number
      clientY: number
      meshName: string
      materialName: string
      slot: number
    } | null) {
      updateMatPickHud(info)
    },
    updateStore(snap) {
      const env = snap.project.environment
      root.querySelector('[data-project-name]')!.textContent = snap.project.name
      nameInput.value = snap.project.name
      envSelect.value = env.presetId
      sunAz.value = String(Math.round(env.sunAzimuthDeg))
      sunEl.value = String(Math.round(env.sunElevationDeg))
      hdr.checked = env.hdrBackground
      stars.checked = env.starsEnabled
      moon.checked = env.moonEnabled
      if (exposure) {
        exposure.value = String(env.exposure)
        setSliderVal(exposureVal, Number(env.exposure))
      }
      if (envIntensity) {
        envIntensity.value = String(env.environmentIntensity)
        setSliderVal(envIntensityVal, Number(env.environmentIntensity))
      }
      if (sunEnabled) sunEnabled.checked = env.sunEnabled !== false
      if (moonKey) moonKey.checked = Boolean(env.moonAsKeyLight)
      if (moonAz) moonAz.value = String(Math.round(env.moonAzimuthDeg ?? 295))
      if (moonEl) moonEl.value = String(Math.round(env.moonElevationDeg ?? 28))
      syncSunLabels()
      syncMoonLabels()
      const setSliderNum = (sel: string, value: number, decimals: number) => {
        const el = root.querySelector(sel) as HTMLInputElement | null
        if (!el || document.activeElement === el) return
        el.value = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
      }
      if (sunIntensity) {
        sunIntensity.value = String(env.sunIntensity ?? 1)
        setSliderNum('[data-sun-intensity-val]', env.sunIntensity ?? 1, 2)
      }
      if (sunAng) {
        sunAng.value = String(env.sunAngularDiameterDeg ?? 0.53)
        setSliderNum('[data-sun-ang-val]', env.sunAngularDiameterDeg ?? 0.53, 2)
      }
      if (moonAng) {
        moonAng.value = String(env.moonAngularDiameterDeg ?? 0.53)
        setSliderNum('[data-moon-ang-val]', env.moonAngularDiameterDeg ?? 0.53, 2)
      }
      if (moonPhase) {
        moonPhase.value = String(env.moonPhase ?? 0.5)
        setSliderNum('[data-moon-phase-val]', env.moonPhase ?? 0.5, 2)
      }
      const stage = snap.project.stage
      stageFloor.checked = stage.floorVisible
      stagePedestal.checked = stage.pedestalVisible
      stageCyclorama.checked = stage.cycloramaVisible
      if (stagePedHeight) {
        stagePedHeight.value = String(stage.pedestalHeight ?? 0.12)
      }
      if (stagePedHeightVal) {
        setSliderVal(stagePedHeightVal, Number(stage.pedestalHeight ?? 0.12))
      }
      const syncSurf = (key: 'floor' | 'pedestal' | 'cyclorama') => {
        const s = stage[key]
        const sizeEl = root.querySelector(`[data-stage-${key}-size]`) as HTMLInputElement | null
        const sizeVal = root.querySelector(`[data-stage-${key}-size-val]`) as HTMLElement | null
        const size =
          key === 'floor' ? stage.floorSize : key === 'pedestal' ? stage.pedestalSize : stage.cycloramaSize
        if (sizeEl) sizeEl.value = String(size)
        setSliderVal(sizeVal, Number(size))
        const set = (attr: string, value: string) => {
          const el = root.querySelector(`[data-stage-${key}-${attr}]`) as HTMLInputElement | null
          if (el) el.value = value
        }
        const setVal = (attr: string, value: string) => {
          const el = root.querySelector(`[data-stage-${key}-${attr}-val]`) as HTMLElement | null
          setSliderVal(el, value)
        }
        set('color', s.color)
        set('metal', String(s.metalness))
        setVal('metal', s.metalness.toFixed(2))
        set('rough', String(s.roughness))
        setVal('rough', s.roughness.toFixed(2))
        set('emissive', s.emissive)
        set('emi', String(s.emissiveIntensity))
        setVal('emi', s.emissiveIntensity.toFixed(2))
        set('repeat', String(Math.log2(Math.max(0.0625, s.mapRepeat || 1))))
        repeatLabelRefresh[key]?.()
        set('disp', String(s.displacementScale))
        setVal('disp', s.displacementScale.toFixed(2))
        const variation = s.tileVariation ?? 0
        set('vary', String(variation))
        setVal('vary', variation.toFixed(2))
        syncStageMapSlots(root, key, s.maps ?? {}, snap.project.assets)
      }
      syncSurf('floor')
      syncSurf('pedestal')
      syncSurf('cyclorama')
      if (stageCycHeight) {
        stageCycHeight.value = String(stage.cycloramaHeight ?? 10)
      }
      if (stageCycHeightVal) {
        setSliderVal(stageCycHeightVal, Number(stage.cycloramaHeight ?? 10))
      }
      if (stageCycCrop) {
        const cropPct = Math.round(Math.max(0, Math.min(0.75, stage.cycloramaCropTop ?? 0)) * 100)
        stageCycCrop.value = String(cropPct)
      }
      if (stageCycCropVal) {
        const cropPct = Math.round(Math.max(0, Math.min(0.75, stage.cycloramaCropTop ?? 0)) * 100)
        setSliderVal(stageCycCropVal, cropPct)
      }
      if (stageCycVolume) stageCycVolume.checked = Boolean(stage.cycloramaVolumeGlow)
      if (stageCycVolumeIntensity) {
        stageCycVolumeIntensity.value = String(stage.cycloramaVolumeIntensity ?? 1)
      }
      if (stageCycVolumeIntensityVal) {
        setSliderVal(stageCycVolumeIntensityVal, Number(stage.cycloramaVolumeIntensity ?? 1))
      }
      if (stageCycInteractive) {
        stageCycInteractive.checked = stage.cycloramaInteractive !== false
      }
      if (stageCycVideoMuted) {
        stageCycVideoMuted.checked = stage.cycloramaVideoMuted !== false
      }
      if (stageCycVideoLoop) {
        stageCycVideoLoop.checked = stage.cycloramaVideoLoop !== false
      }
      if (stageCycVideoFit) {
        stageCycVideoFit.value = stage.cycloramaVideoFit === 'contain' ? 'contain' : 'cover'
      }
      if (stageCycVideoLabel) {
        const vidId = stage.cycloramaVideoAssetId
        const asset = vidId ? snap.project.assets.find((a) => a.id === vidId) : null
        const fn = (asset?.filename || '').toLowerCase()
        const bundled =
          fn === 'video1.mp4' ? 'Video 1' : fn === 'video2.mp4' ? 'Video 2' : fn === 'video3.mp4' ? 'Video 3' : null
        stageCycVideoLabel.textContent = asset
          ? bundled
            ? `Wall: ${bundled}`
            : `Video: ${asset.filename || asset.id}`
          : 'No video — pick Video 1 / 2 / 3 or upload MP4/WebM.'
        for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-stage-cyclorama-video-preset]')) {
          const preset = btn.dataset.stageCycloramaVideoPreset
          const on = Boolean(bundled && preset && `Video ${preset}` === bundled)
          btn.classList.toggle('as-btn--accent', on)
          btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        }
      }
      const accents = snap.project.accentLights
      accentEnabled.checked = accents.enabled
      accentVolumetric.checked = accents.volumetricEnabled
      accentIntensity.value = String(accents.intensity ?? 1)
      setSliderVal(accentIntensityVal, Number(accents.intensity ?? 1))
      const vl = snap.project.vehicleLights
      if (vl) {
        for (const el of root.querySelectorAll<HTMLInputElement>('[data-vlight]')) {
          const id = el.getAttribute('data-vlight') as VehicleLightGroupId
          if (id && id in vl.groups) el.checked = Boolean(vl.groups[id])
        }
        if (vlightIntensity) {
          vlightIntensity.value = String(vl.intensity ?? 1)
          setSliderVal(root.querySelector('[data-vlight-intensity-val]'), Number(vl.intensity ?? 1))
        }
        if (vlightProxies) vlightProxies.checked = vl.proxiesEnabled !== false
        if (vlightLite) vlightLite.checked = vl.performanceMode === 'lite'
        if (vlightAutoNight) vlightAutoNight.checked = vl.autoRunningAtNight !== false
        if (vlightBloom) vlightBloom.checked = Boolean(vl.bloomEnabled)
        if (vlightBloomStr) {
          vlightBloomStr.value = String(vl.bloomStrength ?? 0.22)
          setSliderVal(root.querySelector('[data-vlight-bloom-str-val]'), Number(vl.bloomStrength ?? 0.22))
        }
        if (vlightBloomThr) {
          vlightBloomThr.value = String(vl.bloomThreshold ?? 1.05)
          setSliderVal(root.querySelector('[data-vlight-bloom-thr-val]'), Number(vl.bloomThreshold ?? 1.05))
        }
      }
      if (sunDisc) sunDisc.checked = env.sunDiscVisible
      if (sunDiscScale) {
        sunDiscScale.value = String(env.sunDiscScale ?? 1)
        setSliderNum('[data-sun-disc-scale-val]', env.sunDiscScale ?? 1, 2)
      }
      if (moonScale) {
        moonScale.value = String(env.moonScale ?? 1)
        setSliderNum('[data-moon-scale-val]', env.moonScale ?? 1, 2)
      }
      if (moonIntensity) {
        moonIntensity.value = String(env.moonIntensity ?? 1)
        setSliderNum('[data-moon-intensity-val]', env.moonIntensity ?? 1, 2)
      }
      if (vehiclePolish) {
        vehiclePolish.checked = (snap.project.vehicle?.polishMode ?? 'auto') !== 'off'
        vehiclePolish.disabled = !snap.project.vehicle
      }
      if (freeDrive) {
        freeDrive.checked = Boolean(snap.project.freeDrive?.enabled)
      }
      if (freeDriveHeadingFlip) {
        freeDriveHeadingFlip.checked = Boolean(snap.project.freeDrive?.headingFlip)
      }
      root.querySelector('[data-dirty]')!.textContent = snap.dirty ? 'dirty' : 'clean'
      root.querySelector('[data-access]')!.textContent = snap.project.presentation.accessPolicy
      ;(root.querySelector('[data-action="undo"]') as HTMLButtonElement).disabled = !snap.canUndo
      ;(root.querySelector('[data-action="redo"]') as HTMLButtonElement).disabled = !snap.canRedo

      const v = snap.project.vehicle
      if (v?.targetLengthMetres != null) lengthInput.value = String(v.targetLengthMetres.toFixed(2))
      if (v) {
        groundInput.value = String(v.groundOffsetMetres)
        setSliderVal(root.querySelector('[data-ground-val]'), v.groundOffsetMetres)
      }
      renderHotspotList(snap.project.hotspots)
      lastShots = snap.project.shots
      shotList.innerHTML = lastShots.length
        ? lastShots
            .map((shot) => {
              const anim = shot.playActionId ? ` · ${escapeHtml(shot.playActionId)}` : ''
              const thumb = shot.thumbnailDataUrl
                ? `<img class="as-shot-thumb" src="${escapeAttr(shot.thumbnailDataUrl)}" alt="" width="72" height="42" decoding="async" />`
                : `<span class="as-shot-thumb as-shot-thumb--empty" aria-hidden="true"></span>`
              return `
            <div class="as-item-row as-item-row--shot">
              ${thumb}
              <button type="button" class="as-btn" data-action="shot-edit" data-shot-id="${shot.id}">${escapeHtml(shot.name)}<span class="as-hint">${anim}</span></button>
              <button type="button" class="as-btn" data-action="shot-go" data-shot-id="${shot.id}">Go</button>
              <button type="button" class="as-btn" data-action="shot-delete" data-shot-id="${shot.id}" aria-label="Delete ${escapeHtml(shot.name)}">Delete</button>
            </div>`
            })
            .join('')
        : '<p class="as-hint">No shots yet. Capture a camera, then optionally attach a door/clip.</p>'
      if (editingShotId) {
        const editing = lastShots.find((s) => s.id === editingShotId) ?? null
        if (!editing) fillShotEditor(null, lastShotDoorActions)
        else if (!shotEditor?.contains(document.activeElement)) {
          fillShotEditor(editing, lastShotDoorActions)
        }
      }
    },
    updateTransport(snap) {
      scrub.max = String(snap.durationSeconds || 0)
      scrub.value = String(snap.timeSeconds)
      root.querySelector('[data-time]')!.textContent =
        `${snap.timeSeconds.toFixed(2)} / ${snap.durationSeconds.toFixed(2)}`
      root.querySelector('[data-action="playpause"]')!.textContent = snap.playing ? 'Pause' : 'Play'
    },
    updateVehicle(snap) {
      clipSelect.innerHTML = snap.clips.length
        ? snap.clips
            .map(
              (c, i) =>
                `<option value="${i}">${c.name} (${c.duration.toFixed(3)}s, ${c.trackCount} tracks)</option>`,
            )
            .join('')
        : `<option value="0">No clips</option>`
      clipSelect.value = String(snap.activeClipIndex)
      clipSelect.disabled = snap.clips.length === 0

      const actionsHost = root.querySelector('[data-semantic-actions]') as HTMLElement
      const actions = snap.semanticActions ?? []
      lastShotDoorActions = actions.map((a) => ({
        id: a.id,
        label: a.label,
        duration: a.clipDuration,
      }))
      if (editingShotId && !shotEditor?.contains(document.activeElement)) {
        fillShotEditor(
          lastShots.find((s) => s.id === editingShotId) ?? null,
          lastShotDoorActions,
        )
      }
      actionsHost.innerHTML = actions.length
        ? actions
            .map(
              (a) =>
                `<button type="button" class="as-btn as-btn--compact" data-semantic-id="${a.id}">${a.label}</button>`,
            )
            .join('')
        : `<span class="as-hint">Import a vehicle with clips to list actions.</span>`
      actionsHost.querySelectorAll('[data-semantic-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.semanticId
          if (id) options.onSemanticAction(id)
        })
      })

      // Refresh door-action options in hotspot editor if open
      if (editingHotspotId && !hotspotEditor.hidden) {
        const prev = hotspotDoorSelect.value
        hotspotDoorSelect.innerHTML =
          `<option value="">— none —</option>` +
          actions
            .map(
              (a) =>
                `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`,
            )
            .join('')
        if (prev) hotspotDoorSelect.value = prev
      }

      syncingQuality = true
      if (snap.variants.length) {
        activeQuality.disabled = false
        activeQuality.innerHTML = snap.variants
          .map((v) => {
            const label =
              v.role === 'vehicle-high'
                ? 'High'
                : v.role === 'vehicle-balanced'
                  ? 'Balanced'
                  : v.role === 'vehicle-mobile'
                    ? 'Mobile'
                    : 'Master'
            return `<option value="${v.role}">${label} — ${v.filename} (${formatBytes(v.byteSize)})</option>`
          })
          .join('')
        if (snap.activeQuality) activeQuality.value = snap.activeQuality
      } else {
        activeQuality.disabled = true
        activeQuality.innerHTML = `<option value="">Import High / Balanced / Mobile to switch</option>`
      }
      syncingQuality = false

      const r = snap.report
      if (!r) {
        reportEl.innerHTML = `<div><dt>Status</dt><dd>No vehicle imported</dd></div>`
        return
      }
      const rigLine = snap.rigBound
        ? 'Bound (wheel nodes present)'
        : snap.rigMissing.length
          ? `Incomplete — ${snap.rigMissing.join('; ')}`
          : 'None'
      reportEl.innerHTML = `
        <div><dt>File</dt><dd>${escapeHtml(r.filename)} · ${formatBytes(r.byteSize)}</dd></div>
        <div><dt>Quality</dt><dd>${escapeHtml(String(snap.activeQuality ?? '—'))} · ${snap.variants.length} slot(s)</dd></div>
        <div><dt>Geometry</dt><dd>${r.triangles.toLocaleString()} tris · ${r.meshes} meshes · ${r.nodes} nodes</dd></div>
        <div><dt>Materials</dt><dd>${r.materials} mats · ${r.textures} textures · max ${r.maxTextureResolution}px</dd></div>
        <div><dt>GPU textures (est.)</dt><dd>${formatGpuEstimate(r.estimatedDecodedTextureBytes)}</dd></div>
        <div><dt>Units guess</dt><dd>${escapeHtml(r.likelyUnits)} · bounds ${r.bounds.x.toFixed(1)}×${r.bounds.y.toFixed(1)}×${r.bounds.z.toFixed(1)}</dd></div>
        <div><dt>Animations</dt><dd>${
          r.animations.length
            ? r.animations
                .map(
                  (a) =>
                    `${escapeHtml(a.name)} ${a.duration.toFixed(3)}s / ${a.trackCount} tracks`,
                )
                .join('; ')
            : 'None'
        }</dd></div>
        <div><dt>Extensions</dt><dd>${
          r.extensions.length ? escapeHtml(r.extensions.join(', ')) : '—'
        }</dd></div>
        <div><dt>Measured</dt><dd>${
          snap.measured
            ? `L ${snap.measured.length.toFixed(2)}m · W ${snap.measured.width.toFixed(2)}m · H ${snap.measured.height.toFixed(2)}m`
            : '—'
        }</dd></div>
        <div><dt>Wheel rig</dt><dd>${escapeHtml(rigLine)}</dd></div>
        <div><dt>Warnings</dt><dd>${
          r.warnings.length ? escapeHtml(r.warnings.join(' ')) : 'None'
        }</dd></div>
      `
    },
    setClipTransport(time, duration, playing) {
      clipScrub.max = String(duration || 0)
      clipScrub.value = String(time)
      root.querySelector('[data-clip-time]')!.textContent =
        `${time.toFixed(2)} / ${duration.toFixed(2)}`
      root.querySelector('[data-action="clip-play"]')!.textContent = playing ? 'Pause clip' : 'Play clip'
    },
    setHotspotNodes(nodes: Array<{ name: string; path: string }>) {
      const select = root.querySelector('[data-hotspot-nodes]') as HTMLSelectElement
      const prev = select.value
      if (!nodes.length) {
        select.innerHTML = '<option value="">— load a vehicle first —</option>'
        return
      }
      select.innerHTML = nodes
        .map((n) => `<option value="${escapeHtml(n.name)}">${escapeHtml(n.name)}</option>`)
        .join('')
      if (prev && nodes.some((n) => n.name === prev)) select.value = prev
    },
    setShotEditor(shot, doorActions) {
      lastShotDoorActions = doorActions
      fillShotEditor(shot, doorActions)
    },
    setHotspotEditor(hotspot, doorActions, meta) {
      syncingHotspotEditor = true
      editingHotspotId = hotspot?.id ?? null
      if (!hotspot) {
        mountHotspotEditorIntoList(null)
        syncingHotspotEditor = false
        return
      }
      // Re-open the accordion row for this hotspot (list may already be rendered).
      mountHotspotEditorIntoList(hotspot.id)
      if (hotspotListHint) {
        hotspotListHint.textContent = `Editing · ${hotspot.name}`
      }
      const heading = root.querySelector('[data-hotspot-editor-heading]') as HTMLElement
      setGroupLabel(heading, `Edit · ${hotspot.name}`)
      const title =
        hotspot.blocks.find((b) => b.type === 'title')?.text ?? hotspot.name
      const body =
        hotspot.blocks.find((b) => b.type === 'richtext')?.markdown ?? ''
      hotspotTitleInput.value = title
      hotspotBodyInput.value = body
      const doorId =
        hotspot.actions.find((a) => a.type === 'action.play' || a.type === 'action.toggle')
      const selectedDoor =
        doorId && (doorId.type === 'action.play' || doorId.type === 'action.toggle')
          ? doorId.actionId
          : ''
      hotspotDoorSelect.innerHTML =
        `<option value="">— none —</option>` +
        doorActions
          .map(
            (a) =>
              `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`,
          )
          .join('')
      hotspotDoorSelect.value = selectedDoor
      if (selectedDoor && hotspotDoorSelect.value !== selectedDoor) {
        hotspotDoorSelect.innerHTML += `<option value="${escapeHtml(selectedDoor)}">${escapeHtml(selectedDoor)}</option>`
        hotspotDoorSelect.value = selectedDoor
      }
      if (hotspotDoorMode) {
        hotspotDoorMode.value =
          doorId && doorId.type === 'action.play' ? 'play' : 'toggle'
      }
      if (hotspotClipStart) {
        hotspotClipStart.value =
          doorId &&
          (doorId.type === 'action.play' || doorId.type === 'action.toggle') &&
          doorId.startSeconds != null
            ? String(doorId.startSeconds)
            : ''
      }
      if (hotspotClipEnd) {
        hotspotClipEnd.value =
          doorId &&
          (doorId.type === 'action.play' || doorId.type === 'action.toggle') &&
          doorId.endSeconds != null
            ? String(doorId.endSeconds)
            : ''
      }
      const clipDur = doorActions.find((a) => a.id === selectedDoor)?.duration
      if (hotspotClipHint) {
        hotspotClipHint.textContent =
          clipDur != null && clipDur > 0
            ? `Clip is ${clipDur.toFixed(2)}s — skip empty lead-in (e.g. start 1.2). Leave end empty for full clip.`
            : 'Skip empty lead-in — e.g. start at 1.2 if the door only moves after that.'
      }
      const meshAction = hotspot.actions.find(
        (a) => a.type === 'mesh.setVisible' || a.type === 'mesh.toggleVisible',
      )
      const meshKey =
        meshAction && (meshAction.type === 'mesh.setVisible' || meshAction.type === 'mesh.toggleVisible')
          ? encodeHotspotMeshKey(meshAction.node)
          : ''
      const meshMode =
        meshAction?.type === 'mesh.toggleVisible'
          ? 'toggle'
          : meshAction?.type === 'mesh.setVisible'
            ? meshAction.visible
              ? 'show'
              : 'hide'
            : 'hide'
      const meshOptions = meta?.meshOptions ?? []
      if (hotspotMeshNode) {
        hotspotMeshNode.innerHTML =
          `<option value="">— none —</option>` +
          meshOptions
            .map(
              (m) =>
                `<option value="${escapeAttr(m.key)}">${escapeHtml(m.label)}</option>`,
            )
            .join('')
        if (meshKey && !meshOptions.some((m) => m.key === meshKey)) {
          const orphan =
            meshAction &&
            (meshAction.type === 'mesh.setVisible' || meshAction.type === 'mesh.toggleVisible')
              ? meshAction.node.name || meshAction.node.path || meshKey
              : meshKey
          hotspotMeshNode.innerHTML += `<option value="${escapeAttr(meshKey)}">${escapeHtml(orphan)}</option>`
        }
        hotspotMeshNode.value = meshKey
        hotspotMeshNode.dataset.selectedObjectKey = meta?.selectedObjectKey || ''
      }
      if (hotspotMeshMode) hotspotMeshMode.value = meshMode
      const rot = hotspot.markerRotationDeg ?? [0, 0, 0]
      if (hotspotRotX) hotspotRotX.value = String(rot[0] ?? 0)
      if (hotspotRotY) hotspotRotY.value = String(rot[1] ?? 0)
      if (hotspotRotZ) hotspotRotZ.value = String(rot[2] ?? 0)
      if (hotspotRotXVal) setSliderVal(hotspotRotXVal, Math.round(rot[0] ?? 0))
      if (hotspotRotYVal) setSliderVal(hotspotRotYVal, Math.round(rot[1] ?? 0))
      if (hotspotRotZVal) setSliderVal(hotspotRotZVal, Math.round(rot[2] ?? 0))
      const labelScale = hotspot.markerLabelScale ?? 1
      const labelOff = hotspot.markerLabelOffset ?? [0, 2.4, 0.04]
      if (hotspotLabelScale) hotspotLabelScale.value = String(labelScale)
      if (hotspotLabelOx) hotspotLabelOx.value = String(labelOff[0] ?? 0)
      if (hotspotLabelOy) hotspotLabelOy.value = String(labelOff[1] ?? 2.4)
      if (hotspotLabelOz) hotspotLabelOz.value = String(labelOff[2] ?? 0.04)
      setSliderVal(hotspotLabelScaleVal, Number(labelScale))
      setSliderVal(hotspotLabelOxVal, Number(labelOff[0] ?? 0))
      setSliderVal(hotspotLabelOyVal, Number(labelOff[1] ?? 2.4))
      setSliderVal(hotspotLabelOzVal, Number(labelOff[2] ?? 0.04))
      const video = hotspot.blocks.find((b) => b.type === 'video')
      hotspotVideoLabel.textContent =
        video && video.type === 'video'
          ? meta?.videoLabel
            ? `Video: ${meta.videoLabel}`
            : 'Video attached.'
          : 'No video attached.'
      syncingHotspotEditor = false
    },
    updateObjectTree(nodes, selectedId) {
      if (!objectSelect && !matObjectSelect) return
      lastObjectTreeNodes = nodes
      lastObjectTreeSelectedId = selectedId
      objectNodesById = new Map(nodes.map((n) => [n.id, n]))
      syncingObjectSelect = true

      const hiddenSelf = nodes.filter((n) => !n.visible).length
      const hiddenEffective = nodes.filter((n) => !n.effectiveVisible).length

      const fillSelect = (select: HTMLSelectElement | null, emptyLabel: string) => {
        if (!select) return
        if (!nodes.length) {
          select.innerHTML = `<option value="">${emptyLabel}</option>`
          select.disabled = true
          return
        }
        select.disabled = false
        const meshes = nodes.filter((n) => n.mesh)
        const groups = nodes.filter((n) => !n.mesh)
        const meshHidden = meshes.filter((n) => !n.effectiveVisible).length
        const groupHidden = groups.filter((n) => !n.effectiveVisible).length
        const meshOpts = meshes
          .map((node) => {
            const label = formatObjectOptionLabel(node, false)
            return `<option value="${escapeAttr(node.id)}">${escapeHtml(label)}</option>`
          })
          .join('')
        const groupOpts = groups
          .map((node) => {
            const label = formatObjectOptionLabel(node, true)
            return `<option value="${escapeAttr(node.id)}">${escapeHtml(label)}</option>`
          })
          .join('')
        const meshLabel =
          meshHidden > 0
            ? `Meshes (${meshes.length} · ${meshHidden} off)`
            : `Meshes (${meshes.length})`
        const groupLabel =
          groupHidden > 0
            ? `Groups / nodes (${groups.length} · ${groupHidden} off)`
            : `Groups / nodes (${groups.length})`
        select.innerHTML =
          `<option value="">— none (deselect) —</option>` +
          (meshes.length ? `<optgroup label="${escapeAttr(meshLabel)}">${meshOpts}</optgroup>` : '') +
          (groups.length ? `<optgroup label="${escapeAttr(groupLabel)}">${groupOpts}</optgroup>` : '')
        if (selectedId && objectNodesById.has(selectedId)) {
          select.value = selectedId
        } else if (selectedId) {
          const opt = document.createElement('option')
          opt.value = selectedId
          opt.textContent = '(current selection)'
          select.appendChild(opt)
          select.value = selectedId
        } else {
          select.value = ''
        }
      }

      if (!nodes.length) {
        fillSelect(objectSelect, '— import a vehicle first —')
        fillSelect(matObjectSelect, '— import a vehicle first —')
        objectVisible.checked = true
        objectVisible.disabled = true
        objectDeselect.disabled = true
        objectMeta.hidden = true
        if (matObjectMeta) matObjectMeta.hidden = true
        if (objectMaterialPanel) objectMaterialPanel.hidden = true
        if (matEmpty) matEmpty.hidden = false
        if (objectTree) {
          objectTree.hidden = true
          objectTree.innerHTML = ''
        }
        if (objectHiddenSummary) objectHiddenSummary.hidden = true
        if (objectFilterHidden) objectFilterHidden.disabled = true
        syncingObjectSelect = false
        return
      }
      fillSelect(objectSelect, '— none —')
      fillSelect(matObjectSelect, '— select in Objects or pick —')
      if (objectFilterHidden) objectFilterHidden.disabled = false
      const selected = selectedId ? objectNodesById.get(selectedId) : null
      objectDeselect.disabled = !selectedId
      const metaText = selected
        ? [
            selected.mesh ? 'Mesh' : selected.type,
            `depth ${selected.depth}`,
            !selected.visible
              ? 'turned off'
              : !selected.effectiveVisible
                ? 'hidden by parent'
                : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : selectedId
          ? 'Selected in viewport'
          : ''
      if (selected || selectedId) {
        objectVisible.disabled = false
        if (selected) objectVisible.checked = selected.visible
        objectMeta.hidden = false
        objectMeta.textContent = metaText
        if (matObjectMeta) {
          matObjectMeta.hidden = false
          matObjectMeta.textContent = metaText
        }
      } else {
        objectVisible.checked = true
        objectVisible.disabled = true
        objectMeta.hidden = true
        if (matObjectMeta) matObjectMeta.hidden = true
      }

      if (objectHiddenSummary) {
        if (hiddenEffective > 0) {
          objectHiddenSummary.hidden = false
          objectHiddenSummary.textContent =
            hiddenSelf === hiddenEffective
              ? `${hiddenSelf} object${hiddenSelf === 1 ? '' : 's'} turned off — marked [off] in the list.`
              : `${hiddenEffective} not drawing (${hiddenSelf} turned off, ${hiddenEffective - hiddenSelf} under a hidden parent).`
        } else {
          objectHiddenSummary.hidden = true
          objectHiddenSummary.textContent = ''
        }
      }
      renderObjectVisibilityTree(nodes, selectedId)
      syncingObjectSelect = false
    },
    updateObjectMaterial(state, slots, selectedSlot = 0, mapContext) {
      if (!objectMaterialPanel) return
      if (!state) {
        objectMaterialPanel.hidden = true
        if (matEmpty) matEmpty.hidden = false
        return
      }
      objectMaterialPanel.hidden = false
      if (matEmpty) matEmpty.hidden = true
      matSlot.innerHTML = slots
        .map((s) => `<option value="${s.index}">${escapeHtml(s.name)}</option>`)
        .join('')
      const slotValue = String(
        slots.some((s) => s.index === selectedSlot) ? selectedSlot : (slots[0]?.index ?? 0),
      )
      matSlot.value = slotValue
      matName.textContent = state.name
      matColor.value = state.color
      matMetal.value = String(state.metalness)
      setSliderVal(matMetalVal, state.metalness)
      matRough.value = String(state.roughness)
      setSliderVal(matRoughVal, state.roughness)
      matEmissive.value = state.emissive
      matEmi.value = String(state.emissiveIntensity)
      setSliderVal(matEmiVal, state.emissiveIntensity)
      matOpacity.value = String(state.opacity)
      setSliderVal(matOpacityVal, state.opacity)
      matTransparent.checked = state.transparent
      matEnv.value = String(state.envMapIntensity)
      setSliderVal(matEnvVal, state.envMapIntensity)
      matPhysical.hidden = !state.hasPhysical
      if (state.hasPhysical) {
        matCc.value = String(state.clearcoat)
        setSliderVal(matCcVal, state.clearcoat)
        matCcr.value = String(state.clearcoatRoughness)
        setSliderVal(matCcrVal, state.clearcoatRoughness)
        matTrans.value = String(state.transmission)
        setSliderVal(matTransVal, state.transmission)
      }
      if (matMapRepeat) {
        const tiles = Math.max(0.0625, Math.min(1024, state.mapRepeat || 1))
        matMapRepeat.value = String(Math.log2(tiles))
        if (matMapRepeatVal) {
          matMapRepeatVal.textContent =
            tiles < 10 ? `${tiles.toFixed(2)}×` : `${Math.round(tiles)}×`
        }
      }
      if (matMapTriplanar) {
        matMapTriplanar.checked = state.mapProjection === 'triplanar'
      }
      if (matMapVary) {
        const v = Math.max(0, Math.min(1, state.mapTriVariation ?? 0.25))
        matMapVary.value = String(v)
        setSliderVal(matMapVaryVal, v)
      }
      syncMatMapSlots(
        root,
        mapContext?.overrideMaps ?? {},
        mapContext?.assets ?? [],
        mapContext?.liveMaps ?? [],
      )
    },
    updateMaterialList(items, selectedKey) {
      if (!matList) return
      if (!items.length) {
        matList.innerHTML = '<option value="">— import a vehicle first —</option>'
        matList.disabled = true
        return
      }
      matList.disabled = false
      matList.innerHTML =
        `<option value="">— pick a material (${items.length}) —</option>` +
        items
          .map((item) => {
            const value = `${escapeAttr(item.meshId)}::${item.slot}`
            const label = `${item.name} · ${item.meshName}`
            return `<option value="${value}">${escapeHtml(label)}</option>`
          })
          .join('')
      if (selectedKey) matList.value = selectedKey
    },
    updateVehicleLightCounts(counts) {
      for (const [id, n] of Object.entries(counts)) {
        const el = root.querySelector(`[data-vlight-count="${id}"]`)
        if (el) el.textContent = n > 0 ? `(${n})` : ''
      }
    },
    updateVehicleLightBindings(rows) {
      if (!vlightBindings) return
      if (!rows.length) {
        vlightBindings.innerHTML = '<li>No lamp meshes bound yet.</li>'
        return
      }
      vlightBindings.innerHTML = rows
        .map(
          (r) =>
            `<li><strong>${escapeHtml(r.groupId)}</strong> · ${escapeHtml(r.meshName)} / ${escapeHtml(r.materialName)}${r.manual ? ' · manual' : ' · auto'}</li>`,
        )
        .join('')
    },
    updateBeamList(beams, selectedId) {
      if (!vlightBeamSelect) return
      if (!beams.length) {
        vlightBeamSelect.innerHTML = '<option value="">— turn on a beam group first —</option>'
        return
      }
      const fmt3 = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3)
      const groupLabel: Record<string, string> = {
        drl: 'DRL',
        lowBeam: 'Low beam',
        highBeam: 'High beam',
        reverse: 'Reverse',
      }
      const groupsOn = new Set(
        [...root.querySelectorAll<HTMLInputElement>('[data-vlight]')]
          .filter((el) => el.checked)
          .map((el) => el.getAttribute('data-vlight') || ''),
      )
      const perGroup = new Map<string, number>()
      vlightBeamSelect.innerHTML = beams
        .map((b) => {
          const n = (perGroup.get(b.groupId) ?? 0) + 1
          perGroup.set(b.groupId, n)
          const lit = groupsOn.has(b.groupId) ? '● ' : '○ '
          const name = groupLabel[b.groupId] ?? b.groupId
          const label = `${lit}${name} #${n}  (${fmt3(b.position.x)}, ${fmt3(b.position.y)}, ${fmt3(b.position.z)})`
          return `<option value="${escapeAttr(b.id)}">${escapeHtml(label)}</option>`
        })
        .join('')
      const pick = selectedId && beams.some((b) => b.id === selectedId) ? selectedId : beams[0].id
      vlightBeamSelect.value = pick
    },
    setBeamCoordsText(text) {
      if (vlightBeamCoords) vlightBeamCoords.textContent = text
    },
    setRendererInfo(renderer) {
      root.querySelector('[data-backend]')!.textContent = renderer.backend
      badge.textContent = renderer.probe.note
      const hint = root.querySelector('[data-bloom-hint]') as HTMLElement | null
      if (hint) {
        hint.textContent = renderer.bloomSupported
          ? 'Selective bloom (WebGL2) — only lit vehicle lamps glow. Sun/moon stay sharp.'
          : 'Bloom composer is WebGL2-only; current backend renders without the bloom pass.'
      }
    },
    setModeLabel(mode) {
      root.querySelector('[data-mode]')!.textContent = mode
    },
    setStatus(message, warn = false) {
      statusEl.textContent = message
      statusEl.classList.toggle('as-status--warn', warn)
    },
    setUiTheme: setUiThemeLocal,
    setImportProgress(ratio, label) {
      progressEl.hidden = false
      progressEl.textContent = `${Math.round(ratio * 100)}% — ${label}`
      if (ratio >= 1) {
        window.setTimeout(() => {
          progressEl.hidden = true
        }, 1200)
      }
    },
    setOrbitEnabled(enabled) {
      const btn = root.querySelector('[data-action="orbit"]') as HTMLButtonElement | null
      if (!btn) return
      btn.setAttribute('aria-pressed', String(enabled))
      btn.textContent = enabled ? 'Free camera: on' : 'Free camera'
      btn.classList.toggle('as-btn--accent', enabled)
    },
    setChaseCameraEnabled(enabled) {
      routeChase.checked = enabled
    },
    setChaseOrbit(orbit) {
      lastChaseLookSide = orbit.lookSide ?? 0
      chaseYaw.value = String(Math.round(orbit.yawDeg))
      chasePitch.value = String(Math.round(orbit.pitchDeg))
      chaseDist.value = String(Number(orbit.distance.toFixed(1)))
      chaseTarget.value = String(Number((orbit.lookAhead ?? 1).toFixed(2)))
      syncChaseLabels()
      root.querySelectorAll('[data-chase-preset]').forEach((btn) => {
        const key = (btn as HTMLElement).dataset.chasePreset
        const preset = key ? CHASE_ORBIT_PRESET_LOOKUP[key] : null
        const active =
          preset != null &&
          Math.abs(preset.yawDeg - orbit.yawDeg) < 1.5 &&
          Math.abs(preset.pitchDeg - orbit.pitchDeg) < 1.5 &&
          Math.abs(preset.distance - orbit.distance) < 0.35
        ;(btn as HTMLButtonElement).setAttribute('aria-pressed', active ? 'true' : 'false')
        btn.classList.toggle('is-active', active)
      })
    },
    setRouteEditEnabled(enabled) {
      routeEdit.checked = enabled
    },
    setFreeDriveEnabled(enabled) {
      if (freeDrive) freeDrive.checked = enabled
      drivePad.hidden = !enabled
      if (!enabled) {
        for (const pointerId of [...drivePadHeld.keys()]) releaseDrivePadPointer(pointerId)
        drivePad.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'))
      }
    },
    setDrivePadPressed(codes: Iterable<string>) {
      const active = new Set(codes)
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const) {
        setDrivePadBtnActive(code, active.has(code))
      }
    },
    setChaseLockedForFreeDrive(locked) {
      if (!routeChase) return
      if (locked) {
        routeChase.checked = true
        routeChase.disabled = true
      } else {
        routeChase.disabled = false
      }
    },
    updateRouteStats(stats) {
      if (document.activeElement !== routeSpeed) {
        routeSpeed.value = String(Math.round(stats.speedKmh || 18))
        setSliderVal(root.querySelector('[data-route-speed-val]'), Number(routeSpeed.value))
      }
      if (stats.tireRollRate != null && document.activeElement !== routeRollRate) {
        routeRollRate.value = String(stats.tireRollRate)
        setSliderVal(root.querySelector('[data-route-roll-rate-val]'), stats.tireRollRate)
      }
      if (stats.maxSteerDeg != null && document.activeElement !== routeSteer) {
        routeSteer.value = String(Math.round(stats.maxSteerDeg))
        setSliderVal(root.querySelector('[data-route-steer-val]'), Number(routeSteer.value))
      }
      if (stats.maxBodyRollDeg != null && document.activeElement !== routeBodyRoll) {
        routeBodyRoll.value = String(stats.maxBodyRollDeg)
        setSliderVal(root.querySelector('[data-route-body-roll-val]'), Number(routeBodyRoll.value))
      }
      if (stats.ovalScale != null && document.activeElement !== routeOval) {
        routeOval.value = String(stats.ovalScale)
        setSliderVal(root.querySelector('[data-route-oval-val]'), stats.ovalScale)
      }
      if (stats.openScale != null && document.activeElement !== routeOpen) {
        routeOpen.value = String(stats.openScale)
        setSliderVal(root.querySelector('[data-route-open-val]'), stats.openScale)
      }
      // Oval size only for closed demo ovals; open size only for open demo paths.
      const showOvalSize = Boolean(stats.enabled && stats.closed && stats.ovalScale != null)
      const showOpenSize = Boolean(stats.enabled && stats.closed === false && stats.openScale != null)
      ovalSizeBlock.hidden = !showOvalSize
      openSizeBlock.hidden = !showOpenSize
      if (stats.accelMps2 != null && document.activeElement !== routeAccel) {
        routeAccel.value = String(stats.accelMps2)
        setSliderVal(root.querySelector('[data-route-accel-val]'), stats.accelMps2)
      }
      if (stats.brakeMps2 != null && document.activeElement !== routeBrake) {
        routeBrake.value = String(stats.brakeMps2)
        setSliderVal(root.querySelector('[data-route-brake-val]'), stats.brakeMps2)
      }
      if (stats.startAccelMps2 != null && document.activeElement !== routeStartAccel) {
        routeStartAccel.value = String(stats.startAccelMps2)
        setSliderVal(root.querySelector('[data-route-start-accel-val]'), stats.startAccelMps2)
      }
      if (stats.endStopMps2 != null && document.activeElement !== routeEndStop) {
        routeEndStop.value = String(stats.endStopMps2)
        setSliderVal(root.querySelector('[data-route-end-stop-val]'), stats.endStopMps2)
      }
      if (stats.closed != null) routeClosed.checked = stats.closed
      if (stats.direction != null) routeReverse.checked = stats.direction < 0
      if (stats.editing != null) routeEdit.checked = stats.editing
      if (stats.freeDrive) {
        const throttle =
          stats.throttle != null
            ? stats.throttle > 0.05
              ? 'throttle'
              : stats.throttle < -0.05
                ? 'reverse'
                : 'coast'
            : '—'
        routeStats.innerHTML = `
          <div><dt>Status</dt><dd>Free drive · WASD · infinite floor</dd></div>
          <div><dt>Speed</dt><dd>${(stats.velocityKmh ?? 0).toFixed(1)} / ${stats.speedKmh.toFixed(0)} km/h</dd></div>
          <div><dt>Travelled</dt><dd>${stats.distanceMetres.toFixed(1)} m</dd></div>
          <div><dt>Input</dt><dd>${throttle} · steer ${(stats.steerDeg ?? 0).toFixed(0)}°</dd></div>
          <div><dt>Wheels</dt><dd>${stats.bindingCount ?? 0} bound${stats.calibration ? ` · ${escapeHtml(stats.calibration)}` : ''}</dd></div>
        `
        return
      }
      if (!stats.enabled) {
        routeStats.innerHTML = `<div><dt>Status</dt><dd>No route</dd></div>`
        return
      }
      const shape =
        stats.closed === false
          ? stats.openScale != null
            ? `Open ${stats.openScale.toFixed(2)}×`
            : `Open · ${stats.waypointCount ?? 0} pts`
          : stats.ovalScale != null
            ? `Oval ${stats.ovalScale.toFixed(2)}×`
            : `Custom · ${stats.waypointCount ?? 0} pts`
      const loopLabel = stats.closed === false ? 'open' : 'closed'
      const dir = (stats.direction ?? 1) < 0 ? 'reverse' : 'forward'
      routeStats.innerHTML = `
        <div><dt>Status</dt><dd>${shape} · ${loopLabel}${stats.editing ? ' · editing' : ''} · ${dir}</dd></div>
        <div><dt>Length</dt><dd>${stats.lengthMetres.toFixed(1)} m</dd></div>
        <div><dt>Extent</dt><dd>${(stats.extentMetres ?? 0).toFixed(1)} m radius</dd></div>
        <div><dt>Travelled</dt><dd>${stats.distanceMetres.toFixed(1)} m</dd></div>
        <div><dt>Speed</dt><dd>${(stats.velocityKmh ?? 0).toFixed(0)} / ${stats.speedKmh.toFixed(0)} km/h</dd></div>
        <div><dt>Accel / brake</dt><dd>${(stats.accelMps2 ?? 0).toFixed(1)} / ${(stats.brakeMps2 ?? 0).toFixed(1)} m/s²</dd></div>
        <div><dt>Open start / end</dt><dd>${(stats.startAccelMps2 ?? 0).toFixed(1)} / ${(stats.endStopMps2 ?? 0).toFixed(1)} m/s²</dd></div>
        <div><dt>Roll pivots</dt><dd>${stats.bindingCount}</dd></div>
        <div><dt>Heading fix</dt><dd>${
          stats.yawOffsetDeg != null ? `${stats.yawOffsetDeg.toFixed(1)}°` : '—'
        } · ${stats.alignmentSource ?? '—'}</dd></div>
        <div><dt>Tire roll</dt><dd>${(stats.tireRollRate ?? 1).toFixed(2)}× · r=${
          stats.radiusMetres != null && stats.radiusMetres > 0
            ? `${stats.radiusMetres.toFixed(3)} m`
            : '—'
        }${
          stats.tireRollRate != null &&
          Math.abs(stats.tireRollRate - 1) > 0.01 &&
          stats.effectiveRadiusMetres
            ? ` (as if ${stats.effectiveRadiusMetres.toFixed(3)} m)`
            : ''
        }</dd></div>
        <div><dt>Front steer</dt><dd>${(stats.steerDeg ?? 0).toFixed(1)}° of ${(
          stats.maxSteerDeg ?? 35
        ).toFixed(0)}° lock</dd></div>
        <div><dt>Body lean</dt><dd>${(stats.bodyRollDeg ?? 0).toFixed(1)}° of ${(
          stats.maxBodyRollDeg ?? 3.5
        ).toFixed(1)}°</dd></div>
        <div><dt>Wheelbase</dt><dd>${
          stats.wheelbaseMetres ? `${stats.wheelbaseMetres.toFixed(2)} m` : '—'
        }</dd></div>
        <div><dt>5-lap check</dt><dd>${stats.stress ?? 'not run'}</dd></div>
        <div><dt>Axle calibration</dt><dd>${stats.calibration || 'pending — press Play'}</dd></div>
      `
    },
  }
}

function mapLabel(map: string): string {
  switch (map) {
    case 'map':
      return 'Albedo'
    case 'normal':
      return 'Normal'
    case 'roughness':
      return 'Rough'
    case 'metalness':
      return 'Metal'
    case 'displacement':
      return 'Depth'
    case 'ao':
      return 'AO'
    case 'emissive':
      return 'Emit map'
    default:
      return map
  }
}

function stageMapAssetId(maps: StageSurfaceMaps, map: string): string | null | undefined {
  switch (map) {
    case 'map':
      return maps.mapAssetId
    case 'normal':
      return maps.normalMapAssetId
    case 'roughness':
      return maps.roughnessMapAssetId
    case 'metalness':
      return maps.metalnessMapAssetId
    case 'displacement':
      return maps.displacementMapAssetId
    case 'ao':
      return maps.aoMapAssetId
    case 'emissive':
      return maps.emissiveMapAssetId
    default:
      return null
  }
}

function syncStageMapSlots(
  root: ParentNode,
  surface: 'floor' | 'pedestal' | 'cyclorama',
  maps: StageSurfaceMaps,
  assets: AssetRecord[],
) {
  const kinds = ['map', 'normal', 'roughness', 'metalness', 'displacement', 'ao', 'emissive'] as const
  for (const map of kinds) {
    const token = `${surface}:${map}`
    const slot = root.querySelector(`[data-stage-map-slot="${token}"]`) as HTMLElement | null
    const label = root.querySelector(`[data-stage-map-file-label="${token}"]`) as HTMLElement | null
    const remove = root.querySelector(`[data-stage-map-remove="${token}"]`) as HTMLButtonElement | null
    const assignBtn = root.querySelector(`[data-stage-map="${token}"]`) as HTMLButtonElement | null
    const assetId = stageMapAssetId(maps, map)
    const asset = assetId ? assets.find((a) => a.id === assetId) : null
    const set = Boolean(assetId)
    slot?.classList.toggle('as-map-slot--set', set)
    if (label) {
      label.textContent = set ? asset?.filename || 'Assigned' : 'None'
      label.title = set ? asset?.filename || assetId || '' : 'No texture assigned'
    }
    if (remove) remove.hidden = !set
    if (assignBtn) {
      assignBtn.title = set
        ? `${mapLabel(map)}: ${asset?.filename || 'assigned'} — click to replace`
        : `Assign ${mapLabel(map)} texture`
      assignBtn.setAttribute('aria-pressed', set ? 'true' : 'false')
    }

    let previewBtn = slot?.querySelector(
      `[data-stage-map-preview="${token}"]`,
    ) as HTMLButtonElement | null
    if (slot && !previewBtn) {
      previewBtn = document.createElement('button')
      previewBtn.type = 'button'
      previewBtn.className = 'as-map-preview'
      previewBtn.dataset.stageMapPreview = token
      previewBtn.hidden = true
      previewBtn.innerHTML = '<img alt="" />'
      slot.insertBefore(previewBtn, slot.firstChild)
    }
    const previewImg = previewBtn?.querySelector('img') as HTMLImageElement | null
    if (!previewBtn || !previewImg) continue
    if (!set || !assetId) {
      const prevId = previewBtn.dataset.assetId
      if (prevId) {
        void import('../stage/stageMapPreviews').then(({ revokeStageMapPreview }) => {
          revokeStageMapPreview(prevId)
        })
      }
      previewBtn.hidden = true
      previewImg.removeAttribute('src')
      previewBtn.title = ''
      delete previewBtn.dataset.assetId
      continue
    }
    const prevId = previewBtn.dataset.assetId
    if (prevId && prevId !== assetId) {
      void import('../stage/stageMapPreviews').then(({ revokeStageMapPreview }) => {
        revokeStageMapPreview(prevId)
      })
    }
    previewBtn.hidden = false
    previewBtn.title = `${mapLabel(map)} · ${asset?.filename || 'texture'} — click to enlarge`
    previewImg.alt = asset?.filename || mapLabel(map)
    const gen = Number(previewBtn.dataset.previewGen || '0') + 1
    previewBtn.dataset.previewGen = String(gen)
    previewBtn.dataset.assetId = assetId
    void import('../stage/stageMapPreviews').then(async ({ getStageMapPreviewUrl }) => {
      if (previewBtn.dataset.previewGen !== String(gen)) return
      const url = await getStageMapPreviewUrl(assetId)
      if (previewBtn.dataset.previewGen !== String(gen)) return
      if (url) previewImg.src = url
      else {
        previewBtn.hidden = true
        previewImg.removeAttribute('src')
      }
    })
  }
}

function syncMatMapSlots(
  root: ParentNode,
  maps: StageSurfaceMaps,
  assets: AssetRecord[],
  liveMaps: MaterialLiveMapSlot[],
) {
  const kinds = ['map', 'normal', 'roughness', 'metalness', 'displacement', 'ao', 'emissive'] as const
  const liveByKey = new Map(liveMaps.map((m) => [m.key, m]))
  for (const map of kinds) {
    const slot = root.querySelector(`[data-mat-map-slot="${map}"]`) as HTMLElement | null
    const label = root.querySelector(`[data-mat-map-file-label="${map}"]`) as HTMLElement | null
    const remove = root.querySelector(`[data-mat-map-remove="${map}"]`) as HTMLButtonElement | null
    const assignBtn = root.querySelector(`[data-mat-map="${map}"]`) as HTMLButtonElement | null
    const assetId = stageMapAssetId(maps, map)
    const asset = assetId ? assets.find((a) => a.id === assetId) : null
    const live = liveByKey.get(map)
    const cleared = assetId === null && Object.prototype.hasOwnProperty.call(maps, mapKeyForSlot(map))
    const set = Boolean(assetId) || (!cleared && Boolean(live?.hasTexture))
    const displayName = assetId
      ? asset?.filename || 'Uploaded'
      : live?.hasTexture
        ? 'From GLB'
        : 'None'
    slot?.classList.toggle('as-map-slot--set', set)
    if (label) {
      label.textContent = displayName
      label.title = assetId
        ? asset?.filename || assetId
        : live?.hasTexture
          ? 'Texture embedded in the vehicle GLB'
          : 'No texture assigned'
    }
    if (remove) remove.hidden = !set
    if (assignBtn) {
      assignBtn.title = set
        ? `${mapLabel(map)}: ${displayName} — click to replace`
        : `Assign ${mapLabel(map)} texture`
      assignBtn.setAttribute('aria-pressed', set ? 'true' : 'false')
    }

    let previewBtn = slot?.querySelector(
      `[data-mat-map-preview="${map}"]`,
    ) as HTMLButtonElement | null
    if (slot && !previewBtn) {
      previewBtn = document.createElement('button')
      previewBtn.type = 'button'
      previewBtn.className = 'as-map-preview'
      previewBtn.dataset.matMapPreview = map
      previewBtn.hidden = true
      previewBtn.innerHTML = '<img alt="" />'
      slot.insertBefore(previewBtn, slot.firstChild)
    }
    const previewImg = previewBtn?.querySelector('img') as HTMLImageElement | null
    if (!previewBtn || !previewImg) continue
    if (!set) {
      previewBtn.hidden = true
      previewImg.removeAttribute('src')
      previewBtn.title = ''
      continue
    }
    previewBtn.hidden = false
    previewBtn.title = `${mapLabel(map)} · ${displayName} — click to enlarge`
    previewImg.alt = displayName
    const gen = Number(previewBtn.dataset.previewGen || '0') + 1
    previewBtn.dataset.previewGen = String(gen)
    if (assetId) {
      previewBtn.dataset.assetId = assetId
      void import('../stage/stageMapPreviews').then(async ({ getStageMapPreviewUrl }) => {
        if (previewBtn.dataset.previewGen !== String(gen)) return
        const url = await getStageMapPreviewUrl(assetId)
        if (previewBtn.dataset.previewGen !== String(gen)) return
        if (url) previewImg.src = url
        else {
          previewBtn.hidden = true
          previewImg.removeAttribute('src')
        }
      })
    } else if (live?.previewUrl) {
      previewImg.src = live.previewUrl
    } else {
      previewBtn.hidden = true
      previewImg.removeAttribute('src')
    }
  }
}

function mapKeyForSlot(
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

function formatObjectOptionLabel(node: ObjectTreeNode, includeType: boolean): string {
  const indent = '· '.repeat(Math.min(node.depth, 8))
  const mark = !node.visible ? '[off] ' : !node.effectiveVisible ? '[···] ' : ''
  const type = includeType ? ` (${node.type})` : ''
  return `${indent}${mark}${node.name}${type}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]!)
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;')
}
