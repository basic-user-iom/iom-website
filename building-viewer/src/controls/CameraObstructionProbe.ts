import { Raycaster, Vector3, type Material, type Mesh, type Object3D } from 'three'

/** Keep the third-person boom on the player's side of visible opaque walls. */
export class CameraObstructionProbe {
  private readonly ray = new Raycaster()
  private readonly lastOrigin = new Vector3(Infinity, Infinity, Infinity)
  private readonly lastDesired = new Vector3(Infinity, Infinity, Infinity)
  private readonly direction = new Vector3()
  private lastLayers = ''
  private lastDistance: number | null = null

  constructor(private readonly root: Object3D) {}

  distance(origin: Vector3, desired: Vector3): number | null {
    const layers = this.root.children.map(child => `${child.id}:${child.visible}`).join('|')
    if (layers === this.lastLayers && origin.distanceToSquared(this.lastOrigin) < .0001 &&
      desired.distanceToSquared(this.lastDesired) < .0001) return this.lastDistance
    this.lastLayers = layers
    this.lastOrigin.copy(origin)
    this.lastDesired.copy(desired)
    const length = this.direction.copy(desired).sub(origin).length()
    if (length < .01) { this.lastDistance = null; return null }
    this.direction.divideScalar(length)
    this.ray.near = .01
    this.ray.far = length
    let nearest = length
    // Two ray directions cover single-sided source faces without editing materials.
    for (const reverse of [false, true]) {
      this.ray.set(reverse ? desired : origin, this.direction)
      if (reverse) this.ray.ray.direction.negate()
      for (const hit of this.ray.intersectObject(this.root, true)) {
        const mesh = hit.object as Mesh
        if (!mesh.isMesh || mesh.userData.collisionOnly || !this.visible(mesh)) continue
        const material: Material | undefined = Array.isArray(mesh.material)
          ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material
        if (!material?.visible || material.opacity < .9 || ('wireframe' in material && material.wireframe)) continue
        const distance = reverse ? length - hit.distance : hit.distance
        if (distance > .01) nearest = Math.min(nearest, distance)
      }
    }
    this.lastDistance = nearest < length ? nearest : null
    return this.lastDistance
  }

  private visible(object: Object3D): boolean {
    for (let current: Object3D | null = object; current; current = current.parent) {
      if (!current.visible) return false
      if (current === this.root) break
    }
    return true
  }
}
