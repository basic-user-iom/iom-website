import { useEffect, useMemo } from 'react'
import { FrontSide } from 'three'
import { HARDWARE_FINISHES } from '../../config/materials.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { createCarvingTexture, createEmblemTexture } from '../../utils/emblem.js'

function HardwareMaterial({ color, roughness, dark = false }) {
  return (
    <meshPhysicalMaterial
      color={dark ? '#51483e' : color}
      metalness={0.94}
      roughness={dark ? 0.32 : roughness}
      clearcoat={0.28}
      clearcoatRoughness={0.25}
      envMapIntensity={1.05}
    />
  )
}

function ForteLever({ pose, color, roughness }) {
  return (
    <group
      name="SharpingLever"
      position={pose.position.toArray()}
      quaternion={pose.quaternion.toArray()}
      scale={pose.scale}
    >
      <mesh castShadow position={[0, 0, 0.045]}>
        <boxGeometry args={[0.3, 0.72, 0.09]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      {[-0.245, 0.245].map((y) => (
        <mesh key={y} castShadow position={[0, y, 0.105]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.052, 0.052, 0.028, 16]} />
          <HardwareMaterial color={color} roughness={roughness} dark />
        </mesh>
      ))}

      <mesh castShadow position={[0, 0.035, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.115, 24]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      <mesh castShadow position={[0.235, 0.035, 0.155]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.075, 0.18, 18]} />
        <HardwareMaterial color={color} roughness={roughness} dark />
      </mesh>

      <mesh castShadow position={[0.13, 0.35, 0.18]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.065, 0.052, 0.62, 14]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh castShadow position={[0.25, 0.63, 0.18]}>
        <sphereGeometry args={[0.085, 14, 10]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
    </group>
  )
}

function PickupSensor({ anchor, size }) {
  return (
    <group position={anchor.position.toArray()} quaternion={anchor.quaternion.toArray()}>
      <mesh castShadow position={[0, 0, size * 0.002]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.016, size * 0.016, size * 0.0042, 36]} />
        <meshPhysicalMaterial
          color="#282725"
          metalness={0.24}
          roughness={0.42}
          clearcoat={0.46}
          clearcoatRoughness={0.3}
          envMapIntensity={0.88}
        />
      </mesh>
      <mesh position={[0, 0, size * 0.0042]} renderOrder={4}>
        <ringGeometry args={[size * 0.009, size * 0.012, 32]} />
        <meshPhysicalMaterial color="#beb9af" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, size * 0.0044]} renderOrder={5}>
        <circleGeometry args={[size * 0.0023, 24]} />
        <meshBasicMaterial color="#d5b977" />
      </mesh>
    </group>
  )
}

function OutputJack({ anchor, size, color, roughness }) {
  const screwOffset = size * 0.012

  return (
    <group
      name="HarpOutputJack"
      position={anchor.position.toArray()}
      quaternion={anchor.quaternion.toArray()}
    >
      <mesh
        castShadow
        position={[0, 0, size * 0.003]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1.7, 1, 1]}
      >
        <cylinderGeometry args={[size * 0.012, size * 0.012, size * 0.005, 32]} />
        <meshPhysicalMaterial
          color="#242321"
          metalness={0.3}
          roughness={0.38}
          clearcoat={0.34}
          clearcoatRoughness={0.3}
          envMapIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 0, size * 0.007]} renderOrder={4}>
        <torusGeometry args={[size * 0.006, size * 0.0014, 12, 32]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0, size * 0.0072]} renderOrder={5}>
        <circleGeometry args={[size * 0.0038, 28]} />
        <meshPhysicalMaterial color="#090909" metalness={0.16} roughness={0.5} />
      </mesh>
      {[-screwOffset, screwOffset].map((x) => (
        <mesh key={x} position={[x, 0, size * 0.0071]} renderOrder={5}>
          <circleGeometry args={[size * 0.00145, 16]} />
          <HardwareMaterial color={color} roughness={roughness} />
        </mesh>
      ))}
    </group>
  )
}

export function AddOnMeshes({ anchors }) {
  const values = useConfigurator((state) => state.values)
  const hardware = HARDWARE_FINISHES[values.hardware] ?? HARDWARE_FINISHES.bright
  const ready = useViewer((state) => state.ready)
  const size = anchors?.size ?? 0.6
  const emblemMap = useMemo(() => createEmblemTexture(), [])
  const carvingMap = useMemo(() => createCarvingTexture(), [])
  useEffect(
    () => () => {
      emblemMap.dispose()
      carvingMap.dispose()
    },
    [emblemMap, carvingMap],
  )
  const leverItems = useMemo(() => (Array.isArray(anchors?.levers) ? anchors.levers : []), [anchors])

  if (!anchors || !ready) return null

  const pickup = anchors.pickup
  const emblem = anchors.emblem
  const carving = anchors.carving

  return (
    <group>
      {values.detail === 'emblem' && emblem && (
        <mesh
          name="HarpEmblem"
          position={emblem.position.toArray()}
          quaternion={emblem.quaternion.toArray()}
          renderOrder={3}
        >
          <planeGeometry args={[emblem.width, emblem.height]} />
          <meshPhysicalMaterial
            map={emblemMap}
            transparent
            alphaTest={0.05}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
            roughness={0.32}
            metalness={0.78}
            envMapIntensity={1.05}
            side={FrontSide}
          />
        </mesh>
      )}

      {values.carving && carving && (
        <mesh
          name="SoundboardCarving"
          position={carving.position.toArray()}
          quaternion={carving.quaternion.toArray()}
          renderOrder={2}
        >
          <planeGeometry args={[carving.width, carving.height]} />
          <meshPhysicalMaterial
            map={carvingMap}
            transparent
            alphaTest={0.025}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-3}
            polygonOffsetUnits={-3}
            roughness={0.5}
            metalness={0.06}
            envMapIntensity={0.64}
            side={FrontSide}
          />
        </mesh>
      )}

      {values.pickup && pickup && (
        <group name="HarpPickup">
          <PickupSensor anchor={pickup.sensor} size={size} />
          {pickup.jack && (
            <OutputJack
              anchor={pickup.jack}
              size={size}
              color={hardware.color}
              roughness={hardware.roughness}
            />
          )}
        </group>
      )}

      {values.levers &&
        leverItems.map((pose, index) => (
          <ForteLever
            key={`${index}-${pose.position.y.toFixed(4)}`}
            pose={pose}
            color={hardware.color}
            roughness={hardware.roughness}
          />
        ))}
    </group>
  )
}
