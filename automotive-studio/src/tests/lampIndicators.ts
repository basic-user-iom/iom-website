/**
 * Indicator L/R must be outer corners only — never the full-width rear bar.
 * Run: npx tsx src/tests/lampIndicators.ts
 */
import assert from 'node:assert/strict'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { createDefaultVehicleLights } from '../persistence/schema'
import { VehicleLightsController } from '../vehicle/vehicleLights'

function isLit(mat: MeshStandardMaterial): boolean {
  return mat.emissive.getHex() !== 0 && mat.emissiveIntensity > 0.15
}

const sharedGlass = new MeshStandardMaterial({ name: 'DarkGlass', color: 0x221100 })

function buildCar(): Group {
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  // Full-width rear signature bar (must NOT become Indicator L).
  const bar = new Mesh(new BoxGeometry(1.6, 0.08, 0.06), sharedGlass)
  bar.name = 'RearBar'
  bar.position.set(0, 1.1, -2.2)
  root.add(bar)

  const indL = new Mesh(new BoxGeometry(0.12, 0.12, 0.08), sharedGlass)
  indL.name = 'GeometryNode_indL'
  indL.position.set(-0.85, 0.75, -2.15)
  root.add(indL)

  const indR = new Mesh(new BoxGeometry(0.12, 0.12, 0.08), sharedGlass)
  indR.name = 'GeometryNode_indR'
  indR.position.set(0.85, 0.75, -2.15)
  root.add(indR)

  return root
}

/** Lixiang-style: only TailLight / RedGlass, no DarkGlass corners. */
function buildRedGlassOnlyCar(): Group {
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const center = new Mesh(
    new BoxGeometry(0.4, 0.1, 0.06),
    new MeshStandardMaterial({ name: 'TailLight', color: 0x330000 }),
  )
  center.name = 'TailCenter'
  center.position.set(0, 0.8, -2.2)
  root.add(center)

  const left = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const right = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  right.name = 'RedGlass_R'
  right.position.set(0.75, 0.75, -2.15)
  root.add(right)

  return root
}

const root = buildCar()
const lights = new VehicleLightsController()
lights.bind(root)
const state = createDefaultVehicleLights()
state.beamProxies = []
lights.apply(state)

const counts = lights.getBoundCounts()
assert.ok(counts.indicatorLeft >= 1, `indicatorLeft bound, got ${counts.indicatorLeft}`)
assert.ok(counts.indicatorRight >= 1, `indicatorRight bound, got ${counts.indicatorRight}`)
assert.ok(counts.indicatorLeft <= 2, `Indicator L should be corner-only, got ${counts.indicatorLeft}`)

const indLMesh = root.getObjectByName('GeometryNode_indL') as Mesh
const indRMesh = root.getObjectByName('GeometryNode_indR') as Mesh
const barMesh = root.getObjectByName('RearBar') as Mesh

lights.apply({
  ...state,
  groups: { ...state.groups, indicatorLeft: true, indicatorRight: false, hazards: false },
})
assert.equal(isLit(indLMesh.material as MeshStandardMaterial), true, 'Indicator L lights left glass')
assert.equal(isLit(indRMesh.material as MeshStandardMaterial), false, 'Indicator L leaves right off')
assert.equal(isLit(barMesh.material as MeshStandardMaterial), false, 'full rear bar stays off for Indicator L')

lights.apply({
  ...state,
  groups: { ...state.groups, indicatorLeft: false, indicatorRight: true, hazards: false },
})
assert.equal(isLit(indLMesh.material as MeshStandardMaterial), false, 'Indicator R leaves left off')
assert.equal(isLit(indRMesh.material as MeshStandardMaterial), true, 'Indicator R lights right glass')
assert.equal(isLit(barMesh.material as MeshStandardMaterial), false, 'full rear bar stays off for Indicator R')

lights.apply({
  ...state,
  groups: { ...state.groups, indicatorLeft: false, indicatorRight: false, hazards: true },
})
assert.equal(isLit(indLMesh.material as MeshStandardMaterial), true, 'Hazards lights left')
assert.equal(isLit(indRMesh.material as MeshStandardMaterial), true, 'Hazards lights right')
assert.equal(isLit(barMesh.material as MeshStandardMaterial), false, 'Hazards does not light full bar')

