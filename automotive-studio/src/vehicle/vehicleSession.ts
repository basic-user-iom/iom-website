import type { AnimationClip, Object3D, Scene, WebGLRenderer } from 'three'
import { Vector3 } from 'three'
import { analyzeGltfScene, type AssetCompatibilityReport } from '../assets/analyzeAsset'
import { disposeObject3D, revokeObjectUrl } from '../assets/disposeObject'
import { importGlbFile, formatBytes } from '../assets/importGlb'
import { AnimationController } from '../animation/animationController'
import {
  applyNormalization,
  createVehicleRoots,
  defaultNormalizationFromBounds,
  frameCameraToObject,
  measuredLengthMetres,
  type VehicleNormalization,
  type VehicleRoots,
} from '../vehicle/normalizeVehicle'
import { idbDeleteAssetBlob, idbGetAssetBlob, idbPutAssetBlob } from '../persistence/localDb'
import type { AssetRecord, VehicleRigManifest, VehicleState } from '../persistence/schema'
import {
  assetRoleForImport,
  inferQualityRoleFromFilename,
  isVehicleQualityRole,
  parseRigManifestJson,
  qualityLabel,
  validateRigBindings,
  type VehicleQualityRole,
  type VariantSlotInfo,
} from './qualityVariants'

export type ImportRole = 'replace-vehicle' | 'add-prop'

export type VehicleSessionSnapshot = {
  report: AssetCompatibilityReport | null
  normalization: VehicleNormalization | null
  measured: { length: number; width: number; height: number } | null
  clips: Array<{ name: string; duration: number; trackCount: number }>
  activeClipIndex: number
  role: ImportRole | null
  activeQuality: VehicleQualityRole | null
  variants: VariantSlotInfo[]
  rigBound: boolean
  rigMissing: string[]
}

/**
 * Owns the live Active Vehicle graph, mixer, and blob URL lifecycle.
 * ProjectStore holds serializable metadata only.
 */
export class VehicleSession {
  private scene: Scene | null = null
  private camera: { position: Vector3; lookAt: (x: number, y: number, z: number) => void } | null = null
  private controls: { target: Vector3; update: () => void } | null = null
  private renderer: WebGLRenderer | null = null
  private roots: VehicleRoots | null = null
  private propRoots: Object3D[] = []
  private clips: AnimationClip[] = []
  private objectUrl: string | null = null
  private report: AssetCompatibilityReport | null = null
  private normalization: VehicleNormalization | null = null
  private role: ImportRole | null = null
  private activeQuality: VehicleQualityRole | null = null
  private variants = new Map<VehicleQualityRole, VariantSlotInfo>()
  private rig: VehicleRigManifest | null = null
  private rigMissing: string[] = []
  private anim = new AnimationController()
  private activeClipIndex = 0
  private lastFrame = performance.now()

  bindScene(
    scene: Scene,
    camera: { position: Vector3; lookAt: (x: number, y: number, z: number) => void },
    renderer?: WebGLRenderer | null,
    controls?: { target: Vector3; update: () => void } | null,
  ) {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer ?? null
    this.controls = controls ?? null
  }

  getPlacementRoot() {
    return this.roots?.placement ?? null
  }

  getRig() {
    return this.rig
  }

  getSnapshot(): VehicleSessionSnapshot {
    const measured = this.roots ? measuredLengthMetres(this.roots) : null
    return {
      report: this.report,
      normalization: this.normalization,
      measured,
      clips: this.anim.listClips(),
      activeClipIndex: this.activeClipIndex,
      role: this.role,
      activeQuality: this.activeQuality,
      variants: [...this.variants.values()],
      rigBound: Boolean(this.rig) && this.rigMissing.length === 0,
      rigMissing: this.rigMissing.slice(),
    }
  }

