const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
const out=path.resolve(__dirname,process.argv[2]||'dist');
(async()=>{
fs.mkdirSync(out,{recursive:true});fs.cpSync(path.join(__dirname,'public'),out,{recursive:true});
await esbuild.build({absWorkingDir:__dirname,entryPoints:{app:'src/bootstrap.js'},outdir:out,bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,legalComments:'linked',nodePaths:[path.resolve(path.dirname(require.resolve('three')),'../..')],alias:{'three/addons':'three/examples/jsm'},chunkNames:'chunks/[name]-[hash]'});
fs.copyFileSync(path.join(__dirname,'src/index.html'),path.join(out,'index.html'));
console.log('Built '+out);
})().catch(e=>{console.error(e);process.exit(1)});