// RedGlass-only car: promote outermost pods to real Indicator L/R bindings.
{
  const redRoot = buildRedGlassOnlyCar()
  const redLights = new VehicleLightsController()
  redLights.bind(redRoot)
  const redState = createDefaultVehicleLights()
  redState.beamProxies = []
  redLights.apply(redState)
  const redCounts = redLights.getBoundCounts()
  assert.equal(redCounts.indicatorLeft, 1, 'promotes one Indicator L from RedGlass')
  assert.equal(redCounts.indicatorRight, 1, 'promotes one Indicator R from RedGlass')

  const left = redRoot.getObjectByName('RedGlass_L') as Mesh
  const right = redRoot.getObjectByName('RedGlass_R') as Mesh
  const center = redRoot.getObjectByName('TailCenter') as Mesh

  redLights.apply({
    ...redState,
    groups: { ...redState.groups, indicatorLeft: true, indicatorRight: false, hazards: false },
  })
  assert.equal(isLit(left.material as MeshStandardMaterial), true, 'promoted Ind L lights left RedGlass')
  assert.equal(isLit(right.material as MeshStandardMaterial), false, 'promoted Ind L leaves right off')
  assert.equal(isLit(center.material as MeshStandardMaterial), false, 'center TailLight stays off for Ind L')

  redLights.apply({
    ...redState,
    groups: { ...redState.groups, indicatorLeft: false, indicatorRight: false, hazards: true },
  })
  assert.equal(isLit(left.material as MeshStandardMaterial), true, 'hazards lights promoted left')
  assert.equal(isLit(right.material as MeshStandardMaterial), true, 'hazards lights promoted right')
}

// Front Orange + FrontLight assembly: indicators bind on the nose, beams seat on assembly.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const housing = new Mesh(
    new BoxGeometry(1.6, 0.25, 0.2),
    new MeshStandardMaterial({ name: 'Black', color: 0x111111 }),
  )
  housing.name = 'GeometryNode_743'
  housing.position.set(0, 0.65, 2.2)
  root.add(housing)

  const drl = new Mesh(
    new BoxGeometry(1.4, 0.04, 0.06),
    new MeshStandardMaterial({ name: 'FrontLight', color: 0x111111 }),
  )
  drl.name = 'GeometryNode_724'
  drl.position.set(0, 0.72, 2.28)
  root.add(drl)

  const orange = new Mesh(
    new BoxGeometry(0.12, 0.08, 0.06),
    new MeshStandardMaterial({ name: 'Orange', color: 0x442200 }),
  )
  orange.name = 'GeometryNode_664'
  orange.position.set(0.7, 0.68, 2.25)
  root.add(orange)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply(state)

  const counts = lights.getBoundCounts()
  // Orange at +X binds Indicator R only — L needs a rear pod (covered in next test).
  assert.ok(counts.indicatorRight >= 1, 'front Orange binds Indicator R')
  assert.ok(
    lights.getBoundTargets().some((t) => t.materialName === 'Orange' && t.groupId === 'indicatorRight'),
    'Orange pod bound as Indicator R',
  )

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorRight: true, lowBeam: true, drl: true },
  })
  assert.equal(isLit(orange.material as MeshStandardMaterial), true, 'Indicator R lights front Orange on its side')

  const low = lights.listBeamHandles().filter((h) => h.groupId === 'lowBeam')
  assert.ok(low.length >= 2, 'low beams seated as a pair on the front assembly')
  const span = Math.abs(low[0].position.x - low[1].position.x)
  assert.ok(span > 0.4, `low beam L/R span on assembly, got ${span}`)
}

