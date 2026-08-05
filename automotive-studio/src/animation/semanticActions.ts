import type { AnimationClip } from 'three'
import type { SemanticAction, VehicleRigManifest } from '../persistence/schema'
import type { AnimationController } from './animationController'

export type ResolvedSemanticAction = SemanticAction & {
  clipIndex: number
  clipName: string
}

export class SemanticActions {
  private actions: ResolvedSemanticAction[] = []
  private activeId: string | null = null

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

  playAction(id: string): boolean {
    const action = this.actions.find((item) => item.id === id)
    if (!action) return false
    this.controller.play(action.clipIndex, action.mode === 'toggle' ? 'repeat' : 'once')
    this.activeId = id
    return true
  }

  toggleAction(id: string): boolean {
    const action = this.actions.find((item) => item.id === id)
    if (!action) return false
    if (this.activeId === id && this.controller.isPlaying()) {
      this.controller.pause()
    } else if (this.activeId === id && this.controller.getTime() > 0) {
      this.controller.resume()
    } else {
      this.controller.play(action.clipIndex, action.mode === 'play' ? 'once' : 'repeat')
      this.activeId = id
    }
    return true
  }
}

function resolveActions(
  manifestActions: SemanticAction[],
  clips: AnimationClip[],
): ResolvedSemanticAction[] {
  const source = manifestActions.length
    ? manifestActions
    : clips.map((clip, index): SemanticAction => ({
        id: `clip:${index}`,
        label: clip.name || `Animation ${index + 1}`,
        sourceClipId: String(index),
        mode: 'play',
      }))

  return source.flatMap((action) => {
    const clipIndex = resolveClipIndex(action.sourceClipId, clips)
    if (clipIndex < 0) return []
    return [{
      ...action,
      clipIndex,
      clipName: clips[clipIndex].name || `Animation ${clipIndex + 1}`,
    }]
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
