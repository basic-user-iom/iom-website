import type { ViewerEngine } from '../ViewerEngine'
import type { StaticSceneStats } from '../scene/SceneAnalyzer'
import type { LiveRenderStats } from '../performance/PerformanceMonitor'
import type { AnimationTransportState, ModelManifestEntry } from '../scene/types'
import type { CameraViewListItem } from '../controls/CameraViews'
import { DAYLIGHT_PRESETS, type DaylightPresetId } from '../lighting/DaylightPresets'
import { QUALITY_BUTTONS, type QualityProfileId } from '../performance/QualityManager'
import { formatBytes, formatNumber } from '../utils/formatBytes'
import { formatInspectCopy, type InspectPickInfo } from '../controls/InspectPicker'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function row(label: string, value: string): HTMLElement {
  const r = el('div', 'bv-row')
  r.append(el('span', undefined, label), el('span', undefined, value))
  return r
}

function seg(className = 'bv-seg'): HTMLElement {
  return el('div', className)
}

export class ViewerToolbar {
  private layersHost: HTMLElement
  private orbitBtn: HTMLButtonElement
  private walkExitBtn: HTMLButtonElement
  private vrBtn: HTMLButtonElement
  private resetBtn: HTMLButtonElement
  private daylightSelect: HTMLSelectElement
  private qualityButtons = new Map<QualityProfileId, HTMLButtonElement>()
  readonly walkHint: HTMLElement
  private animBar: HTMLElement
  private animPlayBtn: HTMLButtonElement
  private animPauseBtn: HTMLButtonElement
  private animStopBtn: HTMLButtonElement
  private animSlider: HTMLInputElement
  private animTime: HTMLElement
  private animLabel: HTMLElement
  private scrubbing = false
  private viewsHost: HTMLElement
  private viewsCaptureBtn: HTMLButtonElement
  private inspectBtn: HTMLButtonElement
  private inspectRail: HTMLElement
  private inspectBody: HTMLElement

