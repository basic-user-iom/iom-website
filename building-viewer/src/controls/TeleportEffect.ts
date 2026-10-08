import {
  AdditiveBlending, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, Material, Mesh, MeshBasicMaterial, Points,
  PointsMaterial, RingGeometry, type Object3D,
} from 'three'

const SHIMMER_COLOR = new Color(0x3ac5ea)

type FadedMaterial = { material: Material; opacity: number; transparent: boolean; depthWrite: boolean; emissive?: Color }

/** Local transporter shimmer plus a smooth screen veil that masks the camera cut. */
export class TeleportEffect {
  readonly root = new Group()
  active = false
  private elapsed = 0
  private transferred = false
  private commit: (() => boolean) | null = null
  private readonly saved: FadedMaterial[] = []
  private readonly veil = document.createElement('div')
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly beamMaterial = new MeshBasicMaterial({ color: 0x65deff, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, toneMapped: false })
  private readonly sparkMaterial = new PointsMaterial({ color: 0xbdeeff, size: .027, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false })
  private readonly sparks: Points
  private readonly scan: Mesh

  constructor(private readonly character: Object3D, host: HTMLElement) {
    this.root.name = 'TeleportTransporterEffect'
    this.root.visible = false
    const beam = new Mesh(new CylinderGeometry(.49, .49, 2.15, 32, 1, true), this.beamMaterial)
    beam.position.y = 1.05
    this.scan = new Mesh(new RingGeometry(.35, .53, 48), this.beamMaterial)
    this.scan.rotation.x = -Math.PI / 2
    const positions = new Float32Array(144 * 3)
    this.sparks = new Points(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)), this.sparkMaterial)
    this.sparks.frustumCulled = false
    this.root.add(beam, this.scan, this.sparks)
    this.veil.className = 'bv-teleport-veil'
    this.veil.setAttribute('aria-hidden', 'true')
    Object.assign(this.veil.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '15', opacity: '0', display: 'none', background: 'radial-gradient(ellipse at center, #18536b 0%, #0c2539 65%, #071420 100%)' })
    host.appendChild(this.veil)
  }

  begin(commit: () => boolean): void {
    this.cancel()
    this.commit = commit
    this.elapsed = 0
    this.transferred = false
    this.active = true
    const seen = new Set<Material>()
    this.character.traverse(object => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (seen.has(material)) continue
        seen.add(material)
        const lit = material as Material & { emissive?: Color }
        this.saved.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, emissive: lit.emissive?.clone() })
        if (!material.transparent) { material.transparent = true; material.needsUpdate = true }
        material.depthWrite = false
      }
    })
    this.veil.style.display = 'block'
    this.update(0)
  }

  update(dt: number): void {
    if (!this.active) return
    this.elapsed += Math.max(0, Math.min(dt, .05))
    const reduced = this.reducedMotion.matches
    const out = reduced ? .18 : .46, hold = .10, into = reduced ? .18 : .54
    if (this.elapsed >= out && !this.transferred) {
      this.transferred = true
      // A failed revalidation rematerializes at the source; never moves into a missing floor.
      this.commit?.()
    }
    const phase = this.elapsed < out ? this.elapsed / out : 1 - Math.max(0, this.elapsed - out - hold) / into
    const dissolve = Math.max(0, Math.min(1, phase))
    const smooth = dissolve * dissolve * (3 - 2 * dissolve)
    this.veil.style.opacity = String(Math.max(0, Math.min(1, (smooth - .32) / .68)))
    for (const entry of this.saved) {
      entry.material.opacity = entry.opacity * (1 - smooth)
      if (entry.emissive) (entry.material as Material & { emissive: Color }).emissive.copy(entry.emissive).lerp(SHIMMER_COLOR, smooth * .7)
    }
    this.root.position.copy(this.character.position)
    this.root.visible = !reduced
    this.beamMaterial.opacity = .19 * Math.sin(smooth * Math.PI)
    this.sparkMaterial.opacity = .9 * Math.sin(smooth * Math.PI)
    this.scan.position.y = .05 + 2.05 * dissolve
    const points = this.sparks.geometry.attributes.position
    for (let i = 0; i < points.count; i++) {
      const angle = i * 2.399963 + this.elapsed * .8
      const radius = .22 + ((i * 47) % 97) / 97 * .3
      const y = ((i * .618034 + this.elapsed * .65) % 1) * 2.1
      points.setXYZ(i, Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    }
    points.needsUpdate = true
    if (this.elapsed >= out + hold + into) this.cancel()
  }

  cancel(): void {
    for (const entry of this.saved) {
      entry.material.opacity = entry.opacity
      entry.material.depthWrite = entry.depthWrite
      if (entry.material.transparent !== entry.transparent) { entry.material.transparent = entry.transparent; entry.material.needsUpdate = true }
      if (entry.emissive) (entry.material as Material & { emissive: Color }).emissive.copy(entry.emissive)
    }
    this.saved.length = 0
    this.active = false
    this.commit = null
    this.root.visible = false
    this.veil.style.display = 'none'
    this.veil.style.opacity = '0'
  }

  dispose(): void {
    this.cancel()
    this.veil.remove()
    this.root.removeFromParent()
    this.root.traverse(object => { if (object instanceof Mesh || object instanceof Points) object.geometry.dispose() })
    this.beamMaterial.dispose()
    this.sparkMaterial.dispose()
  }
}