// Front Orange must not block rear RedGlass promotion (Lixiang has both).
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const orange = new Mesh(
    new BoxGeometry(0.12, 0.08, 0.06),
    new MeshStandardMaterial({ name: 'Orange', color: 0x442200 }),
  )
  orange.name = 'GeometryNode_664'
  orange.position.set(0.15, 0.68, 2.25)
  root.add(orange)

  const left = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const right = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  right.name = 'RedGlass_R'
  right.position.set(0.75, 0.75, -2.15)
  root.add(right)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply(state)

  const bound = lights.getBoundTargets()
  assert.ok(
    bound.some((t) => t.materialName === 'Orange' && t.groupId.startsWith('indicator')),
    'front Orange bound as indicator',
  )
  assert.ok(
    bound.some((t) => t.meshName === 'RedGlass_L' && t.groupId === 'indicatorLeft'),
    'rear left RedGlass promoted to Indicator L',
  )
  assert.ok(
    bound.some((t) => t.meshName === 'RedGlass_R' && t.groupId === 'indicatorRight'),
    'rear right RedGlass promoted to Indicator R',
  )

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: true, indicatorRight: false },
  })
  // Orange sits slightly right (x=0.15) → Indicator R only; Ind L must not light it.
  assert.equal(isLit(orange.material as MeshStandardMaterial), false, 'Ind L leaves front Orange off')
  assert.equal(isLit(left.material as MeshStandardMaterial), true, 'Ind L lights rear left')
  assert.equal(isLit(right.material as MeshStandardMaterial), false, 'Ind L leaves rear right off')
  // RedGlass ships with transmission — must clear or amber is invisible.
  const leftPhys = left.material as MeshStandardMaterial & { transmission?: number }
  assert.ok((leftPhys.transmission ?? 0) < 0.02, 'Ind L clears rear glass transmission')
  assert.ok(leftPhys.metalness < 0.2, 'Ind L drops metalness so amber reads')

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: false, indicatorRight: true },
  })
  assert.equal(isLit(orange.material as MeshStandardMaterial), true, 'Ind R lights front Orange on its side')
  assert.equal(isLit(left.material as MeshStandardMaterial), false, 'Ind R leaves rear left off')
  assert.equal(isLit(right.material as MeshStandardMaterial), true, 'Ind R lights rear right')
}

console.log('lamp indicators: ok')

// Cabin Glass panes must never bind as indicators / get painted solid.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const windowGlass = new MeshStandardMaterial({
    name: 'Glass',
    color: 0x88aacc,
    transparent: true,
    opacity: 0.3,
  })
  const sideWin = new Mesh(new BoxGeometry(0.05, 0.9, 1.2), windowGlass)
  sideWin.name = 'SideWindow'
  sideWin.position.set(0.9, 1.1, 0.2)
  root.add(sideWin)

  const rearWin = new Mesh(new BoxGeometry(1.4, 0.9, 0.05), windowGlass.clone())
  rearWin.name = 'RearWindow'
  rearWin.position.set(0, 1.15, -2.0)
  root.add(rearWin)

  const orange = new Mesh(
    new BoxGeometry(0.12, 0.08, 0.06),
    new MeshStandardMaterial({ name: 'Orange', color: 0x442200 }),
  )
  orange.name = 'FrontAmber'
  orange.position.set(0.7, 0.68, 2.25)
  root.add(orange)

  const left = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply({
    ...state,
    groups: { ...state.groups, hazards: true, tail: true, brake: true },
  })

  const bound = lights.getBoundTargets()
  assert.ok(
    !bound.some((t) => /window/i.test(t.meshName) || t.materialName === 'Glass'),
    'cabin Glass must not bind as a lamp',
  )
  assert.equal(
    (sideWin.material as MeshStandardMaterial).color.getHex() !== 0x140800,
    true,
    'side window must not be painted lamp-dark',
  )
  assert.ok(
    (sideWin.material as MeshStandardMaterial).transparent,
    'side window stays transparent',
  )
}

console.log('lamp window guard: ok')