  constructor(
    host: HTMLElement,
    private readonly engine: ViewerEngine,
  ) {
    const top = el('header', 'bv-top')

    const brand = el('a', 'bv-brand-block') as HTMLAnchorElement
    brand.href = 'https://locations.messe-muenchen.de/en/icm/'
    brand.target = '_blank'
    brand.rel = 'noopener noreferrer'
    brand.title = 'ICM – International Congress Center Messe München'
    const logo = document.createElement('img')
    logo.className = 'bv-brand-logo'
    logo.src = `${import.meta.env.BASE_URL}assets/messe-muenchen-logo.svg`
    logo.alt = 'Messe München'
    logo.width = 105
    logo.height = 38
    const copy = el('div', 'bv-brand-copy')
    copy.append(
      el('div', 'bv-brand', 'ICM'),
      el('div', 'bv-brand-sub', 'International Congress Center'),
      el('span', 'bv-brand-link', 'Visit website'),
    )
    brand.append(logo, copy)
    top.append(brand)

    const dock = el('nav', 'bv-dock')
    dock.setAttribute('aria-label', 'Viewer controls')

    const modeSeg = seg()
    this.orbitBtn = el('button', 'is-active', 'Orbit')
    this.orbitBtn.type = 'button'
    this.orbitBtn.title = 'Orbit camera'
    this.walkExitBtn = el('button', undefined, 'Exit Walk')
    this.walkExitBtn.type = 'button'
    this.walkExitBtn.disabled = true
    this.walkExitBtn.title = 'Return to orbit'
    this.walkExitBtn.addEventListener('click', () => this.engine.exitWalk())
    modeSeg.append(this.orbitBtn, this.walkExitBtn)

    const viewSeg = seg()
    this.resetBtn = el('button', undefined, 'Reset')
    this.resetBtn.type = 'button'
    this.resetBtn.title = 'Reset camera framing'
    this.resetBtn.addEventListener('click', () => this.engine.resetView())
    const perfBtn = el('button', undefined, 'Perf')
    perfBtn.type = 'button'
    perfBtn.title = 'Fly all camera views and download a performance JSON (desktop baseline, not Quest 72 Hz)'
    perfBtn.addEventListener('click', () => {
      if (this.engine.isPerfRouteRunning()) return
      perfBtn.disabled = true
      perfBtn.textContent = 'Recording…'
      void this.engine.runPerfRoute().finally(() => {
        perfBtn.disabled = false
        perfBtn.textContent = 'Perf'
      })
    })
    this.vrBtn = el('button', undefined, 'VR')
    this.vrBtn.type = 'button'
    this.vrBtn.disabled = true
    this.vrBtn.addEventListener('click', () => void this.engine.enterVr())
    this.inspectBtn = el('button', undefined, 'Inspect')
    this.inspectBtn.type = 'button'
    this.inspectBtn.title = 'Click a surface to see its object name, material, and layer'
    this.inspectBtn.addEventListener('click', () => {
      const next = !this.engine.isInspectEnabled()
      this.engine.setInspectEnabled(next)
      this.setInspectMode(next)
    })
    viewSeg.append(this.resetBtn, perfBtn, this.vrBtn, this.inspectBtn)

    const lightField = el('label', 'bv-field')
    lightField.append(el('span', 'bv-field-label', 'Light'))
    this.daylightSelect = el('select')
    this.daylightSelect.title = 'Lighting preset'
    for (const preset of Object.values(DAYLIGHT_PRESETS)) {
      const opt = el('option')
      opt.value = preset.id
      opt.textContent = preset.label
      this.daylightSelect.append(opt)
    }
    this.daylightSelect.value = 'daylight'
    this.daylightSelect.addEventListener('change', () => {
      void this.engine.setDaylightPreset(this.daylightSelect.value as DaylightPresetId)
    })
    lightField.append(this.daylightSelect)

    const qualitySeg = seg('bv-seg bv-quality')
    qualitySeg.append(el('span', 'bv-field-label', 'Quality'))
    for (const q of QUALITY_BUTTONS) {
      const btn = el('button', undefined, q.label)
      btn.type = 'button'
      btn.dataset.quality = q.id
      btn.title = `${q.label} quality`
      btn.addEventListener('click', () => {
        void this.engine.setQuality(q.id)
      })
      this.qualityButtons.set(q.id, btn)
      qualitySeg.append(btn)
    }
    this.setQuality(this.engine.quality.getPreferred())

    dock.append(modeSeg, viewSeg, lightField, qualitySeg)
    top.append(dock)
    host.append(top)

    // Layers — left rail (contextual, always available)
    const layersRail = el('aside', 'bv-layers-rail')
    layersRail.setAttribute('aria-label', 'Model layers')
    layersRail.append(el('div', 'bv-rail-title', 'Layers'))
    this.layersHost = el('div', 'bv-layers-list')
    layersRail.append(this.layersHost)
    host.append(layersRail)

    // Views — camera bookmarks (automotive-studio Shots equivalent)
    const viewsRail = el('aside', 'bv-views-rail')
    viewsRail.setAttribute('aria-label', 'Camera views')
    viewsRail.append(el('div', 'bv-rail-title', 'Views'))

    const viewsActions = el('div', 'bv-views-actions')
    this.viewsCaptureBtn = el('button', 'bv-views-capture', 'Capture')
    this.viewsCaptureBtn.type = 'button'
    this.viewsCaptureBtn.title = 'Save the current camera as a view'
    this.viewsCaptureBtn.addEventListener('click', () => this.engine.captureCameraView())
    const exportBtn = el('button', 'bv-views-export', 'Export')
    exportBtn.type = 'button'
    exportBtn.title = 'Download views JSON to share / use as defaults'
    exportBtn.addEventListener('click', () => this.engine.exportCameraViews())
    viewsActions.append(this.viewsCaptureBtn, exportBtn)
    viewsRail.append(viewsActions)

    this.viewsHost = el('div', 'bv-views-list')
    viewsRail.append(this.viewsHost)
    host.append(viewsRail)

    const inspectRail = el('aside', 'bv-inspect-rail')
    inspectRail.setAttribute('aria-label', 'Object inspect')
    inspectRail.hidden = true
    inspectRail.append(el('div', 'bv-rail-title', 'Inspect'))
    this.inspectBody = el('div', 'bv-inspect-body')
    this.inspectBody.append(
      el('div', 'bv-inspect-hint', 'Click a surface in the view. Drag still orbits.'),
    )
    inspectRail.append(this.inspectBody)
    host.append(inspectRail)
    this.inspectRail = inspectRail

    // Animation — bottom transport (appears when clips exist)
    this.animBar = el('div', 'bv-transport')
    this.animBar.setAttribute('role', 'group')
    this.animBar.setAttribute('aria-label', 'Animation playback')
    this.animLabel = el('span', 'bv-transport-label', 'Animation')
    const transportBtns = seg('bv-seg bv-transport-btns')
    this.animPlayBtn = el('button', undefined, 'Play')
    this.animPauseBtn = el('button', undefined, 'Pause')
    this.animStopBtn = el('button', undefined, 'Stop')
    this.animPlayBtn.type = 'button'
    this.animPauseBtn.type = 'button'
    this.animStopBtn.type = 'button'
    transportBtns.append(this.animPlayBtn, this.animPauseBtn, this.animStopBtn)

    this.animSlider = document.createElement('input')
    this.animSlider.type = 'range'
    this.animSlider.min = '0'
    this.animSlider.max = '1000'
    this.animSlider.value = '0'
    this.animSlider.className = 'bv-anim-slider'
    this.animSlider.setAttribute('aria-label', 'Animation time')
    this.animTime = el('span', 'bv-anim-time', '0.0 / 0.0 s')

    this.animPlayBtn.addEventListener('click', () => this.engine.playAnimation())
    this.animPauseBtn.addEventListener('click', () => this.engine.pauseAnimation())
    this.animStopBtn.addEventListener('click', () => this.engine.stopAnimation())
    this.animSlider.addEventListener('pointerdown', (e) => {
      this.scrubbing = true
      try {
        this.animSlider.setPointerCapture(e.pointerId)
      } catch {
        // ignore — capture is best-effort
      }
      this.engine.pauseAnimation()
    })
    this.animSlider.addEventListener('input', () => {
      const u = Number(this.animSlider.value) / 1000
      this.engine.seekAnimationNormalized(u)
      // Keep time label in sync even if engine UI emit is throttled.
      const dur = this.engine.getAnimationState().duration
      const t = u * dur
      this.animTime.textContent = `${t.toFixed(1)} / ${dur.toFixed(1)} s`
    })
    const endScrub = () => {
      this.scrubbing = false
    }
    this.animSlider.addEventListener('pointerup', endScrub)
    this.animSlider.addEventListener('pointercancel', endScrub)
    this.animSlider.addEventListener('change', endScrub)

    this.animBar.append(this.animLabel, transportBtns, this.animSlider, this.animTime)
    this.animBar.hidden = true
    host.append(this.animBar)

    this.walkHint = el('div', 'bv-walk-hint', 'WASD walk · Space jump · Shift run · V camera · Esc unlock')
    host.append(this.walkHint)
  }