  async importFile(
    file: File,
    role: ImportRole,
    onProgress?: (ratio: number, label: string) => void,
    quality: VehicleQualityRole | 'auto' = 'auto',
  ): Promise<{ asset: AssetRecord; vehicle: VehicleState | null; report: AssetCompatibilityReport }> {
    if (!this.scene) throw new Error('Scene not bound')

    onProgress?.(0, `Reading ${file.name} (${formatBytes(file.size)})…`)
    if (file.size > 120 * 1024 * 1024) {
      onProgress?.(0.02, `Large model (${formatBytes(file.size)}) — parsing may take a while…`)
    }

    const loaded = await importGlbFile(file, {
      renderer: this.renderer,
      onProgress: (p) => onProgress?.(Math.min(0.85, p.ratio * 0.85), `Loading ${formatBytes(p.loaded)}…`),
    })

    onProgress?.(0.9, 'Analysing asset…')
    const parserJson = (loaded.gltf.parser?.json ?? null) as Record<string, unknown> | null
    const report = analyzeGltfScene({
      scene: loaded.gltf.scene,
      animations: loaded.gltf.animations,
      filename: loaded.filename,
      byteSize: loaded.byteSize,
      parserJson,
    })

    const assetRole = assetRoleForImport(quality, file.name, role === 'add-prop')
    const assetId = crypto.randomUUID()
    await idbPutAssetBlob(assetId, file, { filename: file.name })

    const asset: AssetRecord = {
      id: assetId,
      role: assetRole,
      filename: file.name,
      byteSize: file.size,
      blobKey: assetId,
      contentHash: report.checksumHint,
    }

    if (role === 'replace-vehicle') {
      const qualityRole: VehicleQualityRole = isVehicleQualityRole(assetRole)
        ? assetRole
        : inferQualityRoleFromFilename(file.name)
      const preserveNorm = this.normalization ? { ...this.normalization } : null
      const preserveRig = this.rig
      const prevSlot = this.variants.get(qualityRole)
      if (prevSlot && prevSlot.assetId !== assetId) {
        void idbDeleteAssetBlob(prevSlot.assetId)
      }

      this.disposeSceneGraphOnly()
      revokeObjectUrl(this.objectUrl)
      this.objectUrl = loaded.objectUrl

      const roots = createVehicleRoots(loaded.gltf.scene, file.name)
      const size = new Vector3(report.bounds.x, report.bounds.y, report.bounds.z)
      const normalization = preserveNorm ?? defaultNormalizationFromBounds(size)
      applyNormalization(roots, normalization)
      this.scene.add(roots.placement)
      this.roots = roots
      this.clips = loaded.gltf.animations.slice()
      this.anim.attach(roots.action, this.clips)
      this.normalization = normalization
      this.report = report
      this.role = role
      this.activeQuality = qualityRole
      this.activeClipIndex = 0
      this.variants.set(qualityRole, {
        role: qualityRole,
        assetId,
        filename: file.name,
        byteSize: file.size,
      })

      if (preserveRig) this.applyRig(preserveRig)
      else {
        this.rig = null
        this.rigMissing = []
      }

      if (this.camera && !preserveNorm) frameCameraToObject(this.camera, roots.placement, this.controls)

      const measured = measuredLengthMetres(roots)
      const vehicle = this.buildVehicleState(assetId, file.name, measured, report, qualityRole)

      onProgress?.(1, `Vehicle ready (${qualityLabel(qualityRole)})`)
      return { asset, vehicle, report }
    }

    // Prop path — no automotive normalization wrapper.
    const prop = loaded.gltf.scene
    prop.userData.iomRole = 'prop'
    this.scene.add(prop)
    this.propRoots.push(prop)
    revokeObjectUrl(loaded.objectUrl)
    onProgress?.(1, 'Prop added')
    this.report = report
    this.role = role
    return { asset, vehicle: null, report }
  }

  /**
   * Switch among already-imported quality slots. Placement/normalization preserved.
   */
  async switchQuality(
    role: VehicleQualityRole,
    onProgress?: (ratio: number, label: string) => void,
  ): Promise<{ asset: AssetRecord; vehicle: VehicleState; report: AssetCompatibilityReport }> {
    if (!this.scene) throw new Error('Scene not bound')
    const slot = this.variants.get(role)
    if (!slot) throw new Error(`No ${qualityLabel(role)} variant imported yet`)
    if (this.activeQuality === role && this.roots) {
      const measured = measuredLengthMetres(this.roots)
      return {
        asset: {
          id: slot.assetId,
          role,
          filename: slot.filename,
          byteSize: slot.byteSize,
          blobKey: slot.assetId,
          contentHash: this.report?.checksumHint,
        },
        vehicle: this.buildVehicleState(slot.assetId, slot.filename, measured, this.report!, role),
        report: this.report!,
      }
    }

    onProgress?.(0.05, `Loading ${qualityLabel(role)} variant…`)
    const blob = await idbGetAssetBlob(slot.assetId)
    if (!blob) throw new Error(`Missing IndexedDB blob for ${slot.filename}`)
    const file = new File([blob], slot.filename, { type: 'model/gltf-binary' })

    const preserveNorm = this.normalization ? { ...this.normalization } : null
    const preserveRig = this.rig

    const loaded = await importGlbFile(file, {
      renderer: this.renderer,
      onProgress: (p) => onProgress?.(Math.min(0.85, 0.1 + p.ratio * 0.75), `Loading ${formatBytes(p.loaded)}…`),
    })

    onProgress?.(0.9, 'Applying preserved placement…')
    const parserJson = (loaded.gltf.parser?.json ?? null) as Record<string, unknown> | null
    const report = analyzeGltfScene({
      scene: loaded.gltf.scene,
      animations: loaded.gltf.animations,
      filename: loaded.filename,
      byteSize: loaded.byteSize,
      parserJson,
    })

    this.disposeSceneGraphOnly()
    revokeObjectUrl(this.objectUrl)
    this.objectUrl = loaded.objectUrl

    const roots = createVehicleRoots(loaded.gltf.scene, file.name)
    const size = new Vector3(report.bounds.x, report.bounds.y, report.bounds.z)
    const normalization = preserveNorm ?? defaultNormalizationFromBounds(size)
    applyNormalization(roots, normalization)
    this.scene.add(roots.placement)
    this.roots = roots
    this.clips = loaded.gltf.animations.slice()
    this.anim.attach(roots.action, this.clips)
    this.normalization = normalization
    this.report = report
    this.role = 'replace-vehicle'
    this.activeQuality = role
    this.activeClipIndex = 0

    if (preserveRig) this.applyRig(preserveRig)

    const measured = measuredLengthMetres(roots)
    const asset: AssetRecord = {
      id: slot.assetId,
      role,
      filename: slot.filename,
      byteSize: slot.byteSize,
      blobKey: slot.assetId,
      contentHash: report.checksumHint,
    }
    const vehicle = this.buildVehicleState(slot.assetId, slot.filename, measured, report, role)
    onProgress?.(1, `Switched to ${qualityLabel(role)}`)
    return { asset, vehicle, report }
  }

