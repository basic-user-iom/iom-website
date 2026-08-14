import type { DebugControls, ExteriorMode, SceneStats } from './types'

type Props = {
  debug: DebugControls
  stats: SceneStats
  onChange: (next: DebugControls) => void
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export function DebugPanel({ debug, stats, onChange }: Props) {
  const set = (patch: Partial<DebugControls>) => onChange({ ...debug, ...patch })
  return (
    <aside className="kk-debug" aria-label="Development controls">
      <p className="kk-debug__title">Dev</p>
      <label>
        Model
        <select
          value={debug.modelSource}
          onChange={(event) => set({ modelSource: event.target.value as DebugControls['modelSource'] })}
        >
          <option value="procedural">Procedural</option>
          <option value="glb">GLB</option>
        </select>
      </label>
      <label>
        Shell
        <select
          value={debug.exteriorOrCutaway}
          onChange={(event) => set({ exteriorOrCutaway: event.target.value as ExteriorMode })}
        >
          <option value="auto">Auto</option>
          <option value="exterior">Exterior</option>
          <option value="cutaway">Cutaway</option>
        </select>
      </label>
      <label>
        Handle
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={debug.handleAngle}
          onChange={(event) => set({ handleAngle: Number(event.target.value) })}
        />
      </label>
      <label>
        Metal
        <input
          type="range"
          min={0.4}
          max={0.52}
          step={0.01}
          value={debug.metalRoughness}
          onChange={(event) => set({ metalRoughness: Number(event.target.value) })}
        />
      </label>
      <label>
        Fire
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={debug.fireIntensity}
          onChange={(event) => set({ fireIntensity: Number(event.target.value) })}
        />
      </label>
      <label>
        Embers
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={debug.emberIntensity}
          onChange={(event) => set({ emberIntensity: Number(event.target.value) })}
        />
      </label>
      <label>
        Chimney flame
        <input
          type="range"
          min={0.2}
          max={1.6}
          step={0.05}
          value={debug.chimneyFlameHeight}
          onChange={(event) => set({ chimneyFlameHeight: Number(event.target.value) })}
        />
      </label>
      <label>
        Particles
        <input
          type="range"
          min={20}
          max={140}
          step={5}
          value={debug.particleCount}
          onChange={(event) => set({ particleCount: Number(event.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.whistleInserted}
          onChange={(event) => set({ whistleInserted: event.target.checked })}
        />
        Whistle seated
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.chainVisible}
          onChange={(event) => set({ chainVisible: event.target.checked })}
        />
        Chain
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.chainDebug}
          onChange={(event) => set({ chainDebug: event.target.checked })}
        />
        Chain debug
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.handleCollisionDebug}
          onChange={(event) => set({ handleCollisionDebug: event.target.checked })}
        />
        Handle collision
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.forceCutaway}
          onChange={(event) => set({ forceCutaway: event.target.checked })}
        />
        Cutaway
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.airflowVisible}
          onChange={(event) => set({ airflowVisible: event.target.checked })}
        />
        Airflow
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.waterVisible}
          onChange={(event) => set({ waterVisible: event.target.checked })}
        />
        Water
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.autoRotate}
          onChange={(event) => set({ autoRotate: event.target.checked })}
        />
        Auto-rotate
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.mobilePerformance}
          onChange={(event) => set({ mobilePerformance: event.target.checked })}
        />
        Mobile performance
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.silhouetteCompare}
          onChange={(event) => set({ silhouetteCompare: event.target.checked })}
        />
        Silhouette compare
      </label>
      <label>
        <input
          type="checkbox"
          checked={debug.showReferenceOverlay}
          onChange={(event) => set({ showReferenceOverlay: event.target.checked })}
        />
        Reference overlay
      </label>
      <p className="kk-debug__stats">
        {stats.fps.toFixed(0)} fps · {stats.triangles.toLocaleString()} tris ·{' '}
        {formatBytes(stats.transferredBytes)} · {stats.modelSource}
      </p>
    </aside>
  )
}