  setModels(models: ModelManifestEntry[], visibleIds: string[]): void {
    this.layersHost.innerHTML = ''
    if (models.length === 0) {
      this.layersHost.append(el('span', 'bv-layers-empty', 'No models loaded'))
      return
    }
    const visible = new Set(visibleIds)
    for (const m of models) {
      if (m.hideInLayerList) continue
      const on = visible.has(m.id)
      const btn = el('button', on ? 'bv-layer-btn is-on' : 'bv-layer-btn is-off')
      btn.type = 'button'
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      btn.title = on ? `Hide ${m.name}` : `Show ${m.name}`
      const sw = el('span', 'bv-layer-swatch')
      const name = el('span', 'bv-layer-name', m.name)
      const state = el('span', 'bv-layer-state', on ? 'On' : 'Off')
      btn.append(sw, name, state)
      btn.addEventListener('click', () => {
        void this.engine.ensureLayer(m.id, !on)
      })
      this.layersHost.append(btn)
    }
  }

  setCameraViews(views: CameraViewListItem[], activeId: string | null): void {
    this.viewsHost.innerHTML = ''
    if (views.length === 0) {
      this.viewsHost.append(el('span', 'bv-views-empty', 'No views yet — Capture to save one'))
      return
    }
    for (const view of views) {
      const row = el('div', activeId === view.id ? 'bv-view-row is-active' : 'bv-view-row')
      const go = el('button', 'bv-view-go')
      go.type = 'button'
      go.title = `Go to ${view.name}`
      go.setAttribute('aria-pressed', activeId === view.id ? 'true' : 'false')

      if (view.thumbnailDataUrl) {
        const img = document.createElement('img')
        img.className = 'bv-view-thumb'
        img.src = view.thumbnailDataUrl
        img.alt = ''
        img.width = 56
        img.height = 34
        img.decoding = 'async'
        go.append(img)
      } else {
        const badge = el('span', 'bv-view-badge', view.name.trim().charAt(0).toUpperCase() || 'V')
        go.append(badge)
      }

      const meta = el('span', 'bv-view-meta')
      meta.append(el('span', 'bv-view-name', view.name))
      if (view.builtIn) meta.append(el('span', 'bv-view-tag', 'Default'))
      go.append(meta)
      go.addEventListener('click', () => this.engine.goToCameraView(view.id))
      row.append(go)

      if (!view.builtIn) {
        const del = el('button', 'bv-view-delete', '×')
        del.type = 'button'
        del.title = `Delete ${view.name}`
        del.addEventListener('click', (e) => {
          e.stopPropagation()
          this.engine.deleteCameraView(view.id)
        })
        row.append(del)
      }
      this.viewsHost.append(row)
    }
  }

