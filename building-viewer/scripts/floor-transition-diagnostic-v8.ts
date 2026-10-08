import assert from 'node:assert/strict'
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, BoxGeometry, Vector3 } from 'three'
import { buildCollisionChunks } from '../src/collision/buildCollisionChunks'
import { CollisionWorld } from '../src/collision/CollisionWorld'
import { CharacterController } from '../src/collision/CharacterController'
import { DEFAULT_CHARACTER_PARAMS } from '../src/collision/types'
import { validateVisiblePlacementSurface } from '../src/controls/PegmanPlacement'
import { buildIcmMissingFloorSupports } from '../src/collision/icmMissingFloorSupports'

const root = new Group(), outside = new Group()
const mat = new MeshBasicMaterial(); mat.name = 'Floor_Wood_Vray_001'
function surface(parent: Group, name: string, y: number, z: number, length: number, mirrored = false) {
 const g = new PlaneGeometry(2, length);g.rotateX(-Math.PI / 2)
 const m = new Mesh(g, mat);m.name=name;m.position.set(0,y,z);if(mirrored)m.scale.x=-1;parent.add(m);return m
}
surface(outside,'COLLIDER_paving',-.02,-2,12)
surface(root,'COLLIDER_node_22',0,1,4,true)
for(let n=0;n<10;n++)surface(root,'COLLIDER_node_'+(100+n),.18*(n+1),-1.15-.3*n,.3,true)
const w=new CollisionWorld();w.setLayerChunks('icm-ext',buildCollisionChunks(outside,{layerId:'icm-ext:proxy',ignoreVisibility:true}).chunks)
w.setLayerChunks('icm-anim-2025',buildCollisionChunks(root,{layerId:'icm-anim-2025:proxy',ignoreVisibility:true}).chunks)
await w.rebuildFromLayers(['icm-ext','icm-anim-2025']);w.setPlacementMode(true)
w.setQueryLayer('icm-ext')
const selected=validateVisiblePlacementSurface(w,{point:new Vector3(0,-.02,2),normal:new Vector3(0,1,0),distance:1,layerId:'icm-ext'},DEFAULT_CHARACTER_PARAMS)
assert.equal(selected.ok,true,'a legitimate rendered exterior floor must remain placeable beside a circulation bridge')
assert.ok(Math.abs(selected.point!.y+.02)<1e-6)
const c=new CharacterController();c.setWorld(w);c.setFeetPosition(new Vector3(0,-.02,2));const zero=new Vector3();for(let i=0;i<30;i++)c.update(1/60,zero,0)
assert.equal(w.getQueryLayer(),'icm-anim-2025','walking must acquire the visible interior floor')
assert.ok(Math.abs(c.position.y)<.003)
for(let i=0;i<1000;i++)c.update(1/60,new Vector3(0,0,-1),.35)
assert.ok(c.position.y>1.4,'anonymous batched treads must lift a walker arriving from the exterior')
assert.equal(c.onGround,true)

const fixture=new Group();surface(fixture,'COLLIDER_handrail',.8,0,4);surface(fixture,'COLLIDER_ceiling',2,0,4)
const unrelated=buildCollisionChunks(fixture,{layerId:'icm-anim-2025:proxy',ignoreVisibility:true})
assert.ok(unrelated.chunks.every(chunk=>!chunk.layerBridge),'rail/ceiling material reuse must not become a circulation bridge')
assert.ok(buildCollisionChunks(root,{layerId:'another-building',ignoreVisibility:true}).chunks.every(chunk=>!chunk.layerBridge),'ICM policy must not alter other buildings')

const missing=new Group();const stair=new Group();stair.name='treppe_bt1_1';missing.add(stair)
for(const x of [-1,1]){const g=new BoxGeometry(.6,.2,3),m=new Mesh(g,mat);m.position.set(x,.9,0);stair.add(m)}
const exact=buildIcmMissingFloorSupports(missing);assert.ok(exact.length)
const exactWorld=new CollisionWorld();exactWorld.setLayerChunks('icm-anim-2025',exact);await exactWorld.rebuildFromLayers(['icm-anim-2025']);exactWorld.setPlacementMode(true)
assert.equal(exactWorld.raycastBestGround(new Vector3(0,1.1,0),2),null,'the U-stair void must remain empty')
assert.ok(Math.abs(exactWorld.raycastBestGround(new Vector3(1,1.1,0),.2)!.point.y-1)<1e-5)
assert.equal(exactWorld.raycastBestGround(new Vector3(1,.85,0),.1),null,'a slab underside must not become a second walking floor')
const skinRoot=new Group();surface(skinRoot,'COLLIDER_floor_skin_bottom',0,0,4);surface(skinRoot,'COLLIDER_floor_skin_top',.05,0,4);
const skinWorld=new CollisionWorld();skinWorld.setLayerChunks('icm-anim-2025',buildCollisionChunks(skinRoot,{layerId:'icm-anim-2025:proxy',ignoreVisibility:true}).chunks);await skinWorld.rebuildFromLayers(['icm-anim-2025']);skinWorld.setPlacementMode(true);
const skinController=new CharacterController();skinController.setWorld(skinWorld);skinController.setFeetPosition(new Vector3(0,0,0));for(let i=0;i<30;i++)skinController.update(1/60,zero,0);
assert.ok(Math.abs(skinController.position.y-.05)<.003,'a 5 cm tread skin must not trap the feet on its underside after gravity');skinWorld.dispose();
w.dispose();exactWorld.dispose();console.log('Floor transition, mirrored support, strict placement and stair void: PASS')
