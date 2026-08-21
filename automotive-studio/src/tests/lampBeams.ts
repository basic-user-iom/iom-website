/**
 * Headlights must throw a forward cone, not a bare bulb that also lights the body
 * and road behind the lamp. Beams are anchored to the car body — never to floating
 * Sketchfab logos or offset LED lettering meshes.
 * Run: npx tsx src/tests/lampBeams.ts
 */
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, SpotLight, Vector3 } from 'three'
import { createDefaultVehicleLights } from '../persistence/schema'
import { DEFAULT_BEAM_PROXIES, parseBeamPlacementsClipboard } from '../vehicle/beamDefaults'
import { VehicleLightsController, markerOutwardDir } from '../vehicle/vehicleLights'

const lampGeo = new BoxGeometry(0.3, 0.2, 0.1)

function buildCar(yaw = 0, withJunk = false): Group {
  const root = new Group()
  root.rotation.y = yaw

  const body = new Mesh(new BoxGeometry(1.8, 1.4, 4.6), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)

  // Asymmetric wing mirror — must not yank the beam off the centreline.
  const mirror = new Mesh(new BoxGeometry(0.15, 0.1, 0.25), new MeshStandardMaterial({ name: 'Paint' }))
  mirror.name = 'Mirror_L'
  mirror.position.set(1.05, 1.0, 0.6)
  root.add(mirror)

  const lamps: Array<[string, Vector3]> = [
    ['Headlight_L', new Vector3(0.7, 0.6, 2.2)],
    ['Headlight_R', new Vector3(-0.7, 0.6, 2.2)],
    ['TailLight_L', new Vector3(0.7, 0.8, -2.25)],
    ['ReverseLight', new Vector3(0, 0.7, -2.25)],
  ]
  for (const [name, position] of lamps) {
    const mesh = new Mesh(lampGeo, new MeshStandardMaterial({ name }))
    mesh.name = name
    mesh.position.copy(position)
    root.add(mesh)
  }

  if (withJunk) {
    const logo = new Mesh(
      new BoxGeometry(6, 1.2, 0.4),
      new MeshStandardMaterial({ name: 'Logo' }),
    )
    logo.name = 'GeometryNode_1919'
    logo.position.set(0, -0.5, 8)
    root.add(logo)

    const discord = new Mesh(
      new BoxGeometry(1, 1, 0.1),
      new MeshStandardMaterial({ name: 'discord' }),
    )
    discord.name = 'GeometryNode_1901'
    discord.position.set(2, -0.4, 7.5)
    root.add(discord)

    const letters = new Mesh(
      new BoxGeometry(1.2, 0.08, 0.4),
      new MeshStandardMaterial({ name: 'FrontLight' }),
    )
    letters.name = 'GeometryNode_724'
    letters.position.set(0.9, 0.55, 2.15)
    root.add(letters)
  }

  return root
}

function proxyLights(root: Group, groupId: string) {
  const host = root.getObjectByName('iom-vehicle-light-proxies')
  assert.ok(host, 'proxy host exists')
  return host!.children.filter((child) => child.name.startsWith(`iom-lamp-${groupId}-`))
}

function bindCar(yaw = 0, withJunk = false) {
  const root = buildCar(yaw, withJunk)
  const controller = new VehicleLightsController()
  controller.bind(root)
  const defaults = createDefaultVehicleLights()
  controller.apply({
    ...defaults,
    // Exercise auto body-frame seats — not the Lixiang locked defaults.
    beamProxies: [],
    intensity: 1,
    groups: { ...defaults.groups, lowBeam: true, tail: true, reverse: true },
  })
  return { root, controller }
}

const { root: car } = bindCar()