  setInspectMode(on: boolean): void {
    this.inspectBtn.classList.toggle('is-active', on)
    this.inspectRail.hidden = !on
    if (!on) {
      this.inspectBody.replaceChildren(
        el('div', 'bv-inspect-hint', 'Click a surface in the view. Drag still orbits.'),
      )
    }
  }

  setInspectPick(info: InspectPickInfo | null): void {
    if (this.inspectRail.hidden) return
    this.inspectBody.replaceChildren()
    if (!info) {
      this.inspectBody.append(
        el('div', 'bv-inspect-hint', 'Click a surface in the view. Drag still orbits.'),
      )
      return
    }

    this.inspectBody.append(
      row('Name', info.name),
      row('Layer', info.layerId),
      row('Path', info.path),
      row('Type', info.objectType),
      row('Material', info.materialNames.join(', ') || '—'),
      row('Side', info.side),
      row('Tris', formatNumber(info.triangles)),
      row('Size m', `${info.sizeM.x} × ${info.sizeM.y} × ${info.sizeM.z}`),
      row('Flags', info.flags.join(', ') || '—'),
    )
    if (info.instanceId != null) {
      this.inspectBody.append(row('Instance', String(info.instanceId)))
    }

    const actions = el('div', 'bv-inspect-actions')
    const copyBtn = el('button', undefined, 'Copy')
    copyBtn.type = 'button'
    copyBtn.title = 'Copy this object dump to paste into chat'
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(formatInspectCopy(info)).then(
        () => {
          copyBtn.textContent = 'Copied'
          window.setTimeout(() => {
            copyBtn.textContent = 'Copy'
          }, 1200)
        },
        () => {
          copyBtn.textContent = 'Copy failed'
        },
      )
    })
    const hideBtn = el('button', undefined, 'Hide')
    hideBtn.type = 'button'
    hideBtn.title = 'Hide this object (does not save into the GLB)'
    hideBtn.addEventListener('click', () => this.engine.hideInspected())
    const isoBtn = el('button', undefined, 'Isolate')
    isoBtn.type = 'button'
    isoBtn.title = 'Hide every other mesh'
    isoBtn.addEventListener('click', () => this.engine.isolateInspected())
    const restoreBtn = el('button', undefined, 'Restore')
    restoreBtn.type = 'button'
    restoreBtn.title = 'Show objects hidden by Hide / Isolate'
    restoreBtn.addEventListener('click', () => this.engine.restoreInspected())
    actions.append(copyBtn, hideBtn, isoBtn, restoreBtn)
    this.inspectBody.append(actions)
  }

  setAnimation(state: AnimationTransportState): void {
    this.animBar.hidden = !state.available
    document.documentElement.classList.toggle('bv-has-transport', state.available)
    if (!state.available) return
    this.animLabel.textContent = state.label || 'Animation'
    this.animPlayBtn.disabled = state.playing
    this.animPauseBtn.disabled = !state.playing
    this.animTime.textContent = `${state.time.toFixed(1)} / ${state.duration.toFixed(1)} s`
    if (!this.scrubbing && state.duration > 0) {
      this.animSlider.value = String(Math.round((state.time / state.duration) * 1000))
    }
  }

  setMode(mode: 'orbit' | 'walk'): void {
    this.orbitBtn.classList.toggle('is-active', mode === 'orbit')
    this.walkExitBtn.disabled = mode !== 'walk'
    this.walkExitBtn.classList.toggle('is-active', mode === 'walk')
    this.walkHint.classList.toggle('show', mode === 'walk')
    document.documentElement.classList.toggle('bv-mode-walk', mode === 'walk')
    if (mode === 'walk') this.setInspectMode(false)
  }

  setWalkLock(locked: boolean): void {
    this.walkHint.classList.toggle('is-locked', locked)
    this.walkHint.textContent = locked
      ? 'WASD · Space jump · Shift run · V first/third · Esc unlock'
      : 'Click view to look · WASD walk · Space jump · Exit Walk to return'
  }

  setDaylight(id: DaylightPresetId): void {
    this.daylightSelect.value = id
  }

  setQuality(id: QualityProfileId): void {
    for (const [qid, btn] of this.qualityButtons) {
      btn.classList.toggle('is-active', qid === id)
    }
  }

  setXrSupported(supported: boolean): void {
    this.vrBtn.disabled = !supported
    this.vrBtn.title = supported ? 'Enter immersive VR' : 'WebXR not available'
  }
}

