import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function loadModel(file,progress){
 const response=await fetch(new URL('./assets/'+file,location.href));
 if(!response.ok)throw Error('Model request failed: '+response.status);
 const total=Number(response.headers.get('Content-Length')),reader=response.body.getReader(),chunks=[];let loaded=0;
 while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;progress?.(total?Math.min(100,Math.round(100*loaded/total)):null);}
 const packed=new Blob(chunks);let data;
 if(typeof DecompressionStream==='function')data=await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 else{const {gunzipSync}=await import('three/addons/libs/fflate.module.js');data=gunzipSync(new Uint8Array(await packed.arrayBuffer())).buffer;}
 return loader.parseAsync(data,'');
}
