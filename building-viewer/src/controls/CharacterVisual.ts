import {
  AnimationMixer,
  AnimationAction,
  Group,
  LoopRepeat,
  LoopOnce,
  Object3D,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type AnimationClip,
} from 'three'
import { CharacterFootIK, type FootFrame } from './CharacterFootIK'
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
  private footIK: CharacterFootIK | null = null
  private footIKEnabled = true
  private model: Object3D | null = null
  private mixer: AnimationMixer | null = null
  private actions = new Map<CharacterAnimState, AnimationAction>()
  // Null until the first action is actually started. Initialising this to
  // `idle` made load()'s play('idle') return before the idle clip could run.
  private current: CharacterAnimState | null = null
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
    this.footIK = new CharacterFootIK(this.root, this.model)
    this.footIK.enabled = this.footIKEnabled

    if (gltf.animations?.length) {
      this.mixer = new AnimationMixer(this.model)
      for (const clip of gltf.animations) {
        const name = clip.name.toLowerCase()
        let key: CharacterAnimState | null = null
        if (/stair|step.*(?:up|down)|ascend|descend/.test(name)) {
          key = /down|descend/.test(name) ? 'stairsDown' : 'stairsUp'
        } else if (/jump|airborne/.test(name)) key = 'jumping'
        else if (name.includes('idle') || name.includes('stand')) key = 'idle'
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

      // Reuse only this skeleton's clips. Never restart the shared walk action
      // when the controller changes between flat, ascent and descent hints.
      const walk = this.actions.get('walking') ?? this.actions.get('idle')
      const idle = this.actions.get('idle')
      if (walk) {
        if (!this.actions.has('stairsUp')) this.actions.set('stairsUp', walk)
        if (!this.actions.has('stairsDown')) this.actions.set('stairsDown', walk)
      }
      if (!this.actions.has('jumping') && idle) this.actions.set('jumping', idle)

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
    action.setLoop(key === 'jumping' ? LoopOnce : LoopRepeat, key === 'jumping' ? 1 : Infinity)
    action.clampWhenFinished = key === 'jumping'
    this.actions.set(key, action)
  }

  /** Reference speeds of the reviewed in-place stair clips, not root motion. */
  locomotionRate(state: CharacterAnimState, measuredSpeed: number, fallback: number, stepDepth = .28): number {
    const clip = this.actions.get(state)?.getClip()
    // One full clip is a left/right pair. Match that pair to two actual treads,
    // so wider stairs do not put the following foot on the same step.
    const reference = clip && (clip.name === 'Stairs_Up' || clip.name === 'Stairs_Down')
      ? 2 * stepDepth / clip.duration : null
    return reference === null ? fallback : Math.max(0.15, Math.min(2.2, measuredSpeed / reference))
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
    playbackRate = 1,
  ): void {
    this.root.position.copy(feet)
    this.root.rotation.set(0, yaw + Math.PI, 0)
    this.play(anim)
    this.actions.get(anim)?.setEffectiveTimeScale(playbackRate)
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
    const selected = this.actions.get(state)
    if (state === this.current && selected?.isRunning()) return

    const next = this.actions.get(state) ?? this.actions.get('walking') ?? this.actions.get('idle')
    const prev = this.current ? this.actions.get(this.current) : undefined
    if (prev && prev !== next) prev.fadeOut(0.2)
    if (next && next !== prev) {
      const locomotion = (value: CharacterAnimState | null) =>
        value === 'walking' || value === 'running' || value === 'stairsUp' || value === 'stairsDown'
      const phase = prev && locomotion(this.current) && locomotion(state)
        ? (prev.time / prev.getClip().duration) % 1 : 0
      next.reset().fadeIn(0.2).play()
      next.time = phase * next.getClip().duration
    }
    this.current = state
  }

  setFootIKEnabled(enabled: boolean): void {
    this.footIKEnabled = enabled
    if (this.footIK) { this.footIK.enabled = enabled; this.footIK.reset() }
  }

  resetFootIK(): void { this.footIK?.reset() }

  /** A teleport arrives standing still, with no residual stair pose or crossfade. */
  resetForTeleport(): void {
    this.footIK?.reset()
    this.mixer?.stopAllAction()
    const idle = this.actions.get('idle')
    idle?.reset().stopFading().setEffectiveWeight(1).setEffectiveTimeScale(1).play()
    this.current = idle ? 'idle' : null
    this.mixer?.update(0)
  }

  update(dt: number, frame?: FootFrame): void {
    this.footIK?.restore()
    this.mixer?.update(dt)
    const action = this.current ? this.actions.get(this.current) : undefined
    const stair = this.current === 'stairsUp' || this.current === 'stairsDown'
    const authored = action?.getClip().name
    const supported = !stair || authored === 'Stairs_Up' || authored === 'Stairs_Down'
    if (frame && !this.firstPerson && this.current && action && supported) {
      this.footIK?.apply(dt, this.current, action.time / action.getClip().duration, frame)
    } else this.footIK?.reset()
    if (frame && !stair && !this.firstPerson) this.footIK?.fitFlatSoles(dt, frame)
  }

  private clearModel(): void {
    this.footIK?.reset()
    this.footIK = null
    if (this.blob) {
      this.blob.geometry.dispose()
      ;(this.blob.material as MeshBasicMaterial).dispose()
      this.root.remove(this.blob)
      this.blob = null
    }
    if (this.model) {
      this.root.remove(this.model)
      this.model = null
    }
    this.mixer = null
    this.actions.clear()
    this.current = null
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