// Lixiang: cabin DarkGlass panes must not bind as indicators / hazards.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  // Window-sized DarkGlass (matches GeometryNode_979 / 1478 after normalize).
  const rearSide = new Mesh(
    new BoxGeometry(1.32, 0.4, 0.91),
    new MeshStandardMaterial({ name: 'DarkGlass', color: 0x111111, transparent: true, opacity: 0.35 }),
  )
  rearSide.name = 'GeometryNode_979'
  rearSide.position.set(-0.85, 1.05, -1.2)
  root.add(rearSide)

  const cabinSide = new Mesh(
    new BoxGeometry(0.46, 0.42, 0.68),
    new MeshStandardMaterial({ name: 'DarkGlass', color: 0x111111, transparent: true, opacity: 0.35 }),
  )
  cabinSide.name = 'GeometryNode_1478'
  cabinSide.position.set(0.9, 1.0, 0.1)
  root.add(cabinSide)

  const orange = new Mesh(
    new BoxGeometry(1.48, 0.02, 0.83),
    new MeshStandardMaterial({ name: 'Orange', color: 0x442200 }),
  )
  orange.name = 'GeometryNode_664'
  orange.position.set(0.55, 0.68, 2.2)
  root.add(orange)

  const left = new Mesh(
    new BoxGeometry(1.24, 0.08, 0.76),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const right = new Mesh(
    new BoxGeometry(1.24, 0.08, 0.76),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  right.name = 'RedGlass_R'
  right.position.set(0.75, 0.75, -2.15)
  root.add(right)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply({
    ...state,
    groups: { ...state.groups, hazards: true, indicatorLeft: true, indicatorRight: true },
  })

  const bound = lights.getBoundTargets()
  assert.ok(
    !bound.some((t) => t.meshName === 'GeometryNode_979' || t.meshName === 'GeometryNode_1478'),
    'cabin DarkGlass panes must not bind as indicators',
  )
  assert.equal(isLit(rearSide.material as MeshStandardMaterial), false, 'rear DarkGlass window must not blink')
  assert.equal(isLit(cabinSide.material as MeshStandardMaterial), false, 'side DarkGlass window must not blink')
  assert.ok(
    (rearSide.material as MeshStandardMaterial).color.getHex() !== 0x140800,
    'rear DarkGlass must not be painted lamp-dark',
  )
  assert.ok(
    bound.some((t) => t.meshName === 'RedGlass_L' && t.groupId === 'indicatorLeft'),
    'hazards/indicators use rear RedGlass, not windows',
  )
}

console.log('lamp darkglass window guard: ok')

// Single rear RedGlass mesh with L+R islands (Lixiang GeometryNode_759) splits into Ind L/R.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const expandTranslatedBox = (cx: number) => {
    const g = new BoxGeometry(0.2, 0.12, 0.08)
    g.translate(cx, 0.75, -2.15)
    const idx = g.index!
    const pos = g.getAttribute('position')
    const out = new Float32Array(idx.count * 3)
    for (let i = 0; i < idx.count; i++) {
      const vi = idx.getX(i)
      out[i * 3] = pos.getX(vi)
      out[i * 3 + 1] = pos.getY(vi)
      out[i * 3 + 2] = pos.getZ(vi)
    }
    g.dispose()
    return out
  }
  const eL = expandTranslatedBox(-0.85)
  const eR = expandTranslatedBox(0.85)
  const expanded = new Float32Array(eL.length + eR.length)
  expanded.set(eL, 0)
  expanded.set(eR, eL.length)
  const geom = new BufferGeometry()
  geom.setAttribute('position', new BufferAttribute(expanded, 3))

  const bar = new Mesh(geom, new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }))
  bar.name = 'GeometryNode_759'
  root.add(bar)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply(state)

  const bound = lights.getBoundTargets()
  assert.ok(
    bound.some((t) => t.meshName === 'GeometryNode_759' && t.groupId === 'indicatorLeft'),
    '759 left island → Indicator L',
  )
  assert.ok(
    bound.some((t) => t.meshName === 'GeometryNode_759' && t.groupId === 'indicatorRight'),
    '759 right island → Indicator R',
  )
  assert.ok(Array.isArray(bar.material) && bar.material.length === 2, '759 split into two materials')

  const mats = bar.material as MeshStandardMaterial[]
  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: true, indicatorRight: false, hazards: false },
  })
  // Sketchfab Lixiang: placement +X is vehicle left — split assigns inverted sides.
  assert.equal(isLit(mats[1]), true, 'Ind L lights vehicle-left island material')
  assert.equal(isLit(mats[0]), false, 'Ind L leaves vehicle-right island off')

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: false, indicatorRight: true, hazards: false },
  })
  assert.equal(isLit(mats[1]), false, 'Ind R leaves vehicle-left island off')
  assert.equal(isLit(mats[0]), true, 'Ind R lights vehicle-right island material')
}

console.log('lamp rear bar split: ok')

// Front Orange dual tips (Lixiang GeometryNode_664): Ind L/R each own one tip.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const expandTranslatedBox = (cx: number, cy: number, cz: number) => {
    const g = new BoxGeometry(0.12, 0.06, 0.08)
    g.translate(cx, cy, cz)
    const idx = g.index!
    const pos = g.getAttribute('position')
    const out = new Float32Array(idx.count * 3)
    for (let i = 0; i < idx.count; i++) {
      const vi = idx.getX(i)
      out[i * 3] = pos.getX(vi)
      out[i * 3 + 1] = pos.getY(vi)
      out[i * 3 + 2] = pos.getZ(vi)
    }
    g.dispose()
    return out
  }
  const eL = expandTranslatedBox(-0.7, 0.68, 2.25)
  const eR = expandTranslatedBox(0.7, 0.68, 2.25)
  const expanded = new Float32Array(eL.length + eR.length)
  expanded.set(eL, 0)
  expanded.set(eR, eL.length)
  const geom = new BufferGeometry()
  geom.setAttribute('position', new BufferAttribute(expanded, 3))
  const orange = new Mesh(geom, new MeshStandardMaterial({ name: 'Orange', color: 0x442200 }))
  orange.name = 'GeometryNode_664'
  root.add(orange)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply(state)

  assert.ok(Array.isArray(orange.material) && orange.material.length === 2, 'front Orange split into two mats')
  const mats = orange.material as MeshStandardMaterial[]

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: true, indicatorRight: false },
  })
  assert.equal(isLit(mats[1]), true, 'Ind L lights vehicle-left Orange tip')
  assert.equal(isLit(mats[0]), false, 'Ind L leaves vehicle-right Orange tip off')

  lights.apply({
    ...state,
    groups: { ...state.groups, indicatorLeft: false, indicatorRight: true },
  })
  assert.equal(isLit(mats[1]), false, 'Ind R leaves vehicle-left Orange tip off')
  assert.equal(isLit(mats[0]), true, 'Ind R lights vehicle-right Orange tip only')
}

