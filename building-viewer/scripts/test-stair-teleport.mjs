import {build} from 'esbuild';
for(const entry of ['scripts/stair-teleport-diagnostic.ts','scripts/camera-obstruction-diagnostic.ts']){
 const result=await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',target:'node22',write:false,logLevel:'silent'});
 await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
