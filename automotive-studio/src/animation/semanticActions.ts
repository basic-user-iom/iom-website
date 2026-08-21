import type { AnimationClip } from 'three'
import type { SemanticAction, VehicleRigManifest } from '../persistence/schema'
import type { AnimationController, PlayRangeOpts } from './animationController'

export type ResolvedSemanticAction = SemanticAction & {
  clipIndex: number
  clipName: string
  clipDuration: number
}

export type SemanticPlayOpts = {
  startSeconds?: number
  endSeconds?: number
}

export class SemanticActions {
  private actions: ResolvedSemanticAction[] = []
  private activeId: string | null = null
  /** Door/clip open state — true after forward play (or mid-open). */
  private openedIds = new Set<string>()

  constructor(
    private controller: AnimationController,
    clips: AnimationClip[],
    rig: VehicleRigManifest | null,
  ) {
    this.actions = resolveActions(rig?.semanticActions ?? [], clips)
  }

  listActions(): ResolvedSemanticAction[] {
    return this.actions.map((action) => ({ ...action }))
  }

  playAction(id: string, opts?: SemanticPlayOpts): boolean {
    const action = this.actions.find((item) => item.id === id)
    if (!action) return false
    const range = mergeRange(action, opts)
    this.controller.play(action.clipIndex, 'once', range, 1)
    this.activeId = id
    this.openedIds.add(id)
    return true
  }

  /**
   * Open on first call, play the clip in reverse on the next (close doors).
   * Mid-open / mid-close also reverses direction from the current time.
   */
  toggleAction(id: string, opts?: SemanticPlayOpts): boolean {
    const action = this.actions.find((item) => item.id === id)
    if (!action) return false
    const range = mergeRange(action, opts)
    const start = range?.start ?? 0
    const end = range?.end ?? action.clipDuration
    const same = this.activeId === id
    const t = same ? this.controller.getTime() : start
    const playing = same && this.controller.isPlaying()
    const goingForward = !playing || this.controller.getEffectiveTimeScale() >= 0
    const nearEnd = t >= end - 0.08
    const nearStart = t <= start + 0.08
    const treatAsOpen =
      this.openedIds.has(id) ||
      nearEnd ||
      (same && playing && goingForward && !nearStart)

    if (treatAsOpen) {
      // Close: reverse from current (or end) down to start.
      const from = same && t > start ? t : end
      this.controller.play(action.clipIndex, 'once', range ?? { start, end }, -1, from)
      this.openedIds.delete(id)
    } else {
      // Open: forward from current (or start) up to end.
      const from = same && t < end ? t : start
      this.controller.play(action.clipIndex, 'once', range, 1, from)
      this.openedIds.add(id)
    }
    this.activeId = id
    return true
  }

  isOpen(id: string): boolean {
    return this.openedIds.has(id)
  }
}

function mergeRange(action: SemanticAction, opts?: SemanticPlayOpts): PlayRangeOpts | undefined {
  const start =
    opts?.startSeconds != null && Number.isFinite(opts.startSeconds)
      ? opts.startSeconds
      : action.timeRange?.[0]
  const end =
    opts?.endSeconds != null && Number.isFinite(opts.endSeconds)
      ? opts.endSeconds
      : action.timeRange?.[1]
  if (start == null && end == null) return undefined
  return { start, end }
}

function resolveActions(
  manifestActions: SemanticAction[],
  clips: AnimationClip[],
): ResolvedSemanticAction[] {
  const source = manifestActions.length
    ? manifestActions
    : clips.map(
        (clip, index): SemanticAction => ({
          id: `clip:${index}`,
          label: clip.name || `Animation ${index + 1}`,
          sourceClipId: String(index),
          mode: 'play',
        }),
      )

  return source.flatMap((action) => {
    const clipIndex = resolveClipIndex(action.sourceClipId, clips)
    if (clipIndex < 0) return []
    return [
      {
        ...action,
        clipIndex,
        clipName: clips[clipIndex].name || `Animation ${clipIndex + 1}`,
        clipDuration: clips[clipIndex].duration,
      },
    ]
  })
}

function resolveClipIndex(sourceClipId: string | undefined, clips: AnimationClip[]): number {
  if (!clips.length) return -1
  if (sourceClipId == null || sourceClipId === '') return 0
  const byName = clips.findIndex((clip) => clip.name === sourceClipId)
  if (byName >= 0) return byName
  const index = Number(sourceClipId)
  return Number.isInteger(index) && index >= 0 && index < clips.length ? index : -1
}
