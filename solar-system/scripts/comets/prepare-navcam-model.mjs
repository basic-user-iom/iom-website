import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MeshoptSimplifier } from 'meshoptimizer';
const sourceUrl = 'https://pds-smallbodies.astro.umd.edu/holdings/ro-c-multi-5-67p-shape-v2.0/data/triplate/spc_esa/mtp019/cshp_dv_130_01_lores_obj.obj';
const source = process.argv[2] ? await readFile(process.argv[2]) : Buffer.from(await (await fetch(sourceUrl)).arrayBuffer());
const vertices = [], faces = [];
for (const line of source.toString('utf8').split(/\r?\n/)) {
  const [kind,...parts] = line.trim().split(/\s+/);
  if (kind === 'v') vertices.push(...parts.map(Number));
  if (kind === 'f') faces.push(...parts.map(v => Number(v.split('/')[0])-1));
}
if (vertices.length !== 52098*3 || faces.length !== 104192*3) throw new Error('Unexpected ESA source topology');
await MeshoptSimplifier.ready;
const originalPositions = new Float32Array(vertices);
const locks=new Uint8Array(vertices.length/3);
let indices,error;
for(let attempt=0;attempt<8;attempt++) {
 [indices,error]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(faces),originalPositions,3,originalPositions,3,[0,0,0],locks,24000*3,0.001,['LockBorder']);
 const edges=new Map();
 for(let i=0;i<indices.length;i+=3) for(let j=0;j<3;j++) {
  const a=indices[i+j],b=indices[i+(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
  edges.set(key,(edges.get(key)||0)+1);
 }
 const bad=[...edges].filter(([,n])=>n!==2);
 if(!bad.length) break;
 // Keep the original neighborhood of any collapsed thin feature.
 const protectedVertices=new Set(bad.flatMap(([key])=>key.split(':').map(Number)));
 for(let i=0;i<faces.length;i+=3) if(faces.slice(i,i+3).some(v=>protectedVertices.has(v)))
  for(let j=0;j<3;j++) locks[faces[i+j]]=1;
}
const [remap,count] = MeshoptSimplifier.compactMesh(indices);
const positions = new Float32Array(count*3);
for (let i=0;i<remap.length;i++) if(remap[i]<count) positions.set(originalPositions.subarray(i*3,i*3+3),remap[i]*3);
// Preserve CHEOPS origin and axis proportions; normalize volume to the catalog radius.
let volume=0;
for(let i=0;i<indices.length;i+=3){
 const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
 volume+=(positions[a]*(positions[b+1]*positions[c+2]-positions[b+2]*positions[c+1])+positions[a+1]*(positions[b+2]*positions[c]-positions[b]*positions[c+2])+positions[a+2]*(positions[b]*positions[c+1]-positions[b+1]*positions[c]))/6;
}
const volumeRadiusKm=Math.cbrt(Math.abs(volume)*3/(4*Math.PI));
for(let i=0;i<positions.length;i++) positions[i]/=volumeRadiusKm;
if(volume<0) for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
const edges=new Map();
for(let i=0;i<indices.length;i+=3) for(let j=0;j<3;j++){
 const a=indices[i+j],b=indices[i+(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
 edges.set(key,(edges.get(key)||0)+1);
}
if([...edges.values()].some(n=>n!==2)) {console.log([...edges].filter(([k,n])=>n!==2).slice(0,15));throw new Error('Derived shape is not watertight');}
const output=Buffer.alloc(12+positions.byteLength+indices.byteLength);
output.write('CN01');output.writeUInt32LE(count,4);output.writeUInt32LE(indices.length,8);
Buffer.from(positions.buffer).copy(output,12);Buffer.from(indices.buffer).copy(output,12+positions.byteLength);
const directory=new URL('../../src/data/generated/comet-shapes/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('67p-navcam.bin',directory),output);
const hash=b=>createHash('sha256').update(b).digest('hex');
await writeFile(new URL('source.json',directory),JSON.stringify({
 assetId:'67p-esa-navcam-mtp019-web-v1',credit:'ESA/Rosetta/NAVCAM',
 citation:'ESA/RMOC, SPC-ESA MTP019 CARTESIAN TRIPLATE MODEL FOR COMET 67P/C-G OBJ FORMAT LOW RES, RO-C-MULTI-5-67P-SHAPE-V2.0:CSHP_DV_130_01_LORES_OBJ, NASA Planetary Data System and ESA Planetary Science Archive, 2017.',
 sourceUrl,sourceLabelUrl:sourceUrl.replace('.obj','.lbl'),
 sourcePage:'https://blogs.esa.int/rosetta/2015/11/30/new-comet-shape-model/',
 license:'CC BY-SA 3.0 IGO',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/igo/',
 sourceSha256:hash(source),outputSha256:hash(output),outputBytes:output.length,
 sourceVertices:vertices.length/3,sourceTriangles:faces.length/3,vertices:count,triangles:indices.length/3,
 simplificationRelativeError:error,sourceVolumeRadiusKm:volumeRadiusKm,
 processing:'Meshoptimizer simplification, shared vertices, outward winding, uniform normalization to unit volume-equivalent radius. Original axis proportions and CHEOPS origin retained. App scales uniformly to its existing catalog radius; spin is illustrative. No photographic texture. Added material detail and exposure/fill are illustrative. This derived mesh retains CC BY-SA 3.0 IGO; no ESA endorsement.',
},null,2)+'\n');
console.log({vertices:count,triangles:indices.length/3,bytes:output.length,error,volumeRadiusKm});
