import type {
  AccentLightState,
  EnvironmentState,
  ExperienceMode,
  Hotspot,
  StageState,
  UiChromeTheme,
  VehicleLightGroupId,
  VehicleLightsState,
} from '../persistence/schema'
import type { StoreSnapshot } from '../persistence/projectStore'
import type { TransportSnapshot } from '../transport/transport'
import type { StudioRenderer } from '../renderer/createRenderer'
import type { VehicleSessionSnapshot } from '../vehicle/vehicleSession'
import { setGroupLabel, setupCollapsibleGroups } from './collapsibleGroups'
import { setupInspectorResize } from './inspectorResize'
import type { MaterialEditState, ObjectTreeNode } from '../vehicle/objectInspector'
import { formatBytes } from '../assets/importGlb'
import { formatGpuEstimate } from '../assets/analyzeAsset'
import { CHASE_ORBIT_PRESETS } from '../route/chaseCamera'

const CHASE_ORBIT_PRESET_LOOKUP = CHASE_ORBIT_PRESETS as Record<
  string,
  { yawDeg: number; pitchDeg: number; distance: number }
>

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
  onTargetLength: (metres: number | null) => void
  onFlip180: () => void
  onGroundOffset: (metres: number) => void
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
  onHotspotTitle: (id: string, title: string) => void
  onHotspotBody: (id: string, body: string) => void
  onHotspotDoorAction: (id: string, actionId: string | null) => void
  onHotspotVideo: (id: string, file: File) => void
  onHotspotClearVideo: (id: string) => void
  onHotspotTest: (id: string) => void
  onCaptureShot: () => void
  onGoToShot: (id: string) => void
  onDeleteShot: (id: string) => void
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
  }) => void
  onVehicleLightAssignSelected: (groupId: VehicleLightGroupId) => void
  onVehicleLightClearGroup: (groupId: VehicleLightGroupId) => void
  onVehicleLightClearAllTargets: () => void
  onVehicleLightSequence: (sequenceId: 'welcome' | 'farewell') => void
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
  onObjectSelect: (id: string | null) => void
  onObjectVisible: (id: string, visible: boolean) => void
  onObjectPickMode: (enabled: boolean) => void
  onObjectMaterialIndex: (index: number) => void
  onObjectMaterialPatch: (patch: Record<string, unknown>) => void
  /** Commit current material edit into the project (Undo/reload). */
  onObjectMaterialCommit: () => void
  onVehiclePolishMode: (mode: 'auto' | 'off') => void
  onMaterialPick: (meshId: string, slot: number) => void
}

