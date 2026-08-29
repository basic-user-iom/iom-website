import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats, useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { DEBUG } from '../../config/debug.js'
import { useViewer } from '../../hooks/useViewer.js'
import { CameraController } from './CameraController.jsx'
import { HarpModel } from './HarpModel.jsx'
import { Hotspots } from './Hotspots.jsx'
import { Lighting } from './Lighting.jsx'
import { SceneErrorBoundary } from './SceneErrorBoundary.jsx'

function ProgressBridge() {
  const { progress, errors } = useProgress()
  const setProgress = useViewer((state) => state.setProgress)
  const setLoadError = useViewer((state) => state.setLoadError)

  useEffect(() => {
    setProgress(progress / 100)
  }, [progress, setProgress])

  useEffect(() => {
    if (errors.length) {
      console.error('[harp-configurator] loading errors', errors)
      setLoadError(new Error(errors[0]))
    }
  }, [errors, setLoadError])

  return null
}

export function HarpScene() {
  const controlsRef = useRef()
  const rig = useViewer((state) => state.rig)
  const setLoadError = useViewer((state) => state.setLoadError)
  const cameraEdit = useViewer((state) => state.cameraEdit)

  useEffect(() => {
    const kick = () => window.dispatchEvent(new Event('resize'))
    kick()
    const timer = window.setTimeout(kick, 80)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Canvas
      className="harp-canvas"
      shadows
      dpr={[1, 2]}
      frameloop="always"
      resize={{ scroll: true, debounce: { scroll: 50, resize: 0 }, offsetSize: true }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.06,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: 31, near: 0.04, far: 24, position: [0.8188, 1.0558, -0.5247] }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.debug.checkShaderErrors = true
        gl.debug.onShaderError = (glCtx, program, vertexShader, fragmentShader) => {
          console.error('[harp-configurator] shader compile failed', {
            vertex: glCtx.getShaderInfoLog(vertexShader),
            fragment: glCtx.getShaderInfoLog(fragmentShader),
            program: glCtx.getProgramInfoLog(program),
          })
        }
      }}
    >
      <ProgressBridge />
      <SceneErrorBoundary onError={setLoadError}>
        <Suspense fallback={null}>
          <Lighting />
          <HarpModel />
          <Hotspots rig={rig} />
        </Suspense>
      </SceneErrorBoundary>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.055}
        enablePan={cameraEdit}
        minPolarAngle={cameraEdit ? 0.08 : (rig?.minPolar ?? 0.32)}
        maxPolarAngle={cameraEdit ? Math.PI / 2 - 0.02 : (rig?.maxPolar ?? Math.PI / 2 - 0.06)}
        minDistance={cameraEdit ? 0.22 : (rig?.minDistance ?? 0.45)}
        maxDistance={cameraEdit ? 5.5 : (rig?.maxDistance ?? 3.2)}
      />
      <CameraController controlsRef={controlsRef} />
      {DEBUG && <Stats />}
    </Canvas>
  )
}