export class StatsPanel {
  private body: HTMLElement
  private root: HTMLElement
  private fpsChip: HTMLButtonElement
  private copyBtn: HTMLButtonElement
  private liveHost: HTMLElement | null = null
  /** Persist open/closed section state across live-stat refreshes. */
  private openSections = new Set<string>(['performance', 'instancing'])

  constructor(host: HTMLElement) {
    this.fpsChip = el('button', 'bv-fps-chip', '— FPS')
    this.fpsChip.type = 'button'
    this.fpsChip.title = 'Toggle scene statistics'
    this.fpsChip.addEventListener('click', () => this.toggle())

    this.root = el('div', 'bv-panel collapsed')
    const header = el('div', 'bv-panel-header')
    this.copyBtn = el('button', 'bv-stats-copy', 'Copy all')
    this.copyBtn.type = 'button'
    this.copyBtn.title = 'Copy all statistics as text to paste into chat'
    this.copyBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      void this.copyAll()
    })
    header.append(el('h2', undefined, 'Statistics'), this.copyBtn, el('span', 'bv-chevron', '▾'))
    header.addEventListener('click', () => this.toggle())
    this.body = el('div', 'bv-panel-body')
    this.body.innerHTML = '<div class="bv-muted">Load a model to see statistics.</div>'
    this.root.append(header, this.body)

    const cluster = el('div', 'bv-stats-cluster')
    cluster.append(this.fpsChip, this.root)
    host.append(cluster)
  }

  private toggle(): void {
    this.root.classList.toggle('collapsed')
  }

  private section(
    id: string,
    title: string,
    content: HTMLElement[],
    opts?: { badge?: string; defaultOpen?: boolean },
  ): HTMLElement {
    const open = this.openSections.has(id) || (opts?.defaultOpen && !this.openSections.has(`closed:${id}`))
    if (open) this.openSections.add(id)

    const wrap = el('div', `bv-acc${open ? ' is-open' : ''}`)
    wrap.dataset.section = id

    const btn = el('button', 'bv-acc-trigger')
    btn.type = 'button'
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    const label = el('span', 'bv-acc-label', title)
    const meta = el('span', 'bv-acc-meta', opts?.badge ?? '')
    const chev = el('span', 'bv-acc-chevron', '▾')
    btn.append(label, meta, chev)

    const panel = el('div', 'bv-acc-panel')
    for (const node of content) panel.append(node)

    btn.addEventListener('click', () => {
      const next = !wrap.classList.contains('is-open')
      wrap.classList.toggle('is-open', next)
      btn.setAttribute('aria-expanded', next ? 'true' : 'false')
      if (next) this.openSections.add(id)
      else this.openSections.delete(id)
    })

    wrap.append(btn, panel)
    return wrap
  }

  renderStatic(stats: StaticSceneStats | null): void {
    if (!stats) return
    const frag = document.createDocumentFragment()

    frag.append(
      this.section('geometry', 'Geometry', [
        row('Scene nodes', formatNumber(stats.objects)),
        row('Meshes', formatNumber(stats.meshes)),
        row('InstancedMesh', formatNumber(stats.instancedMeshes)),
        row('BatchedMesh', formatNumber(stats.batchedMeshes)),
        row('Skinned meshes', formatNumber(stats.skinnedMeshes)),
        row('Vertices (unique buffers)', formatNumber(stats.vertices)),
        row('Triangles (unique buffers)', formatNumber(stats.triangles)),
        row('Triangles (expanded instances)', formatNumber(stats.drawnTriangles)),
        row('Mesh submissions', formatNumber(stats.primitiveCount)),
        row('Geometries', formatNumber(stats.geometryCount)),
      ], { badge: formatNumber(stats.triangles) }),
    )

    const matRows: HTMLElement[] = [
      row('Materials', formatNumber(stats.uniqueMaterials)),
      row('Double-sided', formatNumber(stats.doubleSidedMaterials)),
      row('Transparent', formatNumber(stats.transparentMaterials)),
      row('Transmission', formatNumber(stats.transmissionMaterials)),
      row('Missing UV0 (textured)', formatNumber(stats.missingUv0)),
      row('UV0 outside [0,1]', formatNumber(stats.uv0OutOfRange)),
    ]
    for (const [type, count] of Object.entries(stats.materialTypes)) {
      matRows.push(row(type, formatNumber(count)))
    }
    frag.append(
      this.section('materials', 'Materials', matRows, {
        badge: formatNumber(stats.uniqueMaterials),
      }),
    )

    const texSummary: HTMLElement[] = [
      row('Unique images', formatNumber(stats.uniqueTextures)),
    ]
    const texList: HTMLElement[] = []
    for (const t of stats.textures) {
      const block = el('div', 'bv-tex')
      block.innerHTML = `<strong>${t.name}</strong><br/>${t.width} × ${t.height}<br/>${t.compressed ? 'Compressed' : t.format} · ${t.colorSpace}`
      texList.push(block)
    }
    if (texList.length) {
      texSummary.push(
        this.section('texture-list', 'Texture list', texList, {
          badge: formatNumber(stats.textures.length),
        }),
      )
    }
    frag.append(
      this.section('textures', 'Textures', texSummary, {
        badge: formatNumber(stats.uniqueTextures),
      }),
    )

    const sceneRows: HTMLElement[] = [
      row('Lights (in model)', formatNumber(stats.lights)),
      row('Cameras (in model)', formatNumber(stats.cameras)),
      row('Animations', formatNumber(stats.animations)),
      row('Bones', formatNumber(stats.bones)),
      row(
        'AABB size XYZ',
        `${stats.dimensions.x.toFixed(2)} / ${stats.dimensions.y.toFixed(2)} / ${stats.dimensions.z.toFixed(2)}`,
      ),
    ]
    if (stats.fileSizeBytes != null) {
      sceneRows.push(row('File', formatBytes(stats.fileSizeBytes)))
    }
    if (stats.transferredBytes != null && stats.transferredBytes !== stats.fileSizeBytes) {
      sceneRows.push(row('Transferred', formatBytes(stats.transferredBytes)))
    }
    sceneRows.push(row('Download', `${stats.downloadMs.toFixed(0)} ms`))
    sceneRows.push(row('Parse', `${stats.parseMs.toFixed(0)} ms`))
    if (stats.collisionMs != null) {
      sceneRows.push(row('Collision/BVH', `${stats.collisionMs.toFixed(0)} ms`))
    }
    frag.append(this.section('scene', 'Scene', sceneRows))

    if (stats.instancing) {
      const instRows: HTMLElement[] = [
        row('Groups', formatNumber(stats.instancing.groupsConverted)),
        row('Meshes packed', formatNumber(stats.instancing.meshesReplaced)),
        row('Instanced', formatNumber(stats.instancing.instancesCreated ?? 0)),
        row('Batched sources', formatNumber(stats.instancing.batchedSources ?? 0)),
        row('Batched meshes', formatNumber(stats.instancing.batchedMeshes ?? 0)),
      ]
      for (const g of stats.instancing.topGroups) {
        const kind = g.kind === 'batch' ? 'batch' : 'inst'
        const value =
          g.kind === 'instance'
            ? `${formatNumber(g.triangles)} tris each`
            : `${formatNumber(g.triangles)} tris packed`
        instRows.push(row(`[${kind}] ${g.name || 'mesh'} ×${g.count}`, value))
      }
      const note = el('div', 'bv-muted', stats.instancing.note)
      instRows.push(note)
      frag.append(
        this.section('instancing', 'Instancing / Batch', instRows, {
          badge: formatNumber(stats.instancing.meshesReplaced),
          defaultOpen: true,
        }),
      )
    }

    const liveSection = this.section('performance', 'Performance', [], {
      badge: 'live',
    })
    this.liveHost = liveSection.querySelector('.bv-acc-panel') as HTMLElement
    frag.append(liveSection)

    this.body.innerHTML = ''
    this.body.append(frag)
  }

  renderLive(stats: LiveRenderStats): void {
    const fps = stats.fps
    this.fpsChip.textContent = `${fps.toFixed(0)} FPS`
    this.fpsChip.classList.toggle('is-low', fps > 0 && fps < 30)
    this.fpsChip.classList.toggle('is-ok', fps >= 45)

    let host = this.liveHost
    if (!host || !host.isConnected) {
      host = this.body.querySelector('[data-section="performance"] .bv-acc-panel') as HTMLElement | null
      this.liveHost = host
    }
    if (!host) return

    const meta = this.body.querySelector('[data-section="performance"] .bv-acc-meta')
    if (meta) meta.textContent = `${stats.fps.toFixed(0)} fps`

    host.innerHTML = ''
    const rows: HTMLElement[] = [
      row('FPS', stats.fps.toFixed(1)),
      row('Avg FPS', stats.avgFps.toFixed(1)),
      row('RAF interval', `${stats.frameTimeMs.toFixed(2)} ms`),
      row('Worst RAF (250 ms)', `${stats.worstFrameMs.toFixed(2)} ms`),
      row(
        'RAF p50/p95/p99',
        `${stats.rafMedianMs.toFixed(2)} / ${stats.rafP95Ms.toFixed(2)} / ${stats.rafP99Ms.toFixed(2)} ms`,
      ),
      row('JS CPU', `${stats.jsCpuMs.toFixed(2)} ms`),
      row('CPU walk', `${stats.cpuWalkMs.toFixed(2)} ms`),
      row('CPU anim', `${stats.cpuAnimMs.toFixed(2)} ms`),
      row('CPU LOD', `${stats.cpuLodMs.toFixed(2)} ms`),
      row('CPU render+', `${stats.cpuRenderMs.toFixed(2)} ms`),
      row(
        'JS CPU p50/p95/p99',
        `${stats.cpuMedianMs.toFixed(2)} / ${stats.cpuP95Ms.toFixed(2)} / ${stats.cpuP99Ms.toFixed(2)} ms`,
      ),
    ]
    if (stats.gpuFrameMs != null) {
      rows.push(row('GPU frame', `${stats.gpuFrameMs.toFixed(2)} ms`))
      if (stats.gpuMedianMs != null) {
        rows.push(
          row(
            'GPU p50/p95/p99',
            `${stats.gpuMedianMs.toFixed(2)} / ${stats.gpuP95Ms!.toFixed(2)} / ${stats.gpuP99Ms!.toFixed(2)} ms`,
          ),
        )
      }
    }
    rows.push(
      row('Drawing buffer', `${stats.width} × ${stats.height}`),
      row('DPR', stats.pixelRatio.toFixed(2)),
      row('Draw calls (incl. shadows)', formatNumber(stats.drawCalls)),
      row('Triangles submitted (incl. shadows)', formatNumber(stats.triangles)),
    )
    if (stats.points > 0) rows.push(row('Points', formatNumber(stats.points)))
    if (stats.lines > 0) rows.push(row('Lines', formatNumber(stats.lines)))
    rows.push(
      row('Quality', stats.qualityProfile),
      row('Detail LOD', stats.detailLod),
      row('Collision', stats.collision),
      row('Renderer', stats.renderer),
      row(
        'XR',
        stats.xrActive
          ? `active${stats.xrFrameRate != null ? ` · ${stats.xrFrameRate} Hz` : ''}${stats.xrFoveation != null ? ` · fov ${stats.xrFoveation.toFixed(2)}` : ''}`
          : 'off',
      ),
    )
    host.append(...rows)
  }

  private sessionContext(): string[] {
    const layers = [...document.querySelectorAll('.bv-layer-btn')].map((btn) => {
      const name = btn.querySelector('.bv-layer-name')?.textContent?.trim() || 'layer'
      const on = btn.classList.contains('is-on')
      return `${name}: ${on ? 'On' : 'Off'}`
    })
    const quality = document.querySelector('.bv-quality button.is-active')?.textContent?.trim() || '—'
    const view = document.querySelector('.bv-view-row.is-active .bv-view-name')?.textContent?.trim() || '—'
    const mode = document.documentElement.classList.contains('bv-mode-walk') ? 'walk' : 'orbit'
    const light = (document.querySelector('.bv-field select') as HTMLSelectElement | null)
      ?.selectedOptions[0]?.textContent?.trim()
    const animLabel = document.querySelector('.bv-transport-label')?.textContent?.trim()
    const animTime = document.querySelector('.bv-anim-time')?.textContent?.trim()
    return [
      `URL: ${location.href}`,
      `Time: ${new Date().toISOString()}`,
      `Mode: ${mode}`,
      `View: ${view}`,
      `Quality UI: ${quality}`,
      `Light: ${light || '—'}`,
      `Layers: ${layers.length ? layers.join('; ') : '—'}`,
      `Animation: ${animLabel || '—'} ${animTime || ''}`.trim(),
    ]
  }

  private dumpPanel(): string[] {
    const lines: string[] = []
    const walk = (section: Element) => {
      const title = section.querySelector(':scope > .bv-acc-trigger .bv-acc-label')?.textContent?.trim()
      const panel = section.querySelector(':scope > .bv-acc-panel')
      if (!title || !panel) return
      lines.push(`## ${title}`)
      for (const child of Array.from(panel.children)) {
        if (child.classList.contains('bv-row')) {
          const [label, value] = Array.from(child.querySelectorAll(':scope > span'))
          const left = label?.textContent?.trim()
          const right = value?.textContent?.trim()
          if (left && right) lines.push(`${left}: ${right}`)
        } else if (child.classList.contains('bv-tex')) {
          const text = (child as HTMLElement).innerText.replace(/\s*\n\s*/g, ' · ').trim()
          if (text) lines.push(`- ${text}`)
        } else if (child.classList.contains('bv-muted')) {
          const text = child.textContent?.trim()
          if (text) lines.push(text)
        } else if (child.classList.contains('bv-acc')) {
          walk(child)
        }
      }
      lines.push('')
    }
    for (const section of this.body.querySelectorAll(':scope > .bv-acc')) {
      walk(section)
    }
    if (lines.length === 0) {
      const fallback = this.body.textContent?.trim()
      if (fallback) lines.push(fallback, '')
    }
    return lines
  }

  formatDump(): string {
    return ['IOM_BV_STATS_V2', ...this.sessionContext(), '', ...this.dumpPanel()].join('\n').trim() + '\n'
  }

  async copyAll(): Promise<void> {
    const text = this.formatDump()
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.append(ta)
      ta.select()
      ok = document.execCommand('copy')
      ta.remove()
    }
    const prev = this.copyBtn.textContent
    this.copyBtn.textContent = ok ? 'Copied' : 'Copy failed'
    this.copyBtn.classList.toggle('is-ok', ok)
    this.copyBtn.classList.toggle('is-bad', !ok)
    window.setTimeout(() => {
      this.copyBtn.textContent = prev || 'Copy all'
      this.copyBtn.classList.remove('is-ok', 'is-bad')
    }, 1600)
  }
}

