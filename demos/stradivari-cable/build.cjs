const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'public/demos/stradivari-cable');
(async()=>{fs.copyFileSync(path.join(__dirname,'index.html'),path.join(out,'index.html'));
for(const style of ['original','gradual'])for(const count of [20,30]){const variant=style+'-'+count,src=path.join(__dirname,variant),dest=path.join(out,variant,'site');
await esbuild.build({absWorkingDir:src,entryPoints:{app:'src/bootstrap.js'},outdir:dest,bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,legalComments:'linked',nodePaths:[path.join(root,'node_modules')],alias:{'three/addons':'three/examples/jsm'},chunkNames:'chunks/[name]-[hash]'});
fs.copyFileSync(path.join(src,'src/index.html'),path.join(dest,'index.html'));}
console.log('Built Stradivari V12 client review only; runtime media is preserved.');})().catch(e=>{console.error(e);process.exit(1)});
