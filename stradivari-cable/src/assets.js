const mediaUrls={"detail-1.bin":"/_assets/26aac21971c36efee1f81574d7600e3fcf83411d3df475db55409ef7659b5da2/fast-detail-1.bin","detail-2.bin":"/_assets/da8c7bc4e9e33c043243331fa628c7f2507f72e7b28410ce3020c02206a54217/fast-detail-2.bin","detail-3.bin":"/_assets/8d7e4fe9ae9675b4ccafa0c8b0fa83de6d00d62d2855ce9b3f3615667a07ae7a/fast-detail-3.bin","detail-4.bin":"/_assets/8dce977f017689a0cbc2f7ed2cc695921cce8b50e40253a872cc509129cfcf33/fast-detail-4.bin","metro-vijzelgracht.hdr":"/_assets/41dc861f3ae18a9961d3d5a3b48429b1ac2832e5862ad25f8e95c43d3296fb7b/fast-metro-vijzelgracht.hdr","overview.bin":"/_assets/fd81f53d1014018632d2ef78ce12fe111b9493620ae4f3bfc69981022599cd23/fast-overview.bin"};
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function loadModel(file,progress){
 const timing={file,start:performance.now()};window.__loadMetrics.models.push(timing);
 const response=await fetch(mediaUrls[file]);
 if(!response.ok)throw Error('Model request failed: '+response.status);
 const total=response.headers.get('Content-Encoding')?0:Number(response.headers.get('Content-Length')),reader=response.body.getReader(),chunks=[];let loaded=0;
 while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;progress?.(total?Math.min(100,Math.round(100*loaded/total)):null);}
 timing.downloadEnd=performance.now();timing.downloadBytes=loaded;const packed=new Blob(chunks);let data;
 const bytes=await packed.arrayBuffer();if(new DataView(bytes).getUint32(0,true)===0x46546c67)data=bytes;
 else if(typeof DecompressionStream==='function')data=await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 else{const {gunzipSync}=await import('three/addons/libs/fflate.module.js');data=gunzipSync(new Uint8Array(await packed.arrayBuffer())).buffer;}
 timing.decompressEnd=performance.now();const gltf=await loader.parseAsync(data,'');timing.parseEnd=performance.now();return gltf;
}