export class LoadingScreen {
  private root: HTMLElement
  private title: HTMLElement
  private stage: HTMLElement
  private bar: HTMLElement
  private fill: HTMLElement

  constructor(host: HTMLElement) {
    this.root = el('div', 'bv-loading')
    const card = el('div', 'bv-loading-card')
    this.title = el('div', 'title', 'ICM Building Viewer')
    this.stage = el('div', 'stage', 'Starting…')
    this.bar = el('div', 'bv-progress indeterminate')
    this.fill = el('i')
    this.bar.append(this.fill)
    card.append(this.title, this.stage, this.bar)
    this.root.append(card)
    host.append(this.root)
  }

  set(message: string, ratio: number | null): void {
    this.root.classList.remove('hidden')
    this.stage.textContent = message
    if (ratio == null || !Number.isFinite(ratio)) {
      this.bar.classList.add('indeterminate')
      this.fill.style.width = '40%'
      // Don't leave a stale "0%" title when the server omitted Content-Length.
      this.title.textContent = /MB|Parsing|Decoding|Preparing|Compiling|Instancing|collision/i.test(message)
        ? message
        : 'Loading…'
    } else {
      this.bar.classList.remove('indeterminate')
      const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100)
      this.fill.style.width = `${pct}%`
      this.title.textContent = `Loading… ${pct}%`
    }
  }

  hide(): void {
    this.root.classList.add('hidden')
  }
}