console.log('lamp front orange split: ok')

// Hazards also amber-flash leftover rear RedGlass (GeometryNode_995 signature strip).
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const left = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const right = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  right.name = 'RedGlass_R'
  right.position.set(0.75, 0.75, -2.15)
  root.add(right)

  const bar = new Mesh(
    new BoxGeometry(1.2, 0.08, 0.06),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  bar.name = 'GeometryNode_995'
  bar.position.set(0, 1.05, -2.1)
  root.add(bar)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply(state)

  assert.ok(
    lights.getBoundTargets().some((t) => t.meshName === 'GeometryNode_995' && t.groupId === 'tail'),
    '995 binds as tail RedGlass',
  )

  lights.apply({
    ...state,
    groups: { ...state.groups, hazards: true, indicatorLeft: false, indicatorRight: false },
  })
  // Force ON half of the blink cycle.
  lights.update(0.02)

  const barMat = (
    Array.isArray(bar.material) ? bar.material[0] : bar.material
  ) as MeshStandardMaterial
  assert.ok(barMat?.isMeshStandardMaterial, '995 still has a standard material')
  assert.equal(isLit(barMat), true, 'hazards amber-lights 995 RedGlass bar')
  assert.equal(barMat.emissive.getHex(), 0xffa020, '995 hazards color is indicator amber')
}

console.log('lamp hazards redglass bar: ok')

// Hazards also amber-flash TailLight strips; cabin Glass stays untouched.
{
  const root = new Group()
  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  const left = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  left.name = 'RedGlass_L'
  left.position.set(-0.75, 0.75, -2.15)
  root.add(left)

  const right = new Mesh(
    new BoxGeometry(0.15, 0.12, 0.08),
    new MeshStandardMaterial({ name: 'RedGlass', color: 0x440000 }),
  )
  right.name = 'RedGlass_R'
  right.position.set(0.75, 0.75, -2.15)
  root.add(right)

  const strip = new Mesh(
    new BoxGeometry(1.4, 0.02, 0.06),
    new MeshStandardMaterial({ name: 'TailLight', color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1 }),
  )
  strip.name = 'GeometryNode_713'
  strip.position.set(0, 1.06, -2.0)
  root.add(strip)

  const cabin = new Mesh(
    new BoxGeometry(1.4, 0.9, 0.05),
    new MeshStandardMaterial({
      name: 'Glass',
      color: 0x0f0f0f,
      transparent: true,
      opacity: 0.3,
      emissive: 0x000000,
      emissiveIntensity: 1,
    }),
  )
  cabin.name = 'GeometryNode_675'
  cabin.position.set(0, 1.15, -0.2)
  root.add(cabin)

  const lights = new VehicleLightsController()
  lights.bind(root)
  const state = createDefaultVehicleLights()
  state.beamProxies = []
  lights.apply({
    ...state,
    groups: { ...state.groups, hazards: true },
  })
  lights.update(0.02)

  const stripMat = (
    Array.isArray(strip.material) ? strip.material[0] : strip.material
  ) as MeshStandardMaterial
  const cabinMat = cabin.material as MeshStandardMaterial
  assert.equal(isLit(stripMat), true, 'hazards amber-lights TailLight strip')
  assert.equal(stripMat.emissive.getHex(), 0xffa020, 'TailLight hazards color is amber')
  assert.equal(isLit(cabinMat), false, 'cabin Glass must not blink on hazards')
  assert.equal(cabinMat.emissive.getHex(), 0, 'cabin Glass emissive stays off')
}

console.log('lamp hazards taillight + glass guard: ok')





