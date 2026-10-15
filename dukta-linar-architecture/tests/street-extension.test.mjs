import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';import * as T from 'three';
const compiled=ts.transpileModule(readFileSync('src/StreetExtension.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('require','exports',compiled)(createRequire(import.meta.url),exports);
test('world clipping preserves quantized source geometry and interpolates texture coordinates',()=>{
 const g=new T.BufferGeometry();const original=new Int16Array([0,0,0,0,0,32767,32767,0,0]);g.setAttribute('position',new T.BufferAttribute(original,3,true));g.setAttribute('normal',new T.Float32BufferAttribute([0,1,0,0,1,0,0,1,0],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,1,1,0],2));
 const m=new T.Mesh(g);m.scale.set(100,1,100);m.position.set(20,0,30);m.updateMatrixWorld(true);
 const result=exports.clip(m,[{x0:70}]);const a=result.getAttribute('position'),uv=result.getAttribute('uv');assert.equal(a.count,3);assert.deepEqual([...original],[0,0,0,0,0,32767,32767,0,0]);
 assert.ok([...a.array].every(Number.isFinite));assert.equal(result.boundingBox.min.x,70);assert.equal(result.boundingBox.max.x,120);assert.equal(result.boundingBox.min.z,30);assert.equal(result.boundingBox.max.z,80);
 const points=Array.from({length:a.count},(_,i)=>new T.Vector3().fromBufferAttribute(a,i));assert.equal(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length()/2,1250);
 for(let i=0;i<a.count;i++){assert.ok(Math.abs(uv.getX(i)-(a.getX(i)-20)/100)<1e-6);assert.ok(Math.abs(uv.getY(i)-(a.getZ(i)-30)/100)<1e-6);}
});