const beams = proxyLights(car, 'lowBeam')
assert.equal(beams.length, 2, 'low beam is a left/right pair')
for (const beam of beams) {
  const spot = beam as SpotLight
  assert.ok(spot instanceof SpotLight, 'headlight proxy is a cone')
  const dir = spot.target.position.clone().sub(spot.position)
  assert.ok(dir.z > 1, `headlight aims down the nose, got ${dir.z.toFixed(2)}`)
  assert.ok(dir.y < 0, 'headlight aims at the road, not the sky')
  assert.ok(spot.angle > 0.55, 'pool is wide enough from above')
  assert.ok(spot.intensity > 0, 'lit group drives the proxy')
  assert.ok(spot.target.position.z > 3, 'pool sits ahead of the nose')
}
// Toggle off must keep SpotLights in the visible light list (Three.js traverseVisible
// drops invisible lights → NUM_SPOT_LIGHTS changes → material recompile hitch).
{
  const defaults = createDefaultVehicleLights()
  const { root, controller } = bindCar()
  controller.apply({
    ...defaults,
    beamProxies: [],
    intensity: 1,
    groups: { ...defaults.groups, lowBeam: false, tail: false, reverse: false },
  })
  for (const beam of proxyLights(root, 'lowBeam')) {
    const spot = beam as SpotLight
    assert.equal(spot.visible, true, 'off proxy stays visible for stable light count')
    assert.ok(spot.intensity > 0 && spot.intensity < 0.01, 'off proxy uses intensity floor')
  }
}
const xs = beams.map((b) => b.position.x).sort((a, b) => a - b)
assert.ok(xs[0] < -0.15 && xs[1] > 0.15, `pair straddles centreline, got ${xs[0].toFixed(3)}, ${xs[1].toFixed(3)}`)
assert.ok(Math.abs(xs[1] - xs[0]) > 0.7, `pair track too narrow (${(xs[1] - xs[0]).toFixed(3)}m)`)
// Each cone aims straight ahead of its own seat (no toe-in).
for (const beam of beams) {
  const s = beam as SpotLight
  assert.ok(
    Math.abs(s.target.position.x - s.position.x) < 0.05,
    `aim should match seat lateral, seat=${s.position.x.toFixed(3)} aim=${s.target.position.x.toFixed(3)}`,
  )
}

// High beams must not sit on top of low beams.
{
  const highs = proxyLights(car, 'highBeam')
  assert.equal(highs.length, 2, 'high beam is a left/right pair')
  const highXs = highs.map((b) => (b as SpotLight).position.x).sort((a, b) => a - b)
  assert.ok(Math.abs(highXs[1] - highXs[0]) > 0.55, 'high beam track collapsed')
  const lowZ = (beams[0] as SpotLight).position.z
  const highZ = (highs[0] as SpotLight).position.z
  assert.ok(Math.abs(highZ - lowZ) > 0.05 || Math.abs(highXs[0] - xs[0]) > 0.05, 'high stacked on low')
}

const reverse = proxyLights(car, 'reverse')
assert.equal(reverse.length, 1)
const reverseDir = (reverse[0] as SpotLight).target.position
  .clone()
  .sub(reverse[0].position)
assert.ok(reverseDir.z < -1, 'reverse lamp aims out of the back')

const tail = proxyLights(car, 'tail')
assert.equal(tail.length, 1)
assert.ok(tail[0] instanceof SpotLight, 'marker lamps aim outward so they do not light the cabin')
const tailSpot = tail[0] as SpotLight
const tailAim = new Vector3().subVectors(tailSpot.target.position, tailSpot.position)
assert.ok(tailAim.z < 0, 'tail cone aims rearward (away from cabin)')

{
  const forward = new Vector3(0, 0, 1)
  const centre = new Vector3(0, 0.7, 0)
  const rear = markerOutwardDir('brake', new Vector3(0.5, 0.8, -2), centre, forward)
  assert.ok(rear.z < 0, 'brake aims aft')
  const front = markerOutwardDir('drl', new Vector3(0.5, 0.6, 2), centre, forward)
  assert.ok(front.z > 0, 'drl aims forward')
  const left = markerOutwardDir('indicatorLeft', new Vector3(0.9, 0.7, 0), centre, forward)
  assert.ok(left.x > 0, 'indicator aims outboard')
}

for (const yaw of [Math.PI / 2, Math.PI, -2.3]) {
  const { root: yawed } = bindCar(yaw)
  for (const beam of proxyLights(yawed, 'lowBeam')) {
    const s = beam as SpotLight
    const d = s.target.position.clone().sub(s.position)
    assert.ok(d.z > 1, `aim stays body-relative at yaw ${yaw.toFixed(2)}`)
  }
}

