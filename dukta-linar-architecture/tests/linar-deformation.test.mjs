import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {createRequire} from 'node:module';import ts from 'typescript';
const require=createRequire(import.meta.url),T=require('three');globalThis.document={createElement:()=>({width:128,height:512,getContext:()=>({fillRect(){},getImageData(){return{data:new Uint8ClampedArray(128*512*4)};},putImageData(){}})})};
function loader(legacy=false){const cache=new Map();return function load(file){file=resolve(file.endsWith('.ts')?file:file+'.ts');if(cache.has(file))return cache.get(file);let source=readFileSync(file,'utf8');if(legacy&&file===resolve('src/LinarWalls.ts'))source=readFileSync('evidence/configurator-tour/before-source/LinarWalls.ts','utf8');const e={};cache.set(file,e);new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id.startsWith('.')?load(resolve(dirname(file),id)):require(id),e);return e;};}
test('in-place C/S deformation matches full rebuild solids, backing and diffuser at extremes and after culling',()=>{
 const optimized=new (loader()('src/LinarWalls.ts').LinarWalls)(),legacy=new (loader(true)('src/LinarWalls.ts').LinarWalls)();
 const snapshot=(l,id)=>{const out=[];l.root.getObjectByName(`LINAR_${id}`).traverse(o=>{if(o instanceof T.Mesh)out.push({name:o.name,geometry:[...o.geometry.getAttribute('position').array],matrix:o instanceof T.InstancedMesh?[...o.instanceMatrix.array]:o.matrix.elements,count:o instanceof T.InstancedMesh?o.count:1,material:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({color:m.color?.getHexString(),roughness:m.roughness,opacity:m.opacity}))});});return out;};
 for(const id of ['wall','freestanding','ceiling']){
  for(const l of [optimized,legacy]){Object.assign(l.states[id],{panels:id==='wall'?2:4,width:id==='wall'?2.6:4.8,height:id==='wall'?3.6:2.8,incision:40,thicknessMm:15,backing:id==='ceiling'?'none':'felt'});l.rebuild(id);}
  const identity=optimized.root.getObjectByName(`LINAR_${id}`),first=identity.getObjectByName('LINAR_4mm_slats'),uuid=first.geometry.uuid,material=first.material;
  for(const [bend,sCurve] of [[100,100],[-100,65],[0,100],[42,0],[-70,28],[100,100]]){
   const cam=new T.PerspectiveCamera(50,1,.1,100);cam.position.set(50,5,5);cam.lookAt(50,0,0);cam.updateMatrixWorld();optimized.update(cam,false);
   for(const l of [optimized,legacy]){Object.assign(l.states[id],{bend,sCurve});l.rebuild(id);}
   const a=snapshot(optimized,id),b=snapshot(legacy,id);assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){assert.equal(a[i].name,b[i].name);assert.equal(a[i].count,b[i].count);assert.deepEqual(a[i].material,b[i].material);for(const k of ['geometry','matrix']){assert.equal(a[i][k].length,b[i][k].length);for(let j=0;j<a[i][k].length;j++)assert.ok(Math.abs(a[i][k][j]-b[i][k][j])<.000003,`${id}/${a[i].name}/${k}/${j}`);}}
   assert.equal(optimized.root.getObjectByName(`LINAR_${id}`),identity);assert.equal(first.geometry.uuid,uuid);assert.equal(first.material,material);
  }
 }
 optimized.reset(true);for(const id of ['wall','freestanding','ceiling'])assert.ok(optimized.root.getObjectByName(`LINAR_${id}`));
});
