import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const base='/demos/wda-booth-preview/';
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.wasm':'application/wasm'};
http.createServer((req,res)=>{
 if(req.url==='/'||req.url===base.slice(0,-1)){res.writeHead(302,{Location:base});return res.end();}
 let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end()}
 if(!url.startsWith(base)||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end()}
 const file=path.resolve(root,url.slice(base.length)||'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end()}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':st.size,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res)});
}).listen(5193,'127.0.0.1',()=>console.log('http://127.0.0.1:5193'+base));