  async importRigManifestFile(file: File): Promise<VehicleRigManifest> {
    const text = await file.text()
    const json = JSON.parse(text) as unknown
    const rig = parseRigManifestJson(json)
    this.applyRig(rig)
    return rig
  }

  applyRig(rig: VehicleRigManifest) {
    this.rig = rig
    if (!this.roots) {
      this.rigMissing = ['(no vehicle loaded)']
      return
    }
    const result = validateRigBindings(this.roots.model, rig)
    this.rigMissing = result.missing
  }

  private buildVehicleState(
    assetId: string,
    name: string,
    measured: { length: number; width: number; height: number },
    report: AssetCompatibilityReport,
    _quality: VehicleQualityRole,
  ): VehicleState {
    const normalization = this.normalization!
    return {
      assetId,
      name,
      lengthMetres: measured.length,
      widthMetres: measured.width,
      heightMetres: measured.height,
      grounded: true,
      forwardAxis: normalization.forwardAxis,
      upAxis: normalization.upAxis,
      targetLengthMetres: normalization.targetLengthMetres,
      uniformScale: normalization.uniformScale,
      groundOffsetMetres: normalization.groundOffsetMetres,
      flip180: normalization.flip180,
      analysis: {
        filename: report.filename,
        byteSize: report.byteSize,
        nodes: report.nodes,
        meshes: report.meshes,
        vertices: report.vertices,
        triangles: report.triangles,
        materials: report.materials,
        textures: report.textures,
        maxTextureResolution: report.maxTextureResolution,
        estimatedDecodedTextureBytes: report.estimatedDecodedTextureBytes,
        animations: report.animations.map((a) => ({
          name: a.name,
          duration: a.duration,
          trackCount: a.trackCount,
        })),
        extensions: report.extensions,
        warnings: report.warnings,
        bounds: report.bounds,
        likelyUnits: report.likelyUnits,
      },
      rig: this.rig,
    }
  }

  setNormalization(patch: Partial<VehicleNormalization>) {
    if (!this.roots || !this.normalization) return null
    this.normalization = { ...this.normalization, ...patch }
    applyNormalization(this.roots, this.normalization)
    if (this.camera) frameCameraToObject(this.camera, this.roots.placement, this.controls)
    return measuredLengthMetres(this.roots)
  }

  playClip(index = 0) {
    this.activeClipIndex = index
    this.anim.play(index, 'once')
  }

  toggleClipPlayback() {
    if (this.anim.isPlaying()) this.anim.pause()
    else if (this.anim.getTime() > 0) this.anim.resume()
    else this.anim.play(this.activeClipIndex, 'once')
  }

  stopClip() {
    this.anim.stop()
    this.anim.restoreBindPose()
  }

  seekClip(time: number) {
    if (!this.anim.getDuration()) this.anim.play(this.activeClipIndex, 'once')
    this.anim.pause()
    this.anim.seek(time)
  }

  getClipTime() {
    return { time: this.anim.getTime(), duration: this.anim.getDuration(), playing: this.anim.isPlaying() }
  }

  update() {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.anim.update(dt)
  }

  /** Dispose live graph without deleting IndexedDB variant blobs. */
  private disposeSceneGraphOnly() {
    if (this.roots) {
      this.anim.dispose()
      disposeObject3D(this.roots.placement)
      this.roots = null
    }
    this.clips = []
  }

  clearActiveVehicle() {
    this.disposeSceneGraphOnly()
    for (const slot of this.variants.values()) {
      void idbDeleteAssetBlob(slot.assetId)
    }
    this.variants.clear()
    this.activeQuality = null
    revokeObjectUrl(this.objectUrl)
    this.objectUrl = null
    this.report = null
    this.normalization = null
    this.rig = null
    this.rigMissing = []
    this.role = null
  }

  dispose() {
    this.clearActiveVehicle()
    for (const prop of this.propRoots) disposeObject3D(prop)
    this.propRoots = []
    this.scene = null
    this.camera = null
    this.controls = null
    this.renderer = null
  }
}

