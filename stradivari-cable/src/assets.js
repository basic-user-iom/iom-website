const mediaUrls={"detail-1.bin":"https://assets.iobjectm.com/iom-website/v1/4ce1ca015ab937e45ee4a71fdd2a22cc3258cd69b492ba6e39583c563cd52e5f/detail-1.bin","detail-2.bin":"https://assets.iobjectm.com/iom-website/v1/0f0e8bb8148d262e6d0dedb6c0060d603832059a44db75ff82f9c0109014ca04/detail-2.bin","detail-3.bin":"https://assets.iobjectm.com/iom-website/v1/82d79c4617fb6d89b9cebd3846a2293729ca0c4a85c0da3c659204a38b5cce2e/detail-3.bin","detail-4.bin":"https://assets.iobjectm.com/iom-website/v1/08c4dae8225a1a1bbdb5d3cc5b92151856db1a7d945740d2b5541ec7011d532a/detail-4.bin","metro-vijzelgracht.hdr":"https://assets.iobjectm.com/iom-website/v1/41dc861f3ae18a9961d3d5a3b48429b1ac2832e5862ad25f8e95c43d3296fb7b/metro-vijzelgracht.hdr","overview.bin":"/_assets/66a719c3bf9c3cee3171e5cb9872a2801571547c980fc0919954fb48db3d2c3d/overview-final.bin"};
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function loadModel(file,progress){
 const response=await fetch(mediaUrls[file]);
 if(!response.ok)throw Error('Model request failed: '+response.status);
 const total=Number(response.headers.get('Content-Length')),reader=response.body.getReader(),chunks=[];let loaded=0;
 while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;progress?.(total?Math.min(100,Math.round(100*loaded/total)):null);}
 const packed=new Blob(chunks);let data;
 if(typeof DecompressionStream==='function')data=await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 else{const {gunzipSync}=await import('three/addons/libs/fflate.module.js');data=gunzipSync(new Uint8Array(await packed.arrayBuffer())).buffer;}
 return loader.parseAsync(data,'');
}
