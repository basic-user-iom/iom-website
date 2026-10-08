/** Recreate the byte-identical v11.2 GLB from its Git-sized gzip source. */
import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,resolve,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha256=b=>createHash('sha256').update(b).digest('hex');
export function prepareRuntimeAssets(root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')) {
 const packedRoot=resolve(root,'building-viewer/assets/runtime-pack');
 const manifest=JSON.parse(readFileSync(resolve(packedRoot,'index.json'),'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.assets)||!manifest.assets.length)throw Error('Invalid runtime asset manifest');
 for(const entry of manifest.assets){
  const output=resolve(root,entry.target);
  if(!/^public\/models\/[a-z0-9-]+\/[a-z0-9.-]+\.glb$/.test(entry.target)||!output.startsWith(resolve(root,'public/models')+sep)||basename(entry.packed)!==entry.packed||!Number.isSafeInteger(entry.bytes)||entry.bytes<20||entry.bytes>200*1024*1024||![entry.sha256,entry.packedSha256].every(s=>/^[a-f0-9]{64}$/.test(s)))throw Error('Invalid runtime asset entry');
  if(existsSync(output)){
   const present=readFileSync(output);
   if(present.length!==entry.bytes||sha256(present)!==entry.sha256)throw Error(`Existing model differs from the release: ${entry.target}`);
   continue;
  }
  const packed=readFileSync(resolve(packedRoot,entry.packed));
  if(sha256(packed)!==entry.packedSha256)throw Error('Packed runtime asset hash mismatch');
  const bytes=gunzipSync(packed,{maxOutputLength:entry.bytes});
  if(bytes.length!==entry.bytes||sha256(bytes)!==entry.sha256)throw Error('Decoded runtime asset hash mismatch');
  mkdirSync(dirname(output),{recursive:true});const temporary=output+'.assembling';writeFileSync(temporary,bytes,{flag:'wx'});renameSync(temporary,output);
 }
 return {verified:manifest.assets.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('ICM exact runtime assets:',prepareRuntimeAssets());
