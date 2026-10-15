import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';import * as T from 'three';
const compiled=ts.transpileModule(readFileSync('src/ReceptionWood.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('require','exports',compiled)(createRequire(import.meta.url),exports);
test('light wood finish isolates the marked top and cabinet return without mutating shared source or LINAR materials',()=>{
 const source=new T.MeshStandardMaterial({name:'AE35_010_reception_05_AE35_010_reception_wood',map:new T.Texture(),roughness:.45});source.map.name='AE35_010_reception_wood';source.map.repeat.set(3,2);const before=source.toJSON(),finish=exports.lightReceptionWood(source);
 assert.notEqual(finish,source);assert.deepEqual(source.toJSON(),before);assert.equal(finish.map,source.map);assert.deepEqual(finish.map.repeat.toArray(),[3,2]);assert.equal(finish.roughness,.64);assert.equal(finish.metalness,0);assert.equal(finish.bumpScale,.000035);assert.equal(finish.normalMap,null);
 for(const mesh of ['AE35_010_reception_04_1','AE35_010_reception_07'])assert.ok(exports.isReceptionWood('lobby',mesh,source.name));
 for(const mesh of ['AE35_010_reception_04_2','AE35_010_reception_04_3','AE35_010_reception_04_4','AE35_010_reception_04_5','AE35_010_reception_04_6','AE35_010_reception_06_1','LINAR_Desk_Front','LINAR_ceiling'])assert.equal(exports.isReceptionWood('lobby',mesh,source.name),false);
 assert.equal(exports.isReceptionWood('building','AE35_010_reception_04_1',source.name),false);assert.equal(exports.isReceptionWood('lobby','AE35_010_reception_04_1','marble'),false);
 const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};finish.onBeforeCompile(shader);const weight=shader.uniforms.receptionWoodGrain.value,tone=shader.uniforms.receptionWoodTone.value;
 assert.ok(weight>0&&weight<.3);const shade=v=>tone.clone().multiplyScalar(1-weight).add(new T.Color(v,v,v).multiplyScalar(weight));const low=shade(.05),high=shade(.5);assert.ok(low.r>.05);assert.ok(high.r-low.r<.15);assert.ok(high.r>low.r);assert.ok(high.r<.8);
});