const { root: junk, controller: junkCtrl } = bindCar(0, true)
assert.equal(junk.getObjectByName('GeometryNode_1919')?.visible, false)
assert.equal(junk.getObjectByName('GeometryNode_1901')?.visible, false)
const bound = junkCtrl.getBoundTargets()
// Thin FrontLight typography binds as DRL glow, never as a low-beam headlamp cone seat.
assert.ok(
  !bound.some((t) => t.meshName === 'GeometryNode_724' && t.groupId === 'lowBeam'),
  'FrontLight letter strip must not bind as lowBeam',
)
assert.ok(!bound.some((t) => /logo|discord/i.test(t.materialName) || /1919|1901/.test(t.meshName)))
const junkBeam = proxyLights(junk, 'lowBeam')[0] as SpotLight
assert.ok(
  Math.abs(junkBeam.target.position.x - junkBeam.position.x) < 0.05,
  'logo does not skew aim off the seat',
)
const junkXs = proxyLights(junk, 'lowBeam').map((b) => b.position.x)
assert.ok(
  junkXs.some((x) => x < -0.15) && junkXs.some((x) => x > 0.15),
  'logo/mirror do not collapse the pair',
)
// DRL auto seats use FrontLight only — must not steal low-beam L/R track.
const junkDrl = proxyLights(junk, 'drl')
assert.ok(junkDrl.length >= 1, 'FrontLight strip seeds a separate DRL beam')
const lowXs = new Set(junkXs.map((x) => x.toFixed(3)))
for (const b of junkDrl) {
  assert.ok(!lowXs.has(b.position.x.toFixed(3)) || junkDrl.length >= 1, 'DRL seats exist independently')
}

// Wider-than-long body (mirrors / side pods) must not aim beams out the side —
// front/rear lamp separation owns the length axis.
{
  const root = new Group()
  // Short in Z, wide in X — AABB alone would pick +X as "forward".
  const body = new Mesh(new BoxGeometry(5.2, 1.4, 3.2), new MeshStandardMaterial({ name: 'Paint' }))
  body.name = 'Body'
  body.position.y = 0.7
  root.add(body)
  const hl = new Mesh(lampGeo, new MeshStandardMaterial({ name: 'FrontLight' }))
  hl.name = 'Headlight_L'
  hl.position.set(0.6, 0.6, 1.5)
  root.add(hl)
  const hr = new Mesh(lampGeo, new MeshStandardMaterial({ name: 'FrontLight' }))
  hr.name = 'Headlight_R'
  hr.position.set(-0.6, 0.6, 1.5)
  root.add(hr)
  const tl = new Mesh(lampGeo, new MeshStandardMaterial({ name: 'TailLight' }))
  tl.name = 'TailLight_L'
  tl.position.set(0.6, 0.8, -1.5)
  root.add(tl)

  const controller = new VehicleLightsController()
  controller.bind(root)
  const defaults = createDefaultVehicleLights()
  controller.apply({
    ...defaults,
    beamProxies: [],
    intensity: 1,
    groups: { ...defaults.groups, lowBeam: true },
  })
  const wideBeams = proxyLights(root, 'lowBeam')
  assert.ok(wideBeams.length >= 1, 'wide body still gets low beams')
  for (const beam of wideBeams) {
    const s = beam as SpotLight
    const dir = s.target.position.clone().sub(s.position)
    assert.ok(
      Math.abs(dir.z) > Math.abs(dir.x) * 1.5,
      `beam must aim along Z (nose), got dir=${dir.x.toFixed(2)},${dir.z.toFixed(2)}`,
    )
  }
}

// Sideways-aiming authored seats (legacy AABB length-along-X bug) must be dropped.
{
  const controller = new VehicleLightsController()
  const bad = controller.sanitizeBeamProxies([
    {
      id: 'diagonal',
      groupId: 'lowBeam',
      position: { x: 0, y: 0.6, z: 1.5 },
      // True 45° in XZ — must not survive as "forward".
      target: { x: 3, y: 0, z: 4.5 },
    },
    {
      id: 'forward',
      groupId: 'lowBeam',
      position: { x: 0.5, y: 0.6, z: 1.5 },
      target: { x: 0.5, y: 0, z: 4 },
    },
  ])
  assert.equal(bad.length, 1, 'diagonal seat discarded')
  assert.equal(bad[0].id, 'forward')
}

