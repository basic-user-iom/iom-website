import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';import * as T from 'three';
const compiled=ts.transpileModule(readFileSync('src/EntranceMetal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('require','exports',compiled)(createRequire(import.meta.url),exports);
test('entry finish isolates a shared source and strips coarse color, height and normal maps',()=>{
 const source=new T.MeshPhysicalMaterial({name:'AE35_010_window_C_frame_metal',color:'#cbbbaa',metalness:.2,roughness:.17});
 const texture=new T.Texture();texture.name='original coarse texture';texture.repeat.set(8,8);
 for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','displacementMap','alphaMap'])source[key]=texture;
 const sharedOutside=new T.Mesh(new T.BoxGeometry(),source),before=source.toJSON(),finish=exports.entranceFinish(source);
 assert.equal(sharedOutside.material,source);assert.deepEqual(source.toJSON(),before);assert.deepEqual(texture.repeat.toArray(),[8,8]);assert.notEqual(finish,source);
 for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','aoMap','displacementMap','alphaMap'])assert.equal(finish[key],null);
 assert.equal(finish.color.getHexString(),'51483d');assert.equal(finish.roughness,.24);assert.equal(finish.metalness,1);
 assert.ok(exports.isEntranceFrame('building','AE35_010_window_E_01',source.name));
 for(const [layer,mesh,mat] of [['lobby','AE35_010_building_A_elevator_door',source.name],['building','AE35_010_window_B_01',source.name],['building','AE35_010_window_E_01','AE35_010_glass']])assert.equal(exports.isEntranceFrame(layer,mesh,mat),false);
});
