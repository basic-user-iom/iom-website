import {
  AnimationMixer,
  AnimationAction,
  Group,
  LoopRepeat,
  Object3D,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type AnimationClip,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * Visual states. Jump / stairs use the native Xbot locomotion clips as safe
 * stand-ins — external Mixamo packs require retargeting and were collapsing the mesh.
 */
export type CharacterAnimState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'jumping'
  | 'stairsUp'
  | 'stairsDown'

/**
 * Visual avatar only — does not own collision/physics position.
 */
export class CharacterVisual {
  readonly root = new Group()
  private model: Object3D | null = null
  private mixer: AnimationMixer | null = null
  private actions = new Map<CharacterAnimState, AnimationAction>()
  private current: CharacterAnimState = 'idle'
  private blob: Mesh | null = null
  private hideHead = false
  private blobEnabled = true
  private firstPerson = false
  private readonly loader = new GLTFLoader()

  constructor() {
    this.root.name = 'CharacterVisual'
    this.root.visible = false
  }

  async load(url: string): Promise<void> {
    this.clearModel()
    const gltf = await this.loader.loadAsync(url)
    this.model = gltf.scene
    this.model.traverse((o) => {
      if ((o as Mesh).isMesh) {
        const m = o as Mesh
        m.castShadow = false
        m.receiveShadow = false
      }
    })
    this.root.add(this.model)

    if (gltf.animations?.length) {
      this.mixer = new AnimationMixer(this.model)
      for (const clip of gltf.animations) {
        const name = clip.name.toLowerCase()
        let key: CharacterAnimState | null = null
        if (name.includes('idle') || name.includes('stand')) key = 'idle'
        else if (name.includes('run') || name.includes('sprint')) key = 'running'
        else if (name.includes('walk') || name.includes('loco')) key = 'walking'
        if (key && !this.actions.has(key)) {
          this.bindClip(key, clip)
        }
      }
      if (!this.actions.has('idle') && gltf.animations[0]) {
        this.bindClip('idle', gltf.animations[0])
      }
      if (!this.actions.has('walking')) {
        const fallback = this.actions.get('idle')
        if (fallback) this.actions.set('walking', fallback)
      }
      if (!this.actions.has('running')) {
        const fallback = this.actions.get('walking') ?? this.actions.get('idle')
        if (fallback) this.actions.set('running', fallback)
      }

      // Safe aliases — same skeleton as idle/walk/run (no foreign Mixamo bind poses).
      const walk = this.actions.get('walking')
      const idle = this.actions.get('idle')
      if (walk) {
        this.actions.set('stairsUp', walk)
        this.actions.set('stairsDown', walk)
        this.actions.set('jumping', walk)
      } else if (idle) {
        this.actions.set('stairsUp', idle)
        this.actions.set('stairsDown', idle)
        this.actions.set('jumping', idle)
      }

      this.play('idle')
    }

    const blobMat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
    this.blob = new Mesh(new SphereGeometry(0.35, 12, 8), blobMat)
    this.blob.scale.set(1, 0.12, 1)
    this.blob.position.y = 0.02
    this.blob.frustumCulled = true
    this.root.add(this.blob)
    this.syncBlobVisibility()
  }

  private bindClip(key: CharacterAnimState, clip: AnimationClip): void {
    if (!this.mixer) return
    const action = this.mixer.clipAction(clip)
    action.setLoop(LoopRepeat, Infinity)
    this.actions.set(key, action)
  }

  setBlobShadow(enabled: boolean): void {
    this.blobEnabled = enabled
    this.syncBlobVisibility()
  }

  setVisible(v: boolean): void {
    this.root.visible = v
  }

  setHideHead(hide: boolean): void {
    this.hideHead = hide
    if (!this.model) return
    this.model.traverse((o) => {
      const n = o.name.toLowerCase()
      if (n.includes('head') || n.includes('mixamorighead')) {
        o.visible = !hide
      }
    })
  }

  syncFromController(
    feet: Vector3,
    yaw: number,
    anim: CharacterAnimState,
    firstPerson: boolean,
  ): void {
    this.root.position.copy(feet)
    this.root.rotation.set(0, yaw + Math.PI, 0)
    this.play(anim)
    this.firstPerson = firstPerson
    if (this.model) {
      this.model.visible = !firstPerson
    }
    this.syncBlobVisibility()
    if (this.hideHead) this.setHideHead(true)
  }

  private syncBlobVisibility(): void {
    if (this.blob) this.blob.visible = this.blobEnabled && !this.firstPerson
  }

  play(state: CharacterAnimState): void {
    if (state === this.current) return

    const next = this.actions.get(state) ?? this.actions.get('walking') ?? this.actions.get('idle')
    const prev = this.actions.get(this.current)
    if (prev && prev !== next) prev.fadeOut(0.2)
    if (next && next !== prev) {
      next.reset().fadeIn(0.2).play()
    }
    this.current = state
  }

  update(dt: number): void {
    this.mixer?.update(dt)
  }

  private clearModel(): void {
    if (this.model) {
      this.root.remove(this.model)
      this.model = null
    }
    this.mixer = null
    this.actions.clear()
    this.current = 'idle'
  }

  dispose(): void {
    this.clearModel()
    if (this.blob) {
      this.blob.geometry.dispose()
      ;(this.blob.material as MeshBasicMaterial).dispose()
      this.root.remove(this.blob)
      this.blob = null
    }
  }
}
