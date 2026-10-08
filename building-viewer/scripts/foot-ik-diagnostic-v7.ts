import assert from 'node:assert/strict'
import { Bone, Group, Vector3, Quaternion } from 'three'
import { stairWalkingSpeed } from '../src/controls/WalkPresentation'
import { solveLeg } from '../src/controls/CharacterFootIK'
for (const scale of [1,.01]) for(const yaw of [0,Math.PI/2,Math.PI]) {
 const root=new Group();root.scale.setScalar(scale);root.rotation.y=yaw;root.position.set(23,7,-11)
 const hip=new Bone(),knee=new Bone(),foot=new Bone();root.add(hip);hip.position.y=1/scale;hip.add(knee);knee.position.set(0,-.44/scale,.025/scale);knee.add(foot);foot.position.set(0,-.445/scale,-.025/scale);root.updateMatrixWorld(true)
 const a=knee.getWorldPosition(new Vector3()).distanceTo(hip.getWorldPosition(new Vector3())),b=foot.getWorldPosition(new Vector3()).distanceTo(knee.getWorldPosition(new Vector3())),positions=[hip,knee,foot].map(o=>o.position.clone()),scales=[hip,knee,foot].map(o=>o.scale.clone())
 for(const delta of [new Vector3(.1,.12,.15),new Vector3(-.08,.24,-.13),new Vector3(0,-.03,0)]) {
  hip.quaternion.identity();knee.quaternion.identity();root.updateMatrixWorld(true)
  const target=foot.getWorldPosition(new Vector3()).add(delta),forward=new Vector3(0,0,1).applyQuaternion(root.quaternion)
  solveLeg(hip,knee,foot,target,forward)
  const h=hip.getWorldPosition(new Vector3()),k=knee.getWorldPosition(new Vector3()),f=foot.getWorldPosition(new Vector3())
  assert.ok(Math.abs(h.distanceTo(k)-a)<1e-6);assert.ok(Math.abs(k.distanceTo(f)-b)<1e-6)
  if(h.distanceTo(target)<a+b-.002)assert.ok(f.distanceTo(target)<1e-5)
  for(const [i,bone]of [hip,knee,foot].entries()){assert.deepEqual(bone.position,positions[i]);assert.deepEqual(bone.scale,scales[i]);assert.ok(bone.quaternion.toArray().every(Number.isFinite))}
 }
}
console.log('Foot IK: PASS (reachable targets, 0.01 rig scale, rotated/translated parent, preserved bone lengths and local translations)')

for (const requested of [.35,1.6,3.2,6.5]) {
  assert.equal(stairWalkingSpeed(requested,'walking'),requested)
  assert.equal(stairWalkingSpeed(requested,'running'),requested)
  assert.equal(stairWalkingSpeed(requested,'stairsUp'),Math.min(requested,.7))
  assert.equal(stairWalkingSpeed(requested,'stairsDown'),Math.min(requested,.6))
}
console.log('Stair pace: PASS (slow input preserved, ascent/descent caps, flat walk/run unchanged)')
