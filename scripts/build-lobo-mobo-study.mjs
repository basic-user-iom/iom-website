import {build} from 'vite';import {cpSync,existsSync,mkdirSync,readFileSync,rmSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve,sep} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),project=resolve(root,'lobo-mobo-study'),output=resolve(root,'public/demos/lobo-mobo-study');
if(!output.startsWith(resolve(root,'public/demos')+sep))throw Error('Invalid MOBO output scope');
execFileSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',resolve(project,'tsconfig.json')],{cwd:project,stdio:'inherit'});
await build({configFile:resolve(project,'vite.config.ts'),root:resolve(project,'app'),base:'/demos/lobo-mobo-study/',build:{outDir:resolve(project,'dist-public'),emptyOutDir:true}});
const dist=resolve(project,'dist-public'),html=readFileSync(resolve(dist,'index.html'),'utf8');if(!html.includes('noindex, nofollow, noarchive')||!html.includes('<base href="/demos/lobo-mobo-study/">'))throw Error('Missing unlisted/subpath contract');
if(existsSync(output))rmSync(output,{recursive:true});mkdirSync(output,{recursive:true});cpSync(dist,output,{recursive:true});console.log('Built only /demos/lobo-mobo-study/ for unlisted CRM preview.');
