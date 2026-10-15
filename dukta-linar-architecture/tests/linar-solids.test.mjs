import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {createRequire} from 'node:module';import ts from 'typescript';import * as T from 'three';
const fakeContext={fillStyle:'',fillRect(){},getImageData(){return {data:new Uint8ClampedArray(128*512*4)};},putImageData(){}};globalThis.document={createElement:()=>({width:128,height:512,getContext:()=>fakeContext})};
const require=createRequire(import.meta.url),cache=new Map();function load(file){file=resolve(file.endsWith('.ts')?file:file+'.ts');if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id.startsWith('.')?load(resolve(dirname(file),id)):require(id),exports);return exports;}
const {routedBridge}=load('src/LinarSolidGeometry.ts'),{calculateCadCutGeometryMm,cadBridgeProfileHeightMm}=load('src/linar-reference/linarGeometry.ts'),{LinarWalls}=load('src/LinarWalls.ts');
test('outward routed normals are visible from front, rear and cut sides without DoubleSide',()=>{
 const cad=calculateCadCutGeometryMm(9),g=routedBridge(cad,16,0,1),m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));
 for(const [p,d] of [[[0,0,2],[0,0,-1]],[[0,0,-2],[0,0,1]],[[-2,0,-.3],[1,0,0]],[[2,0,-.3],[-1,0,0]]]){const ray=new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d)),hits=ray.intersectObject(m);assert.ok(hits.length);assert.ok(hits[0].face.normal.dot(ray.ray.direction)<0);}
 const panels=new LinarWalls();for(const distance of [1,8]){const c=new T.PerspectiveCamera(75,1,.01,100);c.position.set(31,5.6-distance,-35.35);c.lookAt(31,5.6,-35.35);panels.update(c,false);assert.ok(panels.inspect().solidBatches.filter(b=>b.application==='ceiling').some(b=>b.visible>0));}
 panels.root.traverse(o=>{if(o.isMesh&&/LINAR_4mm_slats|LINAR_routed_bridges/.test(o.name)){assert.equal(o.material.transparent,false);assert.equal(o.material.opacity,1);assert.equal(o.material.depthWrite,true);}});assert.equal(panels.root.getObjectByName('LINAR_filtered_solid_volume'),undefined);
});
test('birch lettering slots remain open from both faces with opaque cut walls',async()=>{
 const {FontLoader}=await import('three/addons/loaders/FontLoader.js'),font=new FontLoader().parse(JSON.parse(readFileSync('public/fonts/helvetiker_regular.typeface.json','utf8'))),{linarLettering}=load('src/LinarLettering.ts'),letters=linarLettering(font,2.2642254446,.2598189542),mesh=new T.Mesh(letters.geometry,letters.material);assert.ok(letters.slots>20);
 for(const [x,y] of letters.geometry.userData.slotCentres){for(const [z,d] of [[.1,-1],[-.1,1]])assert.equal(new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,0,d)).intersectObject(mesh).length,0);const walls=new T.Raycaster(new T.Vector3(x,y,.0045),new T.Vector3(1,0,0)).intersectObject(mesh);assert.ok(walls.length);assert.ok(Math.abs(walls[0].point.x-x-.002)<1e-6,JSON.stringify({x,y,hit:walls[0].point.toArray(),normal:walls[0].face.normal.toArray()}));}
 assert.ok(letters.material.every(m=>!m.transparent&&m.metalness===0));
});
test('routed bridge volumes follow the source three arcs, rear face and clipped end walls',()=>{
 for(const thickness of [4,9,15])for(const [start,end] of [[0,1],[.5,1],[0,.7]]){
  const cad=calculateCadCutGeometryMm(thickness),g=routedBridge(cad,16,start,end),m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
  assert.ok([...g.getAttribute('position').array].every(Number.isFinite));const ray=new T.Raycaster(new T.Vector3(0,0,2),new T.Vector3(0,0,-1));const hits=ray.intersectObject(m);const zs=[...new Set(hits.map(h=>+h.point.z.toFixed(6)))];assert.equal(zs.length,2);assert.ok(Math.abs(zs[0]-(-.5+cadBridgeProfileHeightMm(cad,(start+end)/2)/cad.bridgeHeightMm))<1e-6);assert.equal(zs[1],-.5);
  // A ray across the incision width sees two closed cut walls at each side.
  ray.set(new T.Vector3(-2,0,(zs[0]-.5)/2),new T.Vector3(1,0,0));const xs=[...new Set(ray.intersectObject(m).map(h=>+h.point.x.toFixed(6)))];assert.deepEqual(xs,[-.5,.5]);
  ray.set(new T.Vector3(0,.6,2),new T.Vector3(0,0,-1));assert.equal(ray.intersectObject(m).length,0);
 }
});
test('letter cuts and materials follow wall settings across thickness and incision extremes',async()=>{
 const {FontLoader}=await import('three/addons/loaders/FontLoader.js'),font=new FontLoader().parse(JSON.parse(readFileSync('public/fonts/helvetiker_regular.typeface.json','utf8'))),{linarLettering}=load('src/LinarLettering.ts');
 const signatures=new Set();
 for(const thicknessMm of [4,9,15])for(const incision of [40,60,140,400]){
  const letters=linarLettering(font,2.2642254446,.2598189542,{thicknessMm,incision}),g=letters.geometry,mesh=new T.Mesh(g,letters.material);g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.z-thicknessMm/1000)<1e-8);assert.equal(g.userData.incisionMm,incision);assert.equal(g.userData.bridgeSpanMm,calculateCadCutGeometryMm(thicknessMm).bridgeSpanMm);assert.ok(letters.slots>20);signatures.add(JSON.stringify(g.userData.slotCentres));
  for(const [x,y] of g.userData.slotCentres)for(const [z,d] of [[.1,-1],[-.1,1]])assert.equal(new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,0,d)).intersectObject(mesh).length,0);
  g.dispose();letters.material.forEach(m=>m.dispose());
 }
 assert.equal(signatures.size,12);
 const green=linarLettering(font,2.264,.26,{finish:'mdf',mdfVariant:'valchromat',colour:'mint-green'});assert.equal(green.material[0].color.getHexString(),'608577');assert.equal(green.material[1].color.getHexString(),'608577');
 const reset=linarLettering(font,2.264,.26);assert.equal(reset.material[0].color.getHexString(),'ddc9a7');assert.equal(reset.geometry.userData.thicknessMm,9);assert.equal(reset.geometry.userData.incisionMm,60);
});
function overlaps(a,b){for(const poly of [a,b])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],nx=q[1]-p[1],nz=p[0]-q[0],aa=a.map(v=>v[0]*nx+v[1]*nz),bb=b.map(v=>v[0]*nx+v[1]*nz);if(Math.min(...aa)>=Math.max(...bb)-1e-10||Math.min(...bb)>=Math.max(...aa)-1e-10)return false;}return true;}
test('all three applications retain real thickness, open cuts and collision-free lamellae at bend extremes',()=>{
 const panels=new LinarWalls(),initial=panels.inspect(),green=initial.applications.freestanding;
 assert.equal(green.settings.width,4.8);assert.equal(green.settings.height,2.8);assert.equal(green.settings.thicknessMm,15);assert.equal(green.settings.panels,4);assert.equal(green.settings.bend,100);assert.equal(green.settings.sCurve,50);assert.equal(green.settings.colour,'mint-green');assert.equal(green.shape.effective,100);assert.ok(Math.abs(green.shape.depth-.15269413)<2e-5);assert.ok(green.bounds.max[0]<41);
 for(const id of ['wall','freestanding','ceiling'])for(const thickness of [4,15])for(const bend of [-100,0,100])for(const secondary of [0,100]){
  Object.assign(panels.states[id],{thicknessMm:thickness,bend,sCurve:secondary});panels.rebuild(id);const installation=panels.root.getObjectByName(`LINAR_${id}`),slats=installation.getObjectByName('LINAR_4mm_slats');assert.ok(slats.isInstancedMesh);assert.equal(slats.material.side,T.FrontSide);assert.equal(installation.getObjectByName('LINAR_filtered_surface'),undefined);
  const rectangles=[];for(let i=0;i<slats.count;i++){const matrix=new T.Matrix4();slats.getMatrixAt(i,matrix);const front=new T.Vector3(0,0,.5).applyMatrix4(matrix),back=new T.Vector3(0,0,-.5).applyMatrix4(matrix);assert.ok(Math.abs(front.distanceTo(back)-thickness/1000)<2e-7);rectangles.push([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,z])=>{const p=new T.Vector3(x,0,z).applyMatrix4(matrix);return [p.x,p.z];}));}
  const sorted=rectangles.map((p,i)=>({p,i,min:Math.min(...p.map(v=>v[0])),max:Math.max(...p.map(v=>v[0]))})).sort((a,b)=>a.min-b.min);for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&sorted[j].min<sorted[i].max;j++)assert.equal(overlaps(sorted[i].p,sorted[j].p),false,`${id}/${thickness}/${bend}/${secondary}: intersecting slats ${sorted[i].i},${sorted[j].i}`);
  const shape=panels.inspect().applications[id].shape;assert.ok(shape.depth<=panels.states[id].curve+.001);assert.ok(shape.minimumBridgeContactMm>0);
 }
 panels.reset(true);assert.deepEqual(panels.inspect().applications.freestanding.settings,green.settings);
});

