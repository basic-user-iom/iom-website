import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, PMREMGenerator } from 'three'
import { ContactShadows } from '@react-three/drei'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { LIGHTING_PRESETS } from '../../config/materials.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useIsMobile } from '../../hooks/useMedia.js'

const bgA = new Color()

export function Lighting() {
  const lightId = useConfigurator((state) => state.values.light)
  const preset = LIGHTING_PRESETS[lightId] ?? LIGHTING_PRESETS.studio
  const { gl, scene } = useThree()
  const current = useRef({
    background: new Color(preset.background),
    env: preset.envIntensity,
    key: preset.key.intensity,
    fill: preset.fill.intensity,
    rim: preset.rim.intensity,
  })
  const keyRef = useRef()
  const fillRef = useRef()
  const rimRef = useRef()
  const ambientRef = useRef()
  const floorRef = useRef()
  const isMobile = useIsMobile()

  useLayoutEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const envScene = new RoomEnvironment()
    const env = pmrem.fromScene(envScene, 0.04).texture
    scene.environment = env
    envScene.dispose?.()
    return () => {
      if (scene.environment === env) scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.012, dt)
    current.current.background.lerp(bgA.set(preset.background), k)
    current.current.env = MathUtils.lerp(current.current.env, preset.envIntensity, k)
    current.current.key = MathUtils.lerp(current.current.key, preset.key.intensity, k)
    current.current.fill = MathUtils.lerp(current.current.fill, preset.fill.intensity, k)
    current.current.rim = MathUtils.lerp(current.current.rim, preset.rim.intensity, k)
    scene.background = current.current.background
    scene.environmentIntensity = current.current.env
    if (keyRef.current) {
      keyRef.current.intensity = current.current.key
      keyRef.current.color.set(preset.key.color)
    }
    if (fillRef.current) {
      fillRef.current.intensity = current.current.fill
      fillRef.current.color.set(preset.fill.color)
    }
    if (rimRef.current) {
      rimRef.current.intensity = current.current.rim
      rimRef.current.color.set(preset.rim.color)
    }
    if (ambientRef.current) ambientRef.current.intensity = preset.ambient
    if (floorRef.current?.material) floorRef.current.material.color.set(preset.floor)
  })

  return (
    <>
      <hemisphereLight ref={ambientRef} args={['#f7efe2', '#8d7d68', preset.ambient]} />
      <directionalLight
        ref={keyRef}
        castShadow
        position={preset.key.position}
        color={preset.key.color}
        intensity={preset.key.intensity}
        shadow-mapSize={[isMobile ? 1024 : 2048, isMobile ? 1024 : 2048]}
        shadow-camera-near={0.2}
        shadow-camera-far={12}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-bias={-0.00035}
        shadow-normalBias={0.04}
      />
      <directionalLight ref={fillRef} position={preset.fill.position} color={preset.fill.color} intensity={preset.fill.intensity} />
      <directionalLight ref={rimRef} position={preset.rim.position} color={preset.rim.color} intensity={preset.rim.intensity} />
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <circleGeometry args={[4.2, 72]} />
        <meshStandardMaterial color={preset.floor} roughness={0.96} metalness={0} />
      </mesh>
      <ContactShadows
        key={lightId}
        position={[0, -0.0012, 0]}
        opacity={preset.shadowOpacity}
        scale={3.4}
        blur={2.6}
        far={1.2}
        color="#4a3c30"
        frames={80}
      />
    </>
  )
}
