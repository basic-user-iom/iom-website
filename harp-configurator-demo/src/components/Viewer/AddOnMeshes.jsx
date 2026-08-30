import { useEffect, useMemo } from 'react'
import { Euler, FrontSide, Vector3 } from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { HARDWARE_FINISHES } from '../../config/materials.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { createCarvingTexture, createEmblemTexture } from '../../utils/emblem.js'
import { HARP_PART } from '../../utils/harpParts.js'

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

function createSurfaceDecal(target, anchor, depth) {
  if (!target?.geometry || !anchor) return null

  target.updateWorldMatrix(true, false)
  const source = target.geometry
  const part = source.getAttribute('harpPart')
  const position = source.getAttribute('position')
  const index = source.getIndex()
  if (!part || !position) return null

  const triangleCount = index ? index.count : position.count
  const kept = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const faceNormal = new Vector3()

  for (let i = 0; i < triangleCount; i += 3) {
    const ia = index ? index.getX(i) : i
    const ib = index ? index.getX(i + 1) : i + 1
    const ic = index ? index.getX(i + 2) : i + 2
    const trianglePart = Math.round((part.getX(ia) + part.getX(ib) + part.getX(ic)) / 3)
    if (trianglePart !== HARP_PART.wood) continue

    a.fromBufferAttribute(position, ia)
    b.fromBufferAttribute(position, ib)
    c.fromBufferAttribute(position, ic)
    faceNormal
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize()
      .transformDirection(target.matrixWorld)
    if (faceNormal.dot(anchor.normal) < 0.45) continue
    kept.push(ia, ib, ic)
  }

  if (!kept.length) return null
  const filteredGeometry = source.clone()
  filteredGeometry.setIndex(kept)
  const projectionTarget = target.clone(false)
  projectionTarget.geometry = filteredGeometry
  projectionTarget.matrixAutoUpdate = false
  projectionTarget.matrix.copy(target.matrixWorld)
  projectionTarget.matrixWorld.copy(target.matrixWorld)

  try {
    const orientation = new Euler().setFromQuaternion(anchor.quaternion, 'XYZ')
    const projectorPosition = anchor.position
      .clone()
      .addScaledVector(anchor.normal, -depth * 0.5)
    return new DecalGeometry(
      projectionTarget,
      projectorPosition,
      orientation,
      new Vector3(anchor.width, anchor.height, depth),
    )
  } finally {
    filteredGeometry.dispose()
  }
}

function SurfaceDecal({ name, anchor, target, size, map, variant }) {
  const emblem = variant === 'emblem'
  const depth = size * (emblem ? 0.02 : 0.058)
  const geometry = useMemo(
    () => createSurfaceDecal(target, anchor, depth),
    [anchor, depth, target],
  )

  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null

  return (
    <mesh name={name} geometry={geometry} renderOrder={emblem ? 3 : 2}>
      <meshPhysicalMaterial
        map={map}
        transparent
        alphaTest={emblem ? 0.05 : 0.025}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={emblem ? -4 : -3}
        polygonOffsetUnits={emblem ? -4 : -3}
        roughness={emblem ? 0.4 : 0.54}
        metalness={emblem ? 0.58 : 0.04}
        envMapIntensity={emblem ? 1.05 : 0.64}
        side={FrontSide}
      />
    </mesh>
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
      <mesh castShadow position={[0, 0, 0.04]}>
        <boxGeometry args={[0.28, 0.62, 0.08]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      {[-0.205, 0.205].map((y) => (
        <mesh key={y} castShadow position={[0, y, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.052, 0.052, 0.028, 16]} />
          <HardwareMaterial color={color} roughness={roughness} dark />
        </mesh>
      ))}

      <mesh castShadow position={[0, 0.025, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.09, 24]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      <mesh castShadow position={[0.19, 0.025, 0.105]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.15, 18]} />
        <HardwareMaterial color={color} roughness={roughness} dark />
      </mesh>

      <mesh castShadow position={[0.1, -0.27, 0.11]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.055, 0.045, 0.44, 14]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh castShadow position={[0.2, -0.5, 0.11]}>
        <sphereGeometry args={[0.07, 14, 10]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
    </group>
  )
}

function PickupSensor({ anchor, size }) {
  const depth = size * 0.0013
  const face = depth + size * 0.00006

  return (
    <group position={anchor.position.toArray()} quaternion={anchor.quaternion.toArray()}>
      <mesh castShadow position={[0, 0, depth * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.012, size * 0.012, depth, 36]} />
        <meshPhysicalMaterial
          color="#3f3d39"
          metalness={0.3}
          roughness={0.5}
          clearcoat={0.46}
          clearcoatRoughness={0.3}
          envMapIntensity={0.88}
        />
      </mesh>
      <mesh position={[0, 0, face]} renderOrder={4}>
        <ringGeometry args={[size * 0.0065, size * 0.0085, 32]} />
        <meshPhysicalMaterial color="#beb9af" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, face + size * 0.00004]} renderOrder={5}>
        <circleGeometry args={[size * 0.0018, 24]} />
        <meshBasicMaterial color="#d5b977" />
      </mesh>
    </group>
  )
}

function OutputJack({ anchor, size, color, roughness }) {
  const screwOffset = size * 0.009
  const depth = size * 0.0016
  const face = depth + size * 0.00006

  return (
    <group
      name="HarpOutputJack"
      position={anchor.position.toArray()}
      quaternion={anchor.quaternion.toArray()}
    >
      <mesh
        castShadow
        position={[0, 0, depth * 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1.55, 1, 1]}
      >
        <cylinderGeometry args={[size * 0.009, size * 0.009, depth, 32]} />
        <meshPhysicalMaterial
          color="#44413c"
          metalness={0.3}
          roughness={0.52}
          clearcoat={0.34}
          clearcoatRoughness={0.3}
          envMapIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 0, face]} renderOrder={4}>
        <torusGeometry args={[size * 0.0046, size * 0.001, 12, 32]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0, face + size * 0.00004]} renderOrder={5}>
        <circleGeometry args={[size * 0.0028, 28]} />
        <meshPhysicalMaterial color="#090909" metalness={0.16} roughness={0.5} />
      </mesh>
      {[-screwOffset, screwOffset].map((x) => (
        <mesh key={x} position={[x, 0, face + size * 0.00003]} renderOrder={5}>
          <circleGeometry args={[size * 0.0011, 16]} />
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
        <SurfaceDecal
          name="HarpEmblem"
          anchor={emblem}
          target={anchors.decalTarget}
          size={size}
          map={emblemMap}
          variant="emblem"
        />
      )}

      {values.carving && carving && (
        <SurfaceDecal
          name="SoundboardCarving"
          anchor={carving}
          target={anchors.decalTarget}
          size={size}
          map={carvingMap}
          variant="carving"
        />
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