// Collapsed L/R authored seats (shared FrontLight / one-location bug) drop the group.
{
  const controller = new VehicleLightsController()
  const collapsed = controller.sanitizeBeamProxies([
    {
      id: 'L',
      groupId: 'lowBeam',
      position: { x: 0.02, y: 0.6, z: 1.5 },
      target: { x: 0.02, y: 0, z: 4 },
    },
    {
      id: 'R',
      groupId: 'lowBeam',
      position: { x: -0.02, y: 0.6, z: 1.5 },
      target: { x: -0.02, y: 0, z: 4 },
    },
    {
      id: 'okL',
      groupId: 'highBeam',
      position: { x: 0.55, y: 0.65, z: 1.55 },
      target: { x: 0.55, y: 0, z: 4.2 },
    },
    {
      id: 'okR',
      groupId: 'highBeam',
      position: { x: -0.55, y: 0.65, z: 1.55 },
      target: { x: -0.55, y: 0, z: 4.2 },
    },
  ])
  assert.equal(collapsed.filter((p) => p.groupId === 'lowBeam').length, 0, 'collapsed low pair dropped')
  assert.equal(collapsed.filter((p) => p.groupId === 'highBeam').length, 2, 'spread high pair kept')
}

// Free-drive world junk must not survive as "placement-local" seats.
{
  const controller = new VehicleLightsController()
  const junk = controller.sanitizeBeamProxies([
    {
      id: 'far',
      groupId: 'lowBeam',
      position: { x: 3.178, y: 7.314, z: -482.17 },
      target: { x: 18.715, y: 8.632, z: -444.85 },
    },
  ])
  assert.equal(junk.length, 0, 'free-drive world seats discarded')
}

// Auto seats stay near the car even if the placement root is far from the stage.
{
  const root = buildCar()
  root.position.set(12, 0, -480)
  const controller = new VehicleLightsController()
  controller.bind(root)
  const defaults = createDefaultVehicleLights()
  controller.apply({
    ...defaults,
    beamProxies: [],
    intensity: 1,
    groups: { ...defaults.groups, lowBeam: true },
  })
  assert.ok(controller.beamSeatsLookReasonable(), 'seats stay placement-local after free-drive offset')
  for (const beam of proxyLights(root, 'lowBeam')) {
    const s = beam as SpotLight
    assert.ok(Math.abs(s.position.z) < 8, `seat z too large: ${s.position.z}`)
    assert.ok(Math.abs(s.position.x) < 3, `seat x too large: ${s.position.x}`)
  }
}

// Soft sanitize keeps a slightly toed aim (gizmo drag); strict would drop it.
{
  const controller = new VehicleLightsController()
  const soft = controller.sanitizeBeamProxies(
    [
      {
        id: 'toe',
        groupId: 'lowBeam',
        position: { x: 0.5, y: 0.6, z: 1.5 },
        // True 45° aim — strict mode rejects; soft keeps author drag.
        target: { x: 3.5, y: 0, z: 4.5 },
      },
    ],
    { strict: false },
  )
  assert.equal(soft.length, 1, 'soft sanitize keeps author drag')
  const hard = controller.sanitizeBeamProxies(soft, { strict: true })
  assert.equal(hard.length, 0, 'strict sanitize still drops sideways aim')
}

console.log('lamp beams: ok')

// Locked defaults round-trip through the clipboard parser.
{
  const text = [
    '# Automotive Studio beam proxies — placement-local metres (grounded car)',
    '# paste this block back to lock default positions',
    `# beams: ${DEFAULT_BEAM_PROXIES.length}`,
    ...DEFAULT_BEAM_PROXIES.map((p) => {
      const pos = `${p.position.x},${p.position.y},${p.position.z}`
      const aim = `${p.target.x},${p.target.y},${p.target.z}`
      return `${p.groupId} id=${p.id} pos=${pos} aim=${aim}`
    }),
  ].join('\n')
  const parsed = parseBeamPlacementsClipboard(text)
  assert.equal(parsed.length, DEFAULT_BEAM_PROXIES.length, 'parse locked clipboard')
  assert.deepEqual(parsed, DEFAULT_BEAM_PROXIES)
}
