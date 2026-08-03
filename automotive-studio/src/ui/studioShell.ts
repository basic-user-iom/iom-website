import type { EnvironmentState, ExperienceMode, UiChromeTheme } from '../persistence/schema'
import type { StoreSnapshot } from '../persistence/projectStore'
import type { TransportSnapshot } from '../transport/transport'
import type { StudioRenderer } from '../renderer/createRenderer'
import type { VehicleSessionSnapshot } from '../vehicle/vehicleSession'
import { formatBytes } from '../assets/importGlb'
import { formatGpuEstimate } from '../assets/analyzeAsset'

const RAIL_ITEMS = [
  'Vehicle',
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
  onClearRoute: () => void
  onRouteSpeed: (kmh: number) => void
  onRouteWheelRoll: (enabled: boolean) => void
  onRouteTireRollRate: (rate: number) => void
  onRouteMaxSteer: (degrees: number) => void
  onTargetLength: (metres: number | null) => void
  onFlip180: () => void
  onGroundOffset: (metres: number) => void
  onClipPlay: () => void
  onClipStop: () => void
  onClipSeek: (t: number) => void
  onClipSelect: (index: number) => void
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
  setRendererInfo: (renderer: StudioRenderer) => void
  setModeLabel: (mode: ExperienceMode) => void
  setStatus: (message: string, warn?: boolean) => void
  setUiTheme: (theme: UiChromeTheme) => void
  setImportProgress: (ratio: number, label: string) => void
  setOrbitEnabled: (enabled: boolean) => void
  updateRouteStats: (stats: {
    enabled: boolean
    lengthMetres: number
    distanceMetres: number
    speedKmh: number
    bindingCount: number
    yawOffsetDeg?: number
    alignmentSource?: string
    tireRollRate?: number
    effectiveRadiusMetres?: number
    wheelbaseMetres?: number
    steerDeg?: number
    maxSteerDeg?: number
    calibration?: string
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

        <h3 class="as-subhead">Compatibility</h3>
        <dl data-report class="as-report">
          <div><dt>Status</dt><dd>No vehicle imported</dd></div>
        </dl>
      </div>

      <div data-panel="Environment" hidden>
        <div class="as-field">
          <label for="as-env">Scene preset</label>
          <select id="as-env" data-env>
            <option value="studio">Studio (dark)</option>
            <option value="day">Day</option>
            <option value="golden-hour">Golden Hour</option>
            <option value="night">Night</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="as-field">
          <label for="as-sun-az">Sun azimuth <span data-sun-az-val>135°</span></label>
          <input id="as-sun-az" data-sun-az type="range" min="0" max="360" step="1" value="135" />
        </div>
        <div class="as-field">
          <label for="as-sun-el">Sun elevation <span data-sun-el-val>42°</span></label>
          <input id="as-sun-el" data-sun-el type="range" min="-20" max="85" step="1" value="42" />
        </div>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-hdr type="checkbox" checked /> HDR-style sky</label>
          <label class="as-check"><input data-stars type="checkbox" /> Stars</label>
          <label class="as-check"><input data-moon type="checkbox" /> Moon</label>
        </div>
        <p class="as-hint">HDR is a procedural stand-in for now. Licensed HDRI maps arrive in Phase 5.</p>
      </div>

      <div data-panel="Route" hidden>
        <p class="as-hint">Phase 4 MVP — closed demo oval, transport-driven follow, distance-linked tire roll.</p>
        <div class="as-btn-group as-btn-group--stack" role="group" aria-label="Route actions">
          <button type="button" class="as-btn as-btn--accent" data-action="route-demo">Create demo oval</button>
          <button type="button" class="as-btn" data-action="route-clear">Clear route</button>
        </div>
        <div class="as-field">
          <label for="as-route-speed">Speed (km/h) <span data-route-speed-val>18</span></label>
          <input id="as-route-speed" data-route-speed type="range" min="5" max="60" step="1" value="18" />
        </div>
        <div class="as-field as-field--checks">
          <label class="as-check"><input data-route-roll type="checkbox" checked /> Distance-linked tire roll</label>
        </div>
        <div class="as-field">
          <label for="as-route-roll-rate">Tire roll speed <span data-route-roll-rate-val>1.00×</span></label>
          <input id="as-route-roll-rate" data-route-roll-rate type="range" min="0.3" max="2" step="0.02" value="1" />
        </div>
        <div class="as-field">
          <label for="as-route-steer">Steering lock <span data-route-steer-val>35°</span></label>
          <input id="as-route-steer" data-route-steer type="range" min="0" max="50" step="1" value="35" />
        </div>
        <dl data-route-stats class="as-report">
          <div><dt>Status</dt><dd>No route</dd></div>
        </dl>
        <p class="as-hint">Import a *-rigged.glb + manifesto, create the oval, then press Play in the transport bar.</p>
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
  const envPanel = root.querySelector('[data-panel="Environment"]') as HTMLElement
  const routePanel = root.querySelector('[data-panel="Route"]') as HTMLElement
  const generalPanel = root.querySelector('[data-panel="general"]') as HTMLElement
  const routeStats = root.querySelector('[data-route-stats]') as HTMLElement
  const routeSpeed = root.querySelector('[data-route-speed]') as HTMLInputElement
  const routeRoll = root.querySelector('[data-route-roll]') as HTMLInputElement
  const routeRollRate = root.querySelector('[data-route-roll-rate]') as HTMLInputElement
  const routeSteer = root.querySelector('[data-route-steer]') as HTMLInputElement

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
    const isVehicle = section === 'Vehicle'
    const isEnv = section === 'Environment'
    const isRoute = section === 'Route'
    vehiclePanel.hidden = !isVehicle
    envPanel.hidden = !isEnv
    routePanel.hidden = !isRoute
    generalPanel.hidden = isVehicle || isEnv || isRoute
    inspectorTitle.textContent = section
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
  root.querySelector('[data-action="route-clear"]')?.addEventListener('click', options.onClearRoute)
  root.querySelector('[data-action="clear-vehicle"]')?.addEventListener('click', options.onClearVehicle)
  root.querySelector('[data-action="flip180"]')?.addEventListener('click', options.onFlip180)
  root.querySelector('[data-action="clip-play"]')?.addEventListener('click', options.onClipPlay)
  root.querySelector('[data-action="clip-stop"]')?.addEventListener('click', options.onClipStop)
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
  scrub.addEventListener('input', () => options.onSeek(Number(scrub.value)))

  routeSpeed.addEventListener('input', () => {
    root.querySelector('[data-route-speed-val]')!.textContent = routeSpeed.value
  })
  routeSpeed.addEventListener('change', () => options.onRouteSpeed(Number(routeSpeed.value)))
  routeRoll.addEventListener('change', () => options.onRouteWheelRoll(routeRoll.checked))
  routeRollRate.addEventListener('input', () => {
    root.querySelector('[data-route-roll-rate-val]')!.textContent =
      `${Number(routeRollRate.value).toFixed(2)}×`
    options.onRouteTireRollRate(Number(routeRollRate.value))
  })
  routeSteer.addEventListener('input', () => {
    root.querySelector('[data-route-steer-val]')!.textContent = `${routeSteer.value}°`
    options.onRouteMaxSteer(Number(routeSteer.value))
  })

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
            ? 'Environment — presets, sun, procedural HDR/sky, stars & moon.'
            : section === 'Route'
              ? 'Route — demo oval, Play transport to drive; tire roll needs a *-rigged.glb + manifesto.'
              : `${section} — tools arrive in later phases.`
      statusEl.classList.remove('as-status--warn')
    })
  })

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
      syncSunLabels()
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
        <div><dt>File</dt><dd>${r.filename} · ${formatBytes(r.byteSize)}</dd></div>
        <div><dt>Quality</dt><dd>${snap.activeQuality ?? '—'} · ${snap.variants.length} slot(s)</dd></div>
        <div><dt>Geometry</dt><dd>${r.triangles.toLocaleString()} tris · ${r.meshes} meshes · ${r.nodes} nodes</dd></div>
        <div><dt>Materials</dt><dd>${r.materials} mats · ${r.textures} textures · max ${r.maxTextureResolution}px</dd></div>
        <div><dt>GPU textures (est.)</dt><dd>${formatGpuEstimate(r.estimatedDecodedTextureBytes)}</dd></div>
        <div><dt>Units guess</dt><dd>${r.likelyUnits} · bounds ${r.bounds.x.toFixed(1)}×${r.bounds.y.toFixed(1)}×${r.bounds.z.toFixed(1)}</dd></div>
        <div><dt>Animations</dt><dd>${
          r.animations.length
            ? r.animations.map((a) => `${a.name} ${a.duration.toFixed(3)}s / ${a.trackCount} tracks`).join('; ')
            : 'None'
        }</dd></div>
        <div><dt>Extensions</dt><dd>${r.extensions.length ? r.extensions.join(', ') : '—'}</dd></div>
        <div><dt>Measured</dt><dd>${
          snap.measured
            ? `L ${snap.measured.length.toFixed(2)}m · W ${snap.measured.width.toFixed(2)}m · H ${snap.measured.height.toFixed(2)}m`
            : '—'
        }</dd></div>
        <div><dt>Wheel rig</dt><dd>${rigLine}</dd></div>
        <div><dt>Warnings</dt><dd>${r.warnings.length ? r.warnings.join(' ') : 'None'}</dd></div>
      `
    },
    setClipTransport(time, duration, playing) {
      clipScrub.max = String(duration || 0)
      clipScrub.value = String(time)
      root.querySelector('[data-clip-time]')!.textContent =
        `${time.toFixed(2)} / ${duration.toFixed(2)}`
      root.querySelector('[data-action="clip-play"]')!.textContent = playing ? 'Pause clip' : 'Play clip'
    },
    setRendererInfo(renderer) {
      root.querySelector('[data-backend]')!.textContent = renderer.backend
      badge.textContent = renderer.probe.note
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
    updateRouteStats(stats) {
      routeSpeed.value = String(Math.round(stats.speedKmh || 18))
      root.querySelector('[data-route-speed-val]')!.textContent = routeSpeed.value
      if (stats.tireRollRate != null && document.activeElement !== routeRollRate) {
        routeRollRate.value = String(stats.tireRollRate)
        root.querySelector('[data-route-roll-rate-val]')!.textContent =
          `${stats.tireRollRate.toFixed(2)}×`
      }
      if (stats.maxSteerDeg != null && document.activeElement !== routeSteer) {
        routeSteer.value = String(Math.round(stats.maxSteerDeg))
        root.querySelector('[data-route-steer-val]')!.textContent = `${routeSteer.value}°`
      }
      if (!stats.enabled) {
        routeStats.innerHTML = `<div><dt>Status</dt><dd>No route</dd></div>`
        return
      }
      routeStats.innerHTML = `
        <div><dt>Status</dt><dd>Demo oval active</dd></div>
        <div><dt>Length</dt><dd>${stats.lengthMetres.toFixed(1)} m</dd></div>
        <div><dt>Travelled</dt><dd>${stats.distanceMetres.toFixed(1)} m</dd></div>
        <div><dt>Speed</dt><dd>${stats.speedKmh.toFixed(0)} km/h</dd></div>
        <div><dt>Roll pivots</dt><dd>${stats.bindingCount}</dd></div>
        <div><dt>Heading fix</dt><dd>${
          stats.yawOffsetDeg != null ? `${stats.yawOffsetDeg.toFixed(1)}°` : '—'
        } · ${stats.alignmentSource ?? '—'}</dd></div>
        <div><dt>Tire roll</dt><dd>${(stats.tireRollRate ?? 1).toFixed(2)}× ${
          stats.effectiveRadiusMetres
            ? `(as if r=${stats.effectiveRadiusMetres.toFixed(3)} m)`
            : ''
        }</dd></div>
        <div><dt>Front steer</dt><dd>${(stats.steerDeg ?? 0).toFixed(1)}° of ${(
          stats.maxSteerDeg ?? 35
        ).toFixed(0)}° lock</dd></div>
        <div><dt>Wheelbase</dt><dd>${
          stats.wheelbaseMetres ? `${stats.wheelbaseMetres.toFixed(2)} m` : '—'
        }</dd></div>
        <div><dt>Axle calibration</dt><dd>${stats.calibration || 'pending — press Play'}</dd></div>
      `
    },
  }
}