export function mountStudioShell(
  root: HTMLElement,
  options: StudioShellOptions,
): {
  viewportHost: HTMLElement
  updateStore: (snap: StoreSnapshot) => void
  updateTransport: (snap: TransportSnapshot) => void
  updateVehicle: (snap: VehicleSessionSnapshot) => void
  setClipTransport: (time: number, duration: number, playing: boolean) => void
  setHotspotNodes: (nodes: Array<{ name: string; path: string }>) => void
  setHotspotEditor: (
    hotspot: Hotspot | null,
    doorActions: Array<{ id: string; label: string }>,
    meta?: { videoLabel?: string | null },
  ) => void
  updateObjectTree: (nodes: ObjectTreeNode[], selectedId: string | null) => void
  updateObjectMaterial: (
    state: MaterialEditState | null,
    slots: Array<{ index: number; name: string }>,
    selectedSlot?: number,
  ) => void
  updateMaterialList: (
    items: Array<{ key: string; name: string; meshId: string; meshName: string; slot: number }>,
    selectedKey: string | null,
  ) => void
  updateVehicleLightCounts: (counts: Record<VehicleLightGroupId, number>) => void
  updateVehicleLightBindings: (
    rows: Array<{ groupId: VehicleLightGroupId; meshName: string; materialName: string; manual: boolean }>,
  ) => void
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
          <input id="as-ground" data-ground type="range" min="-0.5" max="0.5" step="0.01" value="0" />
        </div>

        <h3 class="as-subhead">Animation</h3>
        <div class="as-field">
          <label for="as-clip">Clip</label>
          <select id="as-clip" data-clip></select>
        </div>
        <div class="as-btn-group" role="group" aria-label="Clip playback">
          <button type="button" class="as-btn" data-action="clip-play">Play clip</button>
          <button type="button" class="as-btn" data-action="clip-stop">Stop</button>
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
        </div>
        <p class="as-hint as-object-meta" data-object-meta hidden></p>
        <p class="as-hint">Material colour, metalness, clearcoat and more live in the <strong>Materials</strong> panel.</p>
      </div>

      <div data-panel="Materials" hidden>
        <p class="as-hint">Click the car to pick a material, or choose from the list. Edits persist on Save / reload / quality switch.</p>
        <label class="as-check"><input type="checkbox" data-vehicle-polish checked /> Auto polish glass / paint / chrome</label>
        <label class="as-check"><input type="checkbox" data-mat-pick checked /> Click viewport to pick material</label>

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
          <label for="as-sun-az">Azimuth <span data-sun-az-val>135°</span></label>
          <input id="as-sun-az" data-sun-az type="range" min="0" max="360" step="1" value="135" />
        </div>
        <div class="as-field">
          <label for="as-sun-el">Elevation <span data-sun-el-val>42°</span></label>
          <input id="as-sun-el" data-sun-el type="range" min="-20" max="85" step="1" value="42" />
        </div>
        <label class="as-field"><span>Light intensity <em data-sun-intensity-val>1.00</em></span>
          <input data-sun-intensity type="range" min="0" max="2" step="0.05" value="1" /></label>
        <label class="as-field"><span>Angular size ° <em data-sun-ang-val>0.53</em></span>
          <input data-sun-ang type="range" min="0.2" max="3" step="0.01" value="0.53" /></label>
        <label class="as-field"><span>Artistic size <em data-sun-disc-scale-val>1.00×</em></span>
          <input data-sun-disc-scale type="range" min="0.2" max="3" step="0.05" value="1" /></label>

        <h3 class="as-subhead">Moon</h3>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-moon type="checkbox" /> Moon visible</label>
          <label class="as-check"><input data-moon-key type="checkbox" /> Use as key light</label>
        </div>
        <div class="as-field">
          <label for="as-moon-az">Azimuth <span data-moon-az-val>295°</span></label>
          <input id="as-moon-az" data-moon-az type="range" min="0" max="360" step="1" value="295" />
        </div>
        <div class="as-field">
          <label for="as-moon-el">Elevation <span data-moon-el-val>28°</span></label>
          <input id="as-moon-el" data-moon-el type="range" min="-20" max="85" step="1" value="28" />
        </div>
        <label class="as-field"><span>Brightness <em data-moon-intensity-val>1.00</em></span>
          <input data-moon-intensity type="range" min="0.1" max="3" step="0.05" value="1" /></label>
        <label class="as-field"><span>Angular size ° <em data-moon-ang-val>0.53</em></span>
          <input data-moon-ang type="range" min="0.2" max="3" step="0.01" value="0.53" /></label>
        <label class="as-field"><span>Artistic size <em data-moon-scale-val>1.00×</em></span>
          <input data-moon-scale type="range" min="0.2" max="3" step="0.05" value="1" /></label>
        <label class="as-field"><span>Phase <em data-moon-phase-val>0.50</em></span>
          <input data-moon-phase type="range" min="0" max="1" step="0.01" value="0.5" /></label>
        <p class="as-hint">Sun and moon are independent. Night presets enable the moon as key light; Day uses the sun. Camera-relative sky — no parallax on long routes.</p>
      </div>

      <div data-panel="Route" hidden>
        <p class="as-hint">Route follow or free drive (WASD). Free drive uses an infinite floor so you never leave the pad.</p>

        <h3 class="as-subhead">Free drive</h3>
        <label class="as-check"><input data-free-drive type="checkbox" /> Free drive (WASD)</label>
        <p class="as-hint"><strong>W</strong> accel · <strong>S</strong> brake/reverse · <strong>A/D</strong> steer · <strong>Space</strong> stop. Chase camera stays on and follows the car. Click the viewport once if keys feel dead.</p>

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
        <p class="as-hint">Markers parent to a mesh/door node so they follow animation. On open they can show text, play video, and trigger a door/clip action.</p>
        <button type="button" class="as-btn as-btn--accent" data-action="hotspot-pick">Pick mesh / door</button>
        <button type="button" class="as-btn" data-action="hotspot-add">Add at vehicle center</button>
        <label class="as-field">
          <span>Attach to node</span>
          <select data-hotspot-nodes>
            <option value="">— load a vehicle first —</option>
          </select>
        </label>
        <button type="button" class="as-btn" data-action="hotspot-attach-node">Add on selected node</button>
        <div class="as-item-list" data-hotspot-list></div>
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

      <div data-panel="Shots" hidden>
        <p class="as-hint">Capture the current camera position, target and field of view.</p>
        <button type="button" class="as-btn as-btn--accent" data-action="shot-capture">Capture current camera</button>
        <div class="as-item-list" data-shot-list></div>
      </div>

      <div data-panel="Stage" hidden>
        <p class="as-hint">Floor, pedestal and cyclorama — size, colour, PBR maps, emissive.</p>
        <div class="as-stage-surface" data-stage-surface="floor">
          <h3>Floor</h3>
          <label class="as-check"><input type="checkbox" data-stage-floor checked /> Visible</label>
          <label class="as-field"><span>Size (diameter m) <em data-stage-floor-size-val>28</em></span>
            <input data-stage-floor-size type="range" min="8" max="120" step="1" value="28" /></label>
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
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-map="floor:map">Albedo</button>
            <button type="button" class="as-btn" data-stage-map="floor:normal">Normal</button>
            <button type="button" class="as-btn" data-stage-map="floor:roughness">Rough</button>
            <button type="button" class="as-btn" data-stage-map="floor:metalness">Metal</button>
            <button type="button" class="as-btn" data-stage-map="floor:displacement">Depth</button>
            <button type="button" class="as-btn" data-stage-map="floor:ao">AO</button>
            <button type="button" class="as-btn" data-stage-map="floor:emissive">Emit map</button>
            <button type="button" class="as-btn" data-stage-map-clear="floor">Clear maps</button>
          </div>
        </div>
        <div class="as-stage-surface" data-stage-surface="pedestal">
          <h3>Pedestal</h3>
          <label class="as-check"><input type="checkbox" data-stage-pedestal checked /> Visible</label>
          <label class="as-field"><span>Size (diameter m) <em data-stage-pedestal-size-val>4.8</em></span>
            <input data-stage-pedestal-size type="range" min="0.5" max="20" step="0.1" value="4.8" /></label>
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
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-map="pedestal:map">Albedo</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:normal">Normal</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:roughness">Rough</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:metalness">Metal</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:displacement">Depth</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:ao">AO</button>
            <button type="button" class="as-btn" data-stage-map="pedestal:emissive">Emit map</button>
            <button type="button" class="as-btn" data-stage-map-clear="pedestal">Clear maps</button>
          </div>
        </div>
        <div class="as-stage-surface" data-stage-surface="cyclorama">
          <h3>Cyclorama</h3>
          <label class="as-check"><input type="checkbox" data-stage-cyclorama checked /> Visible</label>
          <label class="as-field"><span>Size (radius m) <em data-stage-cyclorama-size-val>14</em></span>
            <input data-stage-cyclorama-size type="range" min="6" max="80" step="0.5" value="14" /></label>
          <label class="as-field"><span>Height (m) <em data-stage-cyclorama-height-val>10</em></span>
            <input data-stage-cyclorama-height type="range" min="2" max="40" step="0.5" value="10" /></label>
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
          <div class="as-map-row">
            <button type="button" class="as-btn" data-stage-map="cyclorama:map">Albedo</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:normal">Normal</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:roughness">Rough</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:metalness">Metal</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:displacement">Depth</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:ao">AO</button>
            <button type="button" class="as-btn" data-stage-map="cyclorama:emissive">Emit map</button>
            <button type="button" class="as-btn" data-stage-map-clear="cyclorama">Clear maps</button>
          </div>
        </div>
        <input data-stage-map-file type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.exr,.hdr" hidden />
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
        <p class="as-hint">Name-matched meshes (headlight, brake, DRL…). Bind counts update after import.</p>
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
          <input data-vlight-intensity type="range" min="0" max="2" step="0.05" value="1" /></label>
        <label class="as-check"><input type="checkbox" data-vlight-proxies checked /> Proxy point lights</label>
        <label class="as-check"><input type="checkbox" data-vlight-auto-night checked /> Auto DRL+tail at night</label>
        <div class="as-btn-group as-btn-group--wrap">
          <button type="button" class="as-btn" data-action="vlight-all-off">All off</button>
          <button type="button" class="as-btn" data-action="vlight-night">Night running</button>
          <button type="button" class="as-btn" data-action="vlight-welcome">Welcome</button>
          <button type="button" class="as-btn" data-action="vlight-farewell">Farewell</button>
        </div>

        <h3 class="as-subhead">Lamp bloom</h3>
        <p class="as-hint" data-bloom-hint>Selective bloom (WebGL2) — only lit vehicle lamps glow. Sun/moon stay sharp.</p>
        <label class="as-check"><input type="checkbox" data-vlight-bloom /> Enable bloom</label>
        <label class="as-field"><span>Bloom strength <em data-vlight-bloom-str-val>0.28</em></span>
          <input data-vlight-bloom-str type="range" min="0" max="2" step="0.05" value="0.28" /></label>
        <label class="as-field"><span>Bloom threshold <em data-vlight-bloom-thr-val>1.00</em></span>
          <input data-vlight-bloom-thr type="range" min="0.4" max="1.4" step="0.01" value="1.00" /></label>

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
          <div><dt>Access policy</dt><dd data-access>local-only</dd></div>
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
  const objectMaterialPanel = root.querySelector('[data-object-material]') as HTMLElement
  const matEmpty = root.querySelector('[data-mat-empty]') as HTMLElement
  const objectPick = root.querySelector('[data-object-pick]') as HTMLInputElement
  const matPick = root.querySelector('[data-mat-pick]') as HTMLInputElement
  const vehiclePolish = root.querySelector('[data-vehicle-polish]') as HTMLInputElement
  let objectNodesById = new Map<string, ObjectTreeNode>()
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
  const stageFloor = root.querySelector('[data-stage-floor]') as HTMLInputElement
  const stagePedestal = root.querySelector('[data-stage-pedestal]') as HTMLInputElement
  const stageCyclorama = root.querySelector('[data-stage-cyclorama]') as HTMLInputElement
  const stageMapFile = root.querySelector('[data-stage-map-file]') as HTMLInputElement
  let pendingStageMap: { surface: 'floor' | 'pedestal' | 'cyclorama'; map: string } | null = null
  const accentEnabled = root.querySelector('[data-accent-enabled]') as HTMLInputElement
  const accentVolumetric = root.querySelector('[data-accent-volumetric]') as HTMLInputElement
  const accentIntensity = root.querySelector('[data-accent-intensity]') as HTMLInputElement
  const accentIntensityVal = root.querySelector('[data-accent-intensity-val]') as HTMLElement
  const vlightIntensity = root.querySelector('[data-vlight-intensity]') as HTMLInputElement
  const vlightProxies = root.querySelector('[data-vlight-proxies]') as HTMLInputElement
  const vlightAutoNight = root.querySelector('[data-vlight-auto-night]') as HTMLInputElement
  const vlightBloom = root.querySelector('[data-vlight-bloom]') as HTMLInputElement
  const vlightBloomStr = root.querySelector('[data-vlight-bloom-str]') as HTMLInputElement
  const vlightBloomThr = root.querySelector('[data-vlight-bloom-thr]') as HTMLInputElement
  const vlightRemapGroup = root.querySelector('[data-vlight-remap-group]') as HTMLSelectElement
  const vlightBindings = root.querySelector('[data-vlight-bindings]') as HTMLElement
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
  const hotspotEditor = root.querySelector('[data-hotspot-editor]') as HTMLElement
  const hotspotTitleInput = root.querySelector('[data-hotspot-title]') as HTMLInputElement
  const hotspotBodyInput = root.querySelector('[data-hotspot-body]') as HTMLTextAreaElement
  const hotspotDoorSelect = root.querySelector('[data-hotspot-door-action]') as HTMLSelectElement
  const hotspotVideoInput = root.querySelector('[data-hotspot-video]') as HTMLInputElement
  const hotspotVideoLabel = root.querySelector('[data-hotspot-video-label]') as HTMLElement
  let editingHotspotId: string | null = null
  let syncingHotspotEditor = false

  const shotList = root.querySelector('[data-shot-list]') as HTMLElement
  const routeStats = root.querySelector('[data-route-stats]') as HTMLElement
  const routeSpeed = root.querySelector('[data-route-speed]') as HTMLInputElement
  const routeRoll = root.querySelector('[data-route-roll]') as HTMLInputElement
  const routeClosed = root.querySelector('[data-route-closed]') as HTMLInputElement
  const routeChase = root.querySelector('[data-route-chase]') as HTMLInputElement
  const freeDrive = root.querySelector('[data-free-drive]') as HTMLInputElement
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
    options.onObjectPickMode(pickOn)
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
  hotspotDoorSelect.addEventListener('change', () => {
    if (syncingHotspotEditor || !editingHotspotId) return
    options.onHotspotDoorAction(editingHotspotId, hotspotDoorSelect.value || null)
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
    if (!button) return
    const id = button.dataset.hotspotId
    if (!id) return
    if (button.dataset.action === 'hotspot-delete') options.onDeleteHotspot(id)
    else options.onSelectHotspot(id)
  })

  shotList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-shot-id]')
    if (!button) return
    const id = button.dataset.shotId
    if (!id) return
    if (button.dataset.action === 'shot-delete') options.onDeleteShot(id)
    else options.onGoToShot(id)
  })

  nameInput.addEventListener('change', () => options.onRename(nameInput.value))
  envSelect.addEventListener('change', () => options.onEnvironmentPreset(envSelect.value))
  lengthInput.addEventListener('change', () => {
    const v = lengthInput.value === '' ? null : Number(lengthInput.value)
    options.onTargetLength(v != null && Number.isFinite(v) ? v : null)
  })
  groundInput.addEventListener('input', () => {
    root.querySelector('[data-ground-val]')!.textContent = Number(groundInput.value).toFixed(2)
  })
  groundInput.addEventListener('change', () => options.onGroundOffset(Number(groundInput.value)))
  clipSelect.addEventListener('change', () => options.onClipSelect(Number(clipSelect.value)))
  clipScrub.addEventListener('input', () => options.onClipSeek(Number(clipScrub.value)))

  const syncSunLabels = () => {
    root.querySelector('[data-sun-az-val]')!.textContent = `${sunAz.value}°`
    root.querySelector('[data-sun-el-val]')!.textContent = `${sunEl.value}°`
  }
  const syncMoonLabels = () => {
    if (moonAz) root.querySelector('[data-moon-az-val]')!.textContent = `${moonAz.value}°`
    if (moonEl) root.querySelector('[data-moon-el-val]')!.textContent = `${moonEl.value}°`
  }
  sunAz.addEventListener('input', () => {
    syncSunLabels()
    options.onEnvironmentLive({ sunAzimuthDeg: Number(sunAz.value) })
  })
  sunAz.addEventListener('change', () => options.onEnvironmentPatch({ sunAzimuthDeg: Number(sunAz.value) }))
  sunEl.addEventListener('input', () => {
    syncSunLabels()
    options.onEnvironmentLive({ sunElevationDeg: Number(sunEl.value) })
  })
  sunEl.addEventListener('change', () => options.onEnvironmentPatch({ sunElevationDeg: Number(sunEl.value) }))
  hdr.addEventListener('change', () => options.onEnvironmentPatch({ hdrBackground: hdr.checked }))
  stars.addEventListener('change', () => options.onEnvironmentPatch({ starsEnabled: stars.checked }))
  moon.addEventListener('change', () => options.onEnvironmentPatch({ moonEnabled: moon.checked }))
  moonKey?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonAsKeyLight: moonKey.checked }),
  )
  moonAz?.addEventListener('input', () => {
    syncMoonLabels()
    options.onEnvironmentLive({ moonAzimuthDeg: Number(moonAz.value) })
  })
  moonAz?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonAzimuthDeg: Number(moonAz.value) }),
  )
  moonEl?.addEventListener('input', () => {
    syncMoonLabels()
    options.onEnvironmentLive({ moonElevationDeg: Number(moonEl.value) })
  })
  moonEl?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonElevationDeg: Number(moonEl.value) }),
  )
  exposure?.addEventListener('input', () => {
    exposureVal.textContent = Number(exposure.value).toFixed(2)
    options.onEnvironmentLive({ exposure: Number(exposure.value) })
  })
  exposure?.addEventListener('change', () =>
    options.onEnvironmentPatch({ exposure: Number(exposure.value) }),
  )
  envIntensity?.addEventListener('input', () => {
    envIntensityVal.textContent = Number(envIntensity.value).toFixed(2)
    options.onEnvironmentLive({ environmentIntensity: Number(envIntensity.value) })
  })
  envIntensity?.addEventListener('change', () =>
    options.onEnvironmentPatch({ environmentIntensity: Number(envIntensity.value) }),
  )
  scrub.addEventListener('input', () => options.onSeek(Number(scrub.value)))

  routeSpeed.addEventListener('input', () => {
    root.querySelector('[data-route-speed-val]')!.textContent = routeSpeed.value
    options.onRouteSpeed(Number(routeSpeed.value))
  })
  routeSpeed.addEventListener('change', () => {
    options.onRouteSpeed(Number(routeSpeed.value), { commit: true })
  })
  routeRoll.addEventListener('change', () => options.onRouteWheelRoll(routeRoll.checked))
  routeClosed.addEventListener('change', () => options.onRouteClosed(routeClosed.checked))
  routeChase.addEventListener('change', () => options.onRouteChaseCamera(routeChase.checked))
  freeDrive?.addEventListener('change', () => options.onFreeDriveEnabled(freeDrive.checked))

  const syncChaseLabels = () => {
    root.querySelector('[data-chase-yaw-val]')!.textContent = `${Math.round(Number(chaseYaw.value))}°`
    root.querySelector('[data-chase-pitch-val]')!.textContent = `${Math.round(Number(chasePitch.value))}°`
    root.querySelector('[data-chase-dist-val]')!.textContent =
      `${Number(chaseDist.value).toFixed(1)} m`
    root.querySelector('[data-chase-target-val]')!.textContent =
      `${Number(chaseTarget.value).toFixed(1)} m`
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
    root.querySelector('[data-route-accel-val]')!.textContent =
      Number(routeAccel.value).toFixed(1)
    options.onRouteAccel(Number(routeAccel.value))
  })
  routeBrake.addEventListener('input', () => {
    root.querySelector('[data-route-brake-val]')!.textContent =
      Number(routeBrake.value).toFixed(1)
    options.onRouteBrake(Number(routeBrake.value))
  })
  routeStartAccel.addEventListener('input', () => {
    root.querySelector('[data-route-start-accel-val]')!.textContent =
      Number(routeStartAccel.value).toFixed(1)
    options.onRouteStartAccel(Number(routeStartAccel.value))
  })
  routeEndStop.addEventListener('input', () => {
    root.querySelector('[data-route-end-stop-val]')!.textContent =
      Number(routeEndStop.value).toFixed(1)
    options.onRouteEndStop(Number(routeEndStop.value))
  })
  routeOval.addEventListener('input', () => {
    root.querySelector('[data-route-oval-val]')!.textContent =
      `${Number(routeOval.value).toFixed(2)}×`
    options.onRouteOvalScale(Number(routeOval.value))
  })
  routeOpen.addEventListener('input', () => {
    root.querySelector('[data-route-open-val]')!.textContent =
      `${Number(routeOpen.value).toFixed(2)}×`
    options.onRouteOpenScale(Number(routeOpen.value))
  })
  const syncPathScaleLabel = () => {
    root.querySelector('[data-route-path-scale-val]')!.textContent =
      `${Number(routePathScale.value).toFixed(2)}×`
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
    root.querySelector('[data-route-roll-rate-val]')!.textContent =
      `${Number(routeRollRate.value).toFixed(2)}×`
    options.onRouteTireRollRate(Number(routeRollRate.value))
  })
  routeSteer.addEventListener('input', () => {
    root.querySelector('[data-route-steer-val]')!.textContent = `${routeSteer.value}°`
    options.onRouteMaxSteer(Number(routeSteer.value))
  })
  routeBodyRoll.addEventListener('input', () => {
    root.querySelector('[data-route-body-roll-val]')!.textContent =
      `${Number(routeBodyRoll.value).toFixed(1)}°`
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
      sizeVal.textContent = Number(size.value).toFixed(key === 'pedestal' ? 1 : 0)
      const num = Number(size.value)
      if (key === 'floor') options.onStagePatch({ floorSize: num })
      else if (key === 'pedestal') options.onStagePatch({ pedestalSize: num })
      else options.onStagePatch({ cycloramaSize: num })
      showTiles()
    })
    color?.addEventListener('input', () => patchSurface({ color: color.value }))
    metal?.addEventListener('input', () => {
      metalVal.textContent = Number(metal.value).toFixed(2)
      patchSurface({ metalness: Number(metal.value) })
    })
    rough?.addEventListener('input', () => {
      roughVal.textContent = Number(rough.value).toFixed(2)
      patchSurface({ roughness: Number(rough.value) })
    })
    emissive?.addEventListener('input', () => patchSurface({ emissive: emissive.value }))
    emi?.addEventListener('input', () => {
      const intensity = Number(emi.value)
      emiVal.textContent = intensity.toFixed(2)
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
      dispVal.textContent = Number(disp.value).toFixed(2)
      patchSurface({ displacementScale: Number(disp.value) })
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
    if (stageCycHeightVal) stageCycHeightVal.textContent = h.toFixed(1)
    options.onStagePatch({ cycloramaHeight: h })
  })

  root.querySelectorAll('[data-stage-map]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = (btn as HTMLElement).dataset.stageMap || ''
      const [surface, map] = token.split(':')
      if (!surface || !map) return
      pendingStageMap = {
        surface: surface as 'floor' | 'pedestal' | 'cyclorama',
        map,
      }
      stageMapFile.value = ''
      stageMapFile.click()
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

  accentEnabled.addEventListener('change', () => {
    options.onAccentLightsPatch({ enabled: accentEnabled.checked })
  })
  accentVolumetric.addEventListener('change', () => {
    options.onAccentLightsPatch({ volumetricEnabled: accentVolumetric.checked })
  })
  accentIntensity.addEventListener('input', () => {
    const value = Number(accentIntensity.value)
    accentIntensityVal.textContent = value.toFixed(2)
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
    root.querySelector('[data-vlight-intensity-val]')!.textContent = Number(
      vlightIntensity.value,
    ).toFixed(2)
    options.onVehicleLightsPatch({ intensity: Number(vlightIntensity.value) })
  })
  vlightProxies?.addEventListener('change', () =>
    options.onVehicleLightsPatch({ proxiesEnabled: vlightProxies.checked }),
  )
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
  vlightBloom?.addEventListener('change', () =>
    options.onVehicleLightsPatch({ bloomEnabled: vlightBloom.checked }),
  )
  vlightBloomStr?.addEventListener('input', () => {
    root.querySelector('[data-vlight-bloom-str-val]')!.textContent = Number(
      vlightBloomStr.value,
    ).toFixed(2)
    options.onVehicleLightsPatch({ bloomStrength: Number(vlightBloomStr.value) })
  })
  vlightBloomThr?.addEventListener('input', () => {
    root.querySelector('[data-vlight-bloom-thr-val]')!.textContent = Number(
      vlightBloomThr.value,
    ).toFixed(2)
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

  sunDisc?.addEventListener('change', () => options.onEnvironmentPatch({ sunDiscVisible: sunDisc.checked }))
  sunEnabled?.addEventListener('change', () =>
    options.onEnvironmentPatch({ sunEnabled: sunEnabled.checked }),
  )
  sunIntensity?.addEventListener('input', () => {
    root.querySelector('[data-sun-intensity-val]')!.textContent = Number(sunIntensity.value).toFixed(2)
    options.onEnvironmentLive({ sunIntensity: Number(sunIntensity.value) })
  })
  sunIntensity?.addEventListener('change', () =>
    options.onEnvironmentPatch({ sunIntensity: Number(sunIntensity.value) }),
  )
  sunAng?.addEventListener('input', () => {
    root.querySelector('[data-sun-ang-val]')!.textContent = Number(sunAng.value).toFixed(2)
    options.onEnvironmentLive({ sunAngularDiameterDeg: Number(sunAng.value) })
  })
  sunAng?.addEventListener('change', () =>
    options.onEnvironmentPatch({ sunAngularDiameterDeg: Number(sunAng.value) }),
  )
  sunDiscScale?.addEventListener('input', () => {
    root.querySelector('[data-sun-disc-scale-val]')!.textContent =
      `${Number(sunDiscScale.value).toFixed(2)}×`
    options.onEnvironmentLive({ sunDiscScale: Number(sunDiscScale.value) })
  })
  sunDiscScale?.addEventListener('change', () =>
    options.onEnvironmentPatch({ sunDiscScale: Number(sunDiscScale.value) }),
  )
  moonScale?.addEventListener('input', () => {
    root.querySelector('[data-moon-scale-val]')!.textContent =
      `${Number(moonScale.value).toFixed(2)}×`
    options.onEnvironmentLive({ moonScale: Number(moonScale.value) })
  })
  moonScale?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonScale: Number(moonScale.value) }),
  )
  moonIntensity?.addEventListener('input', () => {
    root.querySelector('[data-moon-intensity-val]')!.textContent = Number(moonIntensity.value).toFixed(2)
    options.onEnvironmentLive({ moonIntensity: Number(moonIntensity.value) })
  })
  moonIntensity?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonIntensity: Number(moonIntensity.value) }),
  )
  moonAng?.addEventListener('input', () => {
    root.querySelector('[data-moon-ang-val]')!.textContent = Number(moonAng.value).toFixed(2)
    options.onEnvironmentLive({ moonAngularDiameterDeg: Number(moonAng.value) })
  })
  moonAng?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonAngularDiameterDeg: Number(moonAng.value) }),
  )
  moonPhase?.addEventListener('input', () => {
    root.querySelector('[data-moon-phase-val]')!.textContent = Number(moonPhase.value).toFixed(2)
    options.onEnvironmentLive({ moonPhase: Number(moonPhase.value) })
  })
  moonPhase?.addEventListener('change', () =>
    options.onEnvironmentPatch({ moonPhase: Number(moonPhase.value) }),
  )

  objectPick?.addEventListener('change', () => {
    if (objectPick.checked && matPick) matPick.checked = false
    options.onObjectPickMode(
      (activeSection === 'Objects' && objectPick.checked) ||
        (activeSection === 'Materials' && Boolean(matPick?.checked)),
    )
  })
  matPick?.addEventListener('change', () => {
    if (matPick.checked && objectPick) objectPick.checked = false
    options.onObjectPickMode(
      (activeSection === 'Materials' && matPick.checked) ||
        (activeSection === 'Objects' && Boolean(objectPick?.checked)),
    )
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
  objectDeselect?.addEventListener('click', () => {
    options.onObjectSelect(null)
  })
  matSlot?.addEventListener('change', () => options.onObjectMaterialIndex(Number(matSlot.value)))
  matColor?.addEventListener('input', () => options.onObjectMaterialPatch({ color: matColor.value }))
  matColor?.addEventListener('change', () => options.onObjectMaterialCommit())
  matMetal?.addEventListener('input', () => {
    matMetalVal.textContent = Number(matMetal.value).toFixed(2)
    options.onObjectMaterialPatch({ metalness: Number(matMetal.value) })
  })
  matMetal?.addEventListener('change', () => options.onObjectMaterialCommit())
  matRough?.addEventListener('input', () => {
    matRoughVal.textContent = Number(matRough.value).toFixed(2)
    options.onObjectMaterialPatch({ roughness: Number(matRough.value) })
  })
  matRough?.addEventListener('change', () => options.onObjectMaterialCommit())
  matEmissive?.addEventListener('input', () => options.onObjectMaterialPatch({ emissive: matEmissive.value }))
  matEmissive?.addEventListener('change', () => options.onObjectMaterialCommit())
  matEmi?.addEventListener('input', () => {
    matEmiVal.textContent = Number(matEmi.value).toFixed(2)
    options.onObjectMaterialPatch({ emissiveIntensity: Number(matEmi.value) })
  })
  matEmi?.addEventListener('change', () => options.onObjectMaterialCommit())
  matOpacity?.addEventListener('input', () => {
    matOpacityVal.textContent = Number(matOpacity.value).toFixed(2)
    options.onObjectMaterialPatch({ opacity: Number(matOpacity.value) })
  })
  matOpacity?.addEventListener('change', () => options.onObjectMaterialCommit())
  matTransparent?.addEventListener('change', () => {
    options.onObjectMaterialPatch({ transparent: matTransparent.checked })
    options.onObjectMaterialCommit()
  })
  matEnv?.addEventListener('input', () => {
    matEnvVal.textContent = Number(matEnv.value).toFixed(2)
    options.onObjectMaterialPatch({ envMapIntensity: Number(matEnv.value) })
  })
  matEnv?.addEventListener('change', () => options.onObjectMaterialCommit())
  matCc?.addEventListener('input', () => {
    matCcVal.textContent = Number(matCc.value).toFixed(2)
    options.onObjectMaterialPatch({ clearcoat: Number(matCc.value) })
  })
  matCc?.addEventListener('change', () => options.onObjectMaterialCommit())
  matCcr?.addEventListener('input', () => {
    matCcrVal.textContent = Number(matCcr.value).toFixed(2)
    options.onObjectMaterialPatch({ clearcoatRoughness: Number(matCcr.value) })
  })
  matCcr?.addEventListener('change', () => options.onObjectMaterialCommit())
  matTrans?.addEventListener('input', () => {
    matTransVal.textContent = Number(matTrans.value).toFixed(2)
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

  return {
    viewportHost,
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
        exposureVal.textContent = Number(env.exposure).toFixed(2)
      }
      if (envIntensity) {
        envIntensity.value = String(env.environmentIntensity)
        envIntensityVal.textContent = Number(env.environmentIntensity).toFixed(2)
      }
      if (sunEnabled) sunEnabled.checked = env.sunEnabled !== false
      if (moonKey) moonKey.checked = Boolean(env.moonAsKeyLight)
      if (moonAz) moonAz.value = String(Math.round(env.moonAzimuthDeg ?? 295))
      if (moonEl) moonEl.value = String(Math.round(env.moonElevationDeg ?? 28))
      syncSunLabels()
      syncMoonLabels()
      if (sunIntensity) {
        sunIntensity.value = String(env.sunIntensity ?? 1)
        root.querySelector('[data-sun-intensity-val]')!.textContent = Number(
          env.sunIntensity ?? 1,
        ).toFixed(2)
      }
      if (sunAng) {
        sunAng.value = String(env.sunAngularDiameterDeg ?? 0.53)
        root.querySelector('[data-sun-ang-val]')!.textContent = Number(
          env.sunAngularDiameterDeg ?? 0.53,
        ).toFixed(2)
      }
      if (moonAng) {
        moonAng.value = String(env.moonAngularDiameterDeg ?? 0.53)
        root.querySelector('[data-moon-ang-val]')!.textContent = Number(
          env.moonAngularDiameterDeg ?? 0.53,
        ).toFixed(2)
      }
      if (moonPhase) {
        moonPhase.value = String(env.moonPhase ?? 0.5)
        root.querySelector('[data-moon-phase-val]')!.textContent = Number(
          env.moonPhase ?? 0.5,
        ).toFixed(2)
      }
      const stage = snap.project.stage
      stageFloor.checked = stage.floorVisible
      stagePedestal.checked = stage.pedestalVisible
      stageCyclorama.checked = stage.cycloramaVisible
      const syncSurf = (key: 'floor' | 'pedestal' | 'cyclorama') => {
        const s = stage[key]
        const sizeEl = root.querySelector(`[data-stage-${key}-size]`) as HTMLInputElement | null
        const sizeVal = root.querySelector(`[data-stage-${key}-size-val]`) as HTMLElement | null
        const size =
          key === 'floor' ? stage.floorSize : key === 'pedestal' ? stage.pedestalSize : stage.cycloramaSize
        if (sizeEl) sizeEl.value = String(size)
        if (sizeVal) sizeVal.textContent = Number(size).toFixed(key === 'pedestal' ? 1 : 0)
        const set = (attr: string, value: string) => {
          const el = root.querySelector(`[data-stage-${key}-${attr}]`) as HTMLInputElement | null
          if (el) el.value = value
        }
        const setVal = (attr: string, value: string) => {
          const el = root.querySelector(`[data-stage-${key}-${attr}-val]`) as HTMLElement | null
          if (el) el.textContent = value
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
      }
      syncSurf('floor')
      syncSurf('pedestal')
      syncSurf('cyclorama')
      if (stageCycHeight) {
        stageCycHeight.value = String(stage.cycloramaHeight ?? 10)
      }
      if (stageCycHeightVal) {
        stageCycHeightVal.textContent = Number(stage.cycloramaHeight ?? 10).toFixed(1)
      }
      const accents = snap.project.accentLights
      accentEnabled.checked = accents.enabled
      accentVolumetric.checked = accents.volumetricEnabled
      accentIntensity.value = String(accents.intensity ?? 1)
      accentIntensityVal.textContent = Number(accents.intensity ?? 1).toFixed(2)
      const vl = snap.project.vehicleLights
      if (vl) {
        for (const el of root.querySelectorAll<HTMLInputElement>('[data-vlight]')) {
          const id = el.getAttribute('data-vlight') as VehicleLightGroupId
          if (id && id in vl.groups) el.checked = Boolean(vl.groups[id])
        }
        if (vlightIntensity) {
          vlightIntensity.value = String(vl.intensity ?? 1)
          root.querySelector('[data-vlight-intensity-val]')!.textContent = Number(
            vl.intensity ?? 1,
          ).toFixed(2)
        }
        if (vlightProxies) vlightProxies.checked = vl.proxiesEnabled !== false
        if (vlightAutoNight) vlightAutoNight.checked = vl.autoRunningAtNight !== false
        if (vlightBloom) vlightBloom.checked = Boolean(vl.bloomEnabled)
        if (vlightBloomStr) {
          vlightBloomStr.value = String(vl.bloomStrength ?? 0.28)
          root.querySelector('[data-vlight-bloom-str-val]')!.textContent = Number(
            vl.bloomStrength ?? 0.28,
          ).toFixed(2)
        }
        if (vlightBloomThr) {
          vlightBloomThr.value = String(vl.bloomThreshold ?? 1)
          root.querySelector('[data-vlight-bloom-thr-val]')!.textContent = Number(
            vl.bloomThreshold ?? 1,
          ).toFixed(2)
        }
      }
      if (sunDisc) sunDisc.checked = env.sunDiscVisible
      if (sunDiscScale) {
        sunDiscScale.value = String(env.sunDiscScale ?? 1)
        root.querySelector('[data-sun-disc-scale-val]')!.textContent =
          `${Number(env.sunDiscScale ?? 1).toFixed(2)}×`
      }
      if (moonScale) {
        moonScale.value = String(env.moonScale ?? 1)
        root.querySelector('[data-moon-scale-val]')!.textContent =
          `${Number(env.moonScale ?? 1).toFixed(2)}×`
      }
      if (moonIntensity) {
        moonIntensity.value = String(env.moonIntensity ?? 1)
        root.querySelector('[data-moon-intensity-val]')!.textContent = Number(
          env.moonIntensity ?? 1,
        ).toFixed(2)
      }
      if (vehiclePolish) {
        vehiclePolish.checked = (snap.project.vehicle?.polishMode ?? 'auto') !== 'off'
        vehiclePolish.disabled = !snap.project.vehicle
      }
      if (freeDrive) {
        freeDrive.checked = Boolean(snap.project.freeDrive?.enabled)
      }
      root.querySelector('[data-dirty]')!.textContent = snap.dirty ? 'dirty' : 'clean'
      root.querySelector('[data-access]')!.textContent = snap.project.presentation.accessPolicy
      ;(root.querySelector('[data-action="undo"]') as HTMLButtonElement).disabled = !snap.canUndo
      ;(root.querySelector('[data-action="redo"]') as HTMLButtonElement).disabled = !snap.canRedo

      const v = snap.project.vehicle
      if (v?.targetLengthMetres != null) lengthInput.value = String(v.targetLengthMetres.toFixed(2))
      if (v) {
        groundInput.value = String(v.groundOffsetMetres)
        root.querySelector('[data-ground-val]')!.textContent = v.groundOffsetMetres.toFixed(2)
      }
      hotspotList.innerHTML = snap.project.hotspots.length
        ? snap.project.hotspots.map((hotspot) => {
            const node = hotspot.anchor.node.name || hotspot.anchor.node.path || 'vehicle'
            const door = hotspot.actions.find(
              (a) => a.type === 'action.play' || a.type === 'action.toggle',
            )
            const hasVideo = hotspot.blocks.some((b) => b.type === 'video')
            const tags = [
              door ? 'door' : null,
              hasVideo ? 'video' : null,
              hotspot.blocks.some((b) => b.type === 'richtext') ? 'text' : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return `
            <div class="as-item-row">
              <button type="button" class="as-btn" data-action="hotspot-select" data-hotspot-id="${hotspot.id}">${escapeHtml(hotspot.name)} <span class="as-hint">· ${escapeHtml(node)}${tags ? ` · ${tags}` : ''}</span></button>
              <button type="button" class="as-btn" data-action="hotspot-delete" data-hotspot-id="${hotspot.id}" aria-label="Delete ${escapeHtml(hotspot.name)}">Delete</button>
            </div>`
          }).join('')
        : '<p class="as-hint">No hotspots yet.</p>'
      shotList.innerHTML = snap.project.shots.length
        ? snap.project.shots.map((shot) => `
            <div class="as-item-row">
              <button type="button" class="as-btn" data-action="shot-go" data-shot-id="${shot.id}">${escapeHtml(shot.name)}</button>
              <button type="button" class="as-btn" data-action="shot-delete" data-shot-id="${shot.id}" aria-label="Delete ${escapeHtml(shot.name)}">Delete</button>
            </div>`).join('')
        : '<p class="as-hint">No shots yet.</p>'
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
    setHotspotEditor(hotspot, doorActions, meta) {
      syncingHotspotEditor = true
      editingHotspotId = hotspot?.id ?? null
      if (!hotspot) {
        hotspotEditor.hidden = true
        syncingHotspotEditor = false
        return
      }
      hotspotEditor.hidden = false
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
      objectNodesById = new Map(nodes.map((n) => [n.id, n]))
      syncingObjectSelect = true
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
        const meshOpts = meshes
          .map((node) => {
            const indent = '· '.repeat(Math.min(node.depth, 8))
            const label = `${indent}${node.name}`
            return `<option value="${escapeAttr(node.id)}">${escapeHtml(label)}</option>`
          })
          .join('')
        const groupOpts = groups
          .map((node) => {
            const indent = '· '.repeat(Math.min(node.depth, 8))
            const label = `${indent}${node.name} (${node.type})`
            return `<option value="${escapeAttr(node.id)}">${escapeHtml(label)}</option>`
          })
          .join('')
        select.innerHTML =
          `<option value="">— none (deselect) —</option>` +
          (meshes.length
            ? `<optgroup label="Meshes (${meshes.length})">${meshOpts}</optgroup>`
            : '') +
          (groups.length
            ? `<optgroup label="Groups / nodes (${groups.length})">${groupOpts}</optgroup>`
            : '')
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
        syncingObjectSelect = false
        return
      }
      fillSelect(objectSelect, '— none —')
      fillSelect(matObjectSelect, '— select in Objects or pick —')
      const selected = selectedId ? objectNodesById.get(selectedId) : null
      objectDeselect.disabled = !selectedId
      const metaText = selected
        ? selected.mesh
          ? `Mesh · depth ${selected.depth}`
          : `${selected.type} · ${selected.childCount} children · depth ${selected.depth}`
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
      syncingObjectSelect = false
    },
    updateObjectMaterial(state, slots, selectedSlot = 0) {
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
      matMetalVal.textContent = state.metalness.toFixed(2)
      matRough.value = String(state.roughness)
      matRoughVal.textContent = state.roughness.toFixed(2)
      matEmissive.value = state.emissive
      matEmi.value = String(state.emissiveIntensity)
      matEmiVal.textContent = state.emissiveIntensity.toFixed(2)
      matOpacity.value = String(state.opacity)
      matOpacityVal.textContent = state.opacity.toFixed(2)
      matTransparent.checked = state.transparent
      matEnv.value = String(state.envMapIntensity)
      matEnvVal.textContent = state.envMapIntensity.toFixed(2)
      matPhysical.hidden = !state.hasPhysical
      if (state.hasPhysical) {
        matCc.value = String(state.clearcoat)
        matCcVal.textContent = state.clearcoat.toFixed(2)
        matCcr.value = String(state.clearcoatRoughness)
        matCcrVal.textContent = state.clearcoatRoughness.toFixed(2)
        matTrans.value = String(state.transmission)
        matTransVal.textContent = state.transmission.toFixed(2)
      }
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
        root.querySelector('[data-route-speed-val]')!.textContent = routeSpeed.value
      }
      if (stats.tireRollRate != null && document.activeElement !== routeRollRate) {
        routeRollRate.value = String(stats.tireRollRate)
        root.querySelector('[data-route-roll-rate-val]')!.textContent =
          `${stats.tireRollRate.toFixed(2)}×`
      }
      if (stats.maxSteerDeg != null && document.activeElement !== routeSteer) {
        routeSteer.value = String(Math.round(stats.maxSteerDeg))
        root.querySelector('[data-route-steer-val]')!.textContent = `${routeSteer.value}°`
      }
      if (stats.maxBodyRollDeg != null && document.activeElement !== routeBodyRoll) {
        routeBodyRoll.value = String(stats.maxBodyRollDeg)
        root.querySelector('[data-route-body-roll-val]')!.textContent =
          `${Number(routeBodyRoll.value).toFixed(1)}°`
      }
      if (stats.ovalScale != null && document.activeElement !== routeOval) {
        routeOval.value = String(stats.ovalScale)
        root.querySelector('[data-route-oval-val]')!.textContent =
          `${stats.ovalScale.toFixed(2)}×`
      } else if (stats.ovalScale == null && stats.enabled && stats.closed) {
        root.querySelector('[data-route-oval-val]')!.textContent = 'custom'
      }
      if (stats.openScale != null && document.activeElement !== routeOpen) {
        routeOpen.value = String(stats.openScale)
        root.querySelector('[data-route-open-val]')!.textContent =
          `${stats.openScale.toFixed(2)}×`
      } else if (stats.openScale == null && stats.enabled && stats.closed === false) {
        root.querySelector('[data-route-open-val]')!.textContent = 'custom'
      }
      // Oval size only for closed demo ovals; open size only for open demo paths.
      const showOvalSize = Boolean(stats.enabled && stats.closed && stats.ovalScale != null)
      const showOpenSize = Boolean(stats.enabled && stats.closed === false && stats.openScale != null)
      ovalSizeBlock.hidden = !showOvalSize
      openSizeBlock.hidden = !showOpenSize
      if (stats.accelMps2 != null && document.activeElement !== routeAccel) {
        routeAccel.value = String(stats.accelMps2)
        root.querySelector('[data-route-accel-val]')!.textContent = stats.accelMps2.toFixed(1)
      }
      if (stats.brakeMps2 != null && document.activeElement !== routeBrake) {
        routeBrake.value = String(stats.brakeMps2)
        root.querySelector('[data-route-brake-val]')!.textContent = stats.brakeMps2.toFixed(1)
      }
      if (stats.startAccelMps2 != null && document.activeElement !== routeStartAccel) {
        routeStartAccel.value = String(stats.startAccelMps2)
        root.querySelector('[data-route-start-accel-val]')!.textContent =
          stats.startAccelMps2.toFixed(1)
      }
      if (stats.endStopMps2 != null && document.activeElement !== routeEndStop) {
        routeEndStop.value = String(stats.endStopMps2)
        root.querySelector('[data-route-end-stop-val]')!.textContent = stats.endStopMps2.toFixed(1)
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
