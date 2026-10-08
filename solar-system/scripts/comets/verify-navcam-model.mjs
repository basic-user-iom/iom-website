import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../../src/data/generated/comet-shapes/',import.meta.url);
const manifest = JSON.parse(await readFile(new URL('source.json',base),'utf8'));
const file = await readFile(new URL('67p-navcam.bin',base));
if (createHash('sha256').update(file).digest('hex')!==manifest.outputSha256) throw new Error('NAVCAM mesh checksum mismatch');
if (file.toString('ascii',0,4)!=='CN01' || file.readUInt32LE(4)!==manifest.vertices || file.readUInt32LE(8)!==manifest.triangles*3) throw new Error('NAVCAM header mismatch');
const offset=12+manifest.vertices*12,edges=new Map();
for(let i=0;i<manifest.triangles;i++) for(let j=0;j<3;j++) {
 const a=file.readUInt32LE(offset+i*12+j*4),b=file.readUInt32LE(offset+i*12+(j+1)%3*4);
 if(a===b||a>=manifest.vertices||b>=manifest.vertices) throw new Error('Invalid NAVCAM face');
 const key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);
}
if([...edges.values()].some(n=>n!==2)) throw new Error('NAVCAM mesh has open or non-manifold edges');
console.log(`NAVCAM asset verified: ${manifest.triangles} closed triangles, ${file.length} bytes, ${manifest.license}`);
