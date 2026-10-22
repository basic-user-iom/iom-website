import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';
import {runHarpRelease,artifactIdentity,bindingDigest,HARP} from '../scripts/independent-harp-release.mjs';
import {sha256,digest,rootAliasDigest} from '../scripts/independent-harp-recovery.mjs';
const candidate=path.resolve(import.meta.dirname,'..'),runs=path.join(candidate,'tests/.runs');fs.mkdirSync(runs,{recursive:true});
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const walk=(r,p='')=>fs.readdirSync(path.join(r,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(r,p+e.name+'/'):[p+e.name]).sort();
function fixture(){
 const home=fs.mkdtempSync(path.join(runs,'controller-')),root=path.join(home,'repo');fs.mkdirSync(root);
 const b={version:1,enabled:true,...HARP,projectId:'prj_jusDEdRJnTEsMu6q3VgbHpffxp6T',projectName:'iom-harp-configurator',productionOrigin:'https://iom-harp-configurator.vercel.app',cliVersion:'59.16.0',protection:{passwordProtection:null,ssoProtection:{deploymentType:'all'},trustedIps:null}};
 const registry={version:1,projects:{[HARP.project]:{input:'public/demos/'+HARP.project,basePath:HARP.basePath,indexing:'preserve',status:'candidate',normalizeEntryBase:true,requiredFiles:['index.html']}}};
 write(path.join(root,'config/independent-projects.json'),registry);write(path.join(root,'config/independent-harp-binding.json'),b);
 write(path.join(root,'public/demos/'+HARP.project+'/index.html'),'<!doctype html><html><head><title>Inert recovery</title></head><body>Harp fixture</body></html>');
 for(let i=0;i<10;i++)write(path.join(root,'public/demos/'+HARP.project+'/asset'+i+'.json'),{fixture:i});
 for(const f of ['src/crm/sentinel.txt','api/sentinel.js','public/demos/carey/index.html'])write(path.join(root,f),'UNRELATED_NEVER_PUBLISH');
 const git=(...args)=>execFileSync('git',['-c','core.hooksPath=NUL','-c','core.autocrlf=false','-c','commit.gpgSign=false','-c','user.name=Inert Test','-c','user.email=inert@invalid',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','--initial-branch=master');git('add','.');git('commit','-m','Inert recovery fixture');const commit=git('rev-parse','HEAD');
 const release=path.join(home,'release');runHarpRelease({root,args:{operation:'prepare','--target':commit,'--output':release},environment:{}});
 const identity=artifactIdentity(release),config=read(path.join(release,'.vercel/output/config.json'));
 const files=walk(path.join(release,'.vercel/output')).map(f=>{const bytes=fs.readFileSync(path.join(release,'.vercel/output',f));return {path:'.vercel/output/'+f,bytes:bytes.length,sha1:createHash('sha1').update(bytes).digest('hex'),sha256:sha256(bytes)};}).sort((a,b)=>a.path.localeCompare(b.path));
 const codeSHA256={};for(const name of ['independent-harp-cli.mjs','independent-harp-release.mjs','independent-harp-recovery.mjs']){const bytes=fs.readFileSync(path.join(candidate,'scripts',name));write(path.join(root,'scripts',name),bytes.toString());codeSHA256[name]=sha256(bytes);}
 const directory=path.join(root,'.qa-out/harp-independent-release'),stateFile=path.join(directory,'state.json');
 const original={version:1,phase:'stage-issued',attempt:randomUUID(),bindingDigest:bindingDigest(b),...identity,deploymentId:null,expectedProductionDeploymentId:null};write(stateFile,original);const originalBytes=fs.readFileSync(stateFile);
 const failedId='dpl_FailedFixture',rootId='dpl_RootFixture',staging='iom-harp-configurator-ioms-projects-e24b30ec.vercel.app',badRoutes=[{src:'^/wrong$',status:404}];
 const old={id:failedId,projectId:b.projectId,target:'production',readyState:'READY',routes:badRoutes,meta:{iomCommitSha:commit,iomHarpArtifact:identity.artifactDigest,iomHarpAttempt:original.attempt}};
 const project={id:b.projectId,accountId:b.teamId,name:b.projectName,framework:null,buildCommand:null,installCommand:null,outputDirectory:null,rootDirectory:null,link:null,...b.protection};
 const roots=[{alias:'iobjectm.com',projectId:b.rootProjectId,deploymentId:rootId,redirect:null,deletedAt:null}];let current=old,calls=0,mode='ok';
 const remote=()=>({project:structuredClone(project),deployments:{deployments:current===old?[old]:[old,current],pagination:{next:null}},deployment:current,aliases:{aliases:[{alias:staging,projectId:b.projectId,deploymentId:current.id,redirect:null,deletedAt:null}],pagination:{next:null}},rootAliases:{aliases:structuredClone(roots),pagination:{next:null}},files});
 const pins={originalStateSHA256:sha256(originalBytes),bindingFileSHA256:sha256(fs.readFileSync(path.join(root,'config/independent-harp-binding.json'))),failedDeploymentId:failedId,failedAttempt:original.attempt,failedSourceCommit:commit,failedArtifactDigest:identity.artifactDigest,expectedRoutesSHA256:digest(config.routes),failedRoutesSHA256:digest(badRoutes),rootDeploymentId:rootId,stagingAlias:staging,rootAliasesDigest:rootAliasDigest(roots),filesDigest:digest(files)};
 const approvalFile=path.join(home,'approval.json'),a={version:1,approved:true,operation:'reconcile',expiresAt:new Date(Date.now()+3600000).toISOString(),recovery:pins,codeSHA256};write(approvalFile,a);
 const adapter={inspectProject:()=>project,verifyPublishedCommit:()=>true,inspectProduction:()=>null,inspectDeployment:()=>current,inspectRecovery:()=>{
  if(mode==='mutation'&&a.operation==='recover-stage'){const scratch=fs.readdirSync(home).find(n=>n.startsWith('harp-stage-'));fs.appendFileSync(path.join(home,scratch,'payload/.vercel/output/static/demos/'+HARP.project+'/index.html'),'changed after first scan');}
  const r=remote();if(mode==='alias-drift'&&calls)r.aliases.aliases.push({alias:'unexpected.vercel.app'});return r;
 },stage:(binding,r)=>{
  calls++;assert.deepEqual(fs.readFileSync(stateFile),originalBytes);const intent=read(path.join(directory,'successors',original.attempt+'.json'));assert.equal(intent.attempt,r.attempt);
  const persisted=read(path.join(directory,'attempts',r.attempt,'state.json'));assert.equal(persisted.phase,'stage-issued');assert.equal(persisted.attempt,r.attempt);
  const paths=walk(r.payload);assert.equal(paths.length,13);assert(paths.every(p=>p==='.vercel/project.json'||p==='.vercel/output/config.json'||p.startsWith('.vercel/output/static/demos/'+HARP.project+'/')));assert(!paths.some(p=>/crm|carey|package.json/.test(p)));
  if(mode==='lost-response')throw Error('INERT_LOST_RESPONSE');current={id:'dpl_SuccessorFixture',projectId:b.projectId,target:'production',readyState:'READY',routes:config.routes,meta:{iomCommitSha:r.sourceCommit,iomHarpArtifact:r.artifactDigest,iomHarpAttempt:r.attempt}};return current;
 },promote:()=>{throw Error('UNAUTHORIZED_PROMOTION');},build:()=>{throw Error('ROOT_BUILD');},push:()=>{throw Error('SOURCE_PUSH');}};
 const run=()=>runHarpRelease({root,args:{operation:a.operation,'--release':release,'--approval':approvalFile},adapter,environment:{}});
 const rejected=run();assert.equal(calls,0);assert.deepEqual(fs.readFileSync(stateFile),originalBytes);
 Object.assign(a,{operation:'recover-stage',...identity,bindingDigest:bindingDigest(b),expectedProductionDeploymentId:null,rejectionSHA256:rejected.rejectionSHA256,successorAttempt:randomUUID()});a.allowedAliasTransition={hostname:staging,fromDeploymentId:failedId,toAttempt:a.successorAttempt};write(approvalFile,a);
 return {run,setMode:m=>{mode=m;},get calls(){return calls;},directory,stateFile,originalBytes,a};
}
test('guarded controller reconciles without mutation, stages once with durable linkage and exact isolated content',()=>{const f=fixture();const result=f.run();assert.equal(result.status,'recovery-staged-protected-child-alias-only');assert.equal(f.calls,1);assert.deepEqual(fs.readFileSync(f.stateFile),f.originalBytes);const state=read(path.join(f.directory,'attempts',f.a.successorAttempt,'state.json'));assert.equal(state.phase,'staged');assert.throws(()=>f.run());assert.equal(f.calls,1);});
test('lost adapter response leaves original frozen and blocks a second mutation',()=>{const f=fixture();f.setMode('lost-response');assert.throws(()=>f.run(),/INERT_LOST_RESPONSE/);assert.throws(()=>f.run(),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);assert.equal(f.calls,1);assert.deepEqual(fs.readFileSync(f.stateFile),f.originalBytes);});
test('payload mutation during fresh remote reads is caught by final scanner before intent or upload',()=>{const f=fixture();f.setMode('mutation');assert.throws(()=>f.run(),/PUBLISH_PAYLOAD_BYTES_CHANGED/);assert.equal(f.calls,0);assert(!fs.existsSync(path.join(f.directory,'successors')));});
test('post-upload alias drift freezes issued attempt and never retries or promotes',()=>{const f=fixture();f.setMode('alias-drift');assert.throws(()=>f.run(),/RECOVERY_ALIAS_INVENTORY/);assert.equal(f.calls,1);assert.equal(read(path.join(f.directory,'attempts',f.a.successorAttempt,'state.json')).phase,'stage-issued');assert.throws(()=>f.run());assert.equal(f.calls,1);});
