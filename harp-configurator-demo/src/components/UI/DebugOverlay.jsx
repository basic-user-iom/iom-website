import { DEBUG } from '../../config/debug.js'
import { useViewer } from '../../hooks/useViewer.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'

export function DebugOverlay() {
  const analysis = useViewer((state) => state.analysis)
  const rig = useViewer((state) => state.rig)
  const values = useConfigurator((state) => state.values)
  if (!DEBUG) return null

  return (
    <div className="debug-overlay">
      <p>DEBUG</p>
      <pre>
        {JSON.stringify(
          {
            meshes: analysis?.meshNames,
            materials: analysis?.materials,
            size: analysis?.size?.toArray?.(),
            values,
            target: rig?.target?.toArray?.(),
          },
          null,
          2,
        )}
      </pre>
    </div>
  )
}
