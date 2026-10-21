import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=await readFile(join(root,'scripts/deploy-production.mjs'),'utf8');
const {matchesDeployScope,invalidFilesForScope}=await import(pathToFileURL(join(root,'scripts/deploy-scope.mjs')));
const build=source.slice(source.indexOf('function buildSnapshot('),source.indexOf('function demoSlugForScope('));
const publish=source.slice(source.indexOf('function deploySnapshot('),source.indexOf('function main()'));
assert(build.startsWith('function buildSnapshot(')&&publish.startsWith('function deploySnapshot('));
const cases=[
  {scopes:['project:lobo-mobo-study'],flag:undefined,remote:false},
  {scopes:['project:lobo-mobo-study'],flag:'false',remote:false},
  {scopes:['project:lobo-mobo-study'],flag:'TRUE',remote:false},
  {scopes:['project:lobo-mobo-study'],flag:'true',remote:true},
  {scopes:['project:lobo-mobo-study','site'],flag:'true',remote:false},
  {scopes:['demo:lobo-mobo-study'],flag:'true',remote:false},
  {scopes:['project:solar-system'],flag:'true',remote:false},
  {scopes:['crm'],flag:'true',remote:false},
  {scopes:['crm-email'],flag:undefined,remote:true,email:true},
  {scopes:['crm-email'],flag:'false',remote:true,email:true},
];
for(const row of cases){
  const env={SENTINEL:'unchanged',...(row.flag===undefined?{}:{IOM_SKIP_BLOG_SYNC:row.flag})};
  const calls=[];
  const context=vm.createContext({Buffer,root,join,process:{env,platform:'win32'},npm:'npm',npx:'npx',
    existsSync:()=>true,symlinkSync:()=>{},rmSync:()=>{},command:()=>{},
    fail:message=>{throw new Error(message)},packageCommand:(tool,args,options)=>calls.push({tool,args,options})});
  vm.runInContext(build+'\n'+publish,context);
  context.buildSnapshot('/stage',row.scopes,{runtimeComplete:true},'PREPARED');
  context.deploySnapshot({stage:'/stage',overlays:{},base:'base'},'head',row.scopes,'PREPARED');
  assert.equal(calls.length,2);
  assert.deepEqual(Array.from(calls[0].args),['run','build']);
  assert.equal(calls[0].options.env.IOM_SKIP_BLOG_SYNC,row.email?'true':row.flag);
  assert.equal(calls[0].options.env.CRM_EMAIL_RELEASE_PHASE,row.email?'PREPARED':undefined);
  assert.equal(calls[0].options.env.SENTINEL,'unchanged');
  const remote=[];calls[1].args.forEach((arg,i)=>{if(arg==='--build-env')remote.push(calls[1].args[i+1])});
  assert.deepEqual(remote,row.email?['IOM_SKIP_BLOG_SYNC=true','CRM_EMAIL_RELEASE_PHASE=PREPARED']:row.remote?['IOM_SKIP_BLOG_SYNC=true']:[]);
  assert.equal(env.IOM_SKIP_BLOG_SYNC,row.flag,'the launching environment must not be mutated');
  assert.equal(env.CRM_EMAIL_RELEASE_PHASE,undefined);
}
const scope='project:lobo-mobo-study';
assert(matchesDeployScope('scripts/deploy-production.mjs',scope));
assert.deepEqual(invalidFilesForScope(['scripts/deploy-production.mjs','scripts/deploy-scope.mjs','lobo-mobo-study/scripts/test-deploy-blog-skip.mjs','public/demos/lobo-mobo-study/index.html'],scope),[]);
for(const file of ['scripts/deploy-production.mjs.backup','scripts/pre-deploy-check.mjs','api/_lib/crm-email-oauth-issuer.mjs','src/crm/CrmApp.tsx','public/demos/stradivari-cable/index.html'])assert(!matchesDeployScope(file,scope),file);
console.log('PASS: 10 captured local/remote build cases; LOBO requires explicit exact true and single project scope; CRM phase unchanged; exact allowlist rejects unrelated paths. No build, deploy or network call was executed.');