export class PegmanControl {
  readonly status: HTMLElement

  constructor(host: HTMLElement, onDragStart: (e: PointerEvent) => void) {
    const root = el('button', 'bv-pegman')
    root.type = 'button'
    root.title = 'Drag onto a floor to start walking'
    root.setAttribute('aria-label', 'Drag person onto floor to walk')

    const figure = el('span', 'bv-pegman-figure')
    // Masked /assets/pegman.svg so CSS currentColor tints ICM magenta.
    const icon = el('span', 'bv-pegman-icon')
    icon.setAttribute('aria-hidden', 'true')
    figure.append(icon)

    const meta = el('span', 'bv-pegman-meta')
    meta.append(el('strong', undefined, 'Walk'), el('em', undefined, 'Drag to place'))

    root.append(figure, meta)
    root.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onDragStart(e)
    })
    host.append(root)

    this.status = el('div', 'bv-pegman-status')
    host.append(this.status)
  }
}

export function mountDropTarget(
  host: HTMLElement,
  onFile: (file: File) => void,
): void {
  const overlay = el('div', 'bv-drop-overlay', 'Drop GLB to preview')
  host.append(overlay)

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    overlay.classList.add('active')
  }
  const onDragLeave = () => overlay.classList.remove('active')
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    overlay.classList.remove('active')
    const file = e.dataTransfer?.files?.[0]
    if (file && /\.glb$/i.test(file.name)) onFile(file)
  }
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
}

export function showToast(host: HTMLElement, message: string): void {
  let toast = host.querySelector('.bv-toast') as HTMLElement | null
  if (!toast) {
    toast = el('div', 'bv-toast')
    host.append(toast)
  }
  toast.textContent = message
  toast.classList.add('show')
  window.setTimeout(() => toast?.classList.remove('show'), 3200)
}
