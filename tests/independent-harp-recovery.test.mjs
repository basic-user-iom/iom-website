import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {digest,sha256,rootAliasDigest,validateRecovery,recordRejection,beginSuccessor,assertOriginalUnchanged,assertRecoveryCode} from '../scripts/independent-harp-recovery.mjs';

// Inert fixtures only. No CLI adapter, network client, shell, or live release entry is imported.
const here=import.meta.dirname,runs=path.join(here,'.runs');
fs.mkdirSync(runs,{recursive:true});
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const clone=value=>structuredClone(value);
// Synthetic data only: these target IDs scope the validator, but no captured audit,
// source contents, live approval, token, or credential is included in this test.
const binding={"version":1,"enabled":true,"teamId":"team_9wCcYQpYqlDlPAaUpCqhWXj9","projectId":"prj_jusDEdRJnTEsMu6q3VgbHpffxp6T","rootProjectId":"prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv","projectName":"iom-harp-configurator","productionOrigin":"https://iom-harp-configurator.vercel.app","protection":{"passwordProtection":null,"ssoProtection":{"deploymentType":"all"},"trustedIps":null}};
const bindingBytes=Buffer.from(JSON.stringify(binding,null,2)+'\n');
const original={"version":1,"phase":"stage-issued","attempt":"11111111-1111-4111-8111-111111111111","bindingDigest":"25431997c180a4985c8f0c3a9dd0c4378032453f5ddb3840cc6de4b016443970","sourceCommit":"1111111111111111111111111111111111111111","artifactDigest":"2222222222222222222222222222222222222222222222222222222222222222","files":11,"bytes":44,"payload":"./inert-payload","deploymentId":null,"expectedProductionDeploymentId":null};
const originalBytes=Buffer.from(JSON.stringify(original,null,2)+'\n');
const expectedConfig={version:3,routes:[
 {src:'^/demos/harp-configurator-demo$',status:308,headers:{Location:'/demos/harp-configurator-demo/'}},
 {src:'^/demos/harp-configurator-demo/(.*)$',dest:'/demos/harp-configurator-demo/$1'},
 {handle:'filesystem'},
 {src:'/(.*)',status:404}
]};
const badRoutes=[{src:'/(.*)',dest:'/index.html'}];
const tinyFile=(file,content)=>{const bytes=Buffer.from(content);return {path:file,bytes:bytes.length,sha1:createHash('sha1').update(bytes).digest('hex'),sha256:sha256(bytes)};};
const files=[tinyFile('.vercel/output/config.json',JSON.stringify(expectedConfig)),...Array.from({length:11},(_,i)=>tinyFile('.vercel/output/static/demos/harp-configurator-demo/'+(i===0?'index.html':'asset-'+i+'.txt'),'tiny'))].sort((a,b)=>a.path.localeCompare(b.path));
const rootProject=binding.rootProjectId,rootDeployment='dpl_inertrootbaseline';
const failedDeployment='dpl_inertfailedstage';
const stagingAlias='iom-harp-configurator-ioms-projects-e24b30ec.vercel.app';
const now=Date.parse('2026-10-22T16:18:00.000Z');
const pins={originalStateSHA256:sha256(originalBytes),bindingFileSHA256:sha256(bindingBytes),failedDeploymentId:failedDeployment,failedAttempt:original.attempt,failedSourceCommit:original.sourceCommit,failedArtifactDigest:original.artifactDigest,expectedRoutesSHA256:digest(expectedConfig.routes),failedRoutesSHA256:digest(badRoutes),rootDeploymentId:rootDeployment,stagingAlias,filesDigest:digest(files)};
function fixture(){
 const directory=fs.mkdtempSync(path.join(runs,'case-'));
 fs.writeFileSync(path.join(directory,'state.json'),originalBytes,{flag:'wx'});
 const deployment={id:failedDeployment,projectId:binding.projectId,target:'production',readyState:'READY',routes:clone(badRoutes),meta:{iomCommitSha:original.sourceCommit,iomHarpArtifact:original.artifactDigest,iomHarpAttempt:original.attempt}};
 const remote={project:{id:binding.projectId,accountId:binding.teamId,name:binding.projectName,framework:null,buildCommand:null,installCommand:null,outputDirectory:null,rootDirectory:null,link:null,...clone(binding.protection)},deployments:{deployments:[clone(deployment)],pagination:{next:null}},deployment,
  aliases:{aliases:[{alias:stagingAlias,projectId:binding.projectId,teamId:binding.teamId,deploymentId:failedDeployment,redirect:null,deleted:false}],pagination:{next:null}},
  rootAliases:{aliases:[{alias:'iobjectm.com',projectId:rootProject,teamId:binding.teamId,deploymentId:rootDeployment,redirect:null,deleted:false},{alias:'crm-import-preview.iobjectm.com',projectId:rootProject,teamId:binding.teamId,deploymentId:'dpl_inertotherrootbaseline',redirect:null,deleted:false}],pagination:{next:null}},files:clone(files)};
 const options={directory,originalStateBytes:Buffer.from(originalBytes),bindingBytes:Buffer.from(bindingBytes),approval:{version:1,approved:true,operation:'reconcile',expiresAt:new Date(now+3600000).toISOString(),clearanceReference:'INERT-TEST-ONLY',recovery:clone(pins)},remote,expectedFiles:clone(files),expectedConfig:clone(expectedConfig),now};
 options.approval.recovery.rootAliasesDigest=rootAliasDigest(remote.rootAliases.aliases);
 return {directory,options,stateFile:path.join(directory,'state.json')};
}
function unchanged(f){assert.deepEqual(fs.readFileSync(f.stateFile),originalBytes);}
function successorFixture(){
 const f=fixture(),rejection=recordRejection(f.options);
 const identity={sourceCommit:'a'.repeat(40),artifactDigest:'b'.repeat(64),files:11,bytes:44,payload:path.join(f.directory,'inert-payload')};
 Object.assign(f.options,{identity});
 Object.assign(f.options.approval,{operation:'recover-stage',rejectionSHA256:rejection.sha256,successorAttempt:randomUUID(),bindingDigest:original.bindingDigest,sourceCommit:identity.sourceCommit,artifactDigest:identity.artifactDigest,expectedProductionDeploymentId:null});
 f.options.approval.allowedAliasTransition={hostname:stagingAlias,fromDeploymentId:failedDeployment,toAttempt:f.options.approval.successorAttempt};
 return {...f,rejection};
}
function callFakeStageOnce(f,stage){const started=beginSuccessor(f.options);return stage(started);}
function refreshOriginalPin(f,alter){const state=JSON.parse(f.options.originalStateBytes);alter(state);f.options.originalStateBytes=Buffer.from(JSON.stringify(state));f.options.approval.recovery.originalStateSHA256=sha256(f.options.originalStateBytes);}

test('fixture pins exact frozen original and twelve file identities',()=>{
 assert.equal(sha256(originalBytes),'1dfcfccdd7cfa188b8adb64dae18071656446775286d7b1a95df5adc1d0eca93');
 assert.equal(files.length,12);assert.equal(files.filter(f=>f.path==='.vercel/output/config.json').length,1);
 assert.equal(files.filter(f=>f.path.includes('/static/')).length,11);
});
test('canonical digest ignores object key order but preserves route order and types',()=>{
 assert.equal(digest({a:1,b:{c:2,d:3}}),digest({b:{d:3,c:2},a:1}));
 assert.notEqual(digest(expectedConfig.routes),digest([...expectedConfig.routes].reverse()));
 assert.notEqual(digest({status:404}),digest({status:'404'}));
});
test('valid reconciliation returns original facts, not a staged or promoted record',()=>{
 const f=fixture();assert.deepEqual(validateRecovery(f.options),original);unchanged(f);
 assert.equal(original.phase,'stage-issued');assert.equal(original.deploymentId,null);
});
test('rejection is exclusive evidence only and never calls a mutation callback',()=>{
 const f=fixture();let calls=0;
 const spy=()=>{calls++;throw Error('UNEXPECTED_MUTATION');};
 const result=recordRejection({...f.options,stage:spy,promote:spy,push:spy,deploy:spy});
 assert.equal(calls,0);assert.equal(result.event.kind,'rejected-routing');assert.equal(result.sha256,sha256(fs.readFileSync(result.file)));
 assert.equal(path.dirname(result.file),path.join(f.directory,'rejected'));unchanged(f);
 assert.equal(fs.existsSync(path.join(f.directory,'successors')),false);
});
test('identical rejection returns same immutable bytes without rewriting',()=>{
 const f=fixture(),first=recordRejection(f.options),before=fs.readFileSync(first.file),realWrite=fs.writeFileSync;let writes=0;
 fs.writeFileSync=(...args)=>{writes++;return realWrite(...args);};
 try{const second=recordRejection(f.options);assert.equal(second.sha256,first.sha256);assert.equal(writes,0);assert.deepEqual(fs.readFileSync(first.file),before);}finally{fs.writeFileSync=realWrite;}
 unchanged(f);
});
test('conflicting rejection is not overwritten',()=>{
 const f=fixture(),r=recordRejection(f.options),changed={...r.event,evidenceDigest:'f'.repeat(64)};
 fs.writeFileSync(r.file,JSON.stringify(changed));const bytes=fs.readFileSync(r.file);
 assert.throws(()=>recordRejection(f.options),/RECOVERY_CONFLICTING_REJECTION/);assert.deepEqual(fs.readFileSync(r.file),bytes);unchanged(f);
});
test('truncated rejection fails closed without repair',()=>{
 const f=fixture(),r=recordRejection(f.options);fs.writeFileSync(r.file,'{"version":');
 assert.throws(()=>recordRejection(f.options),/RECOVERY_JSON_INVALID/);assert.equal(fs.readFileSync(r.file,'utf8'),'{"version":');unchanged(f);
});

const invalid=[
 ['unapproved request',f=>f.options.approval.approved=false],
 ['unknown operation',f=>f.options.approval.operation='reset'],
 ['expired approval',f=>f.options.approval.expiresAt=new Date(now).toISOString()],
 ['invalid expiry',f=>f.options.approval.expiresAt='invalid'],
 ['expiry beyond48hours',f=>f.options.approval.expiresAt=new Date(now+49*3600000).toISOString()],
 ['state byte mismatch',f=>f.options.originalStateBytes=Buffer.concat([originalBytes,Buffer.from(' ')])],
 ['binding byte mismatch',f=>f.options.bindingBytes=Buffer.concat([bindingBytes,Buffer.from(' ')])],
 ['failed attempt pin mismatch',f=>f.options.approval.recovery.failedAttempt=randomUUID()],
 ['failed source pin mismatch',f=>f.options.approval.recovery.failedSourceCommit='c'.repeat(40)],
 ['failed artifact pin mismatch',f=>f.options.approval.recovery.failedArtifactDigest='d'.repeat(64)],
 ['wrong failed deployment',f=>f.options.approval.recovery.failedDeploymentId='dpl_wrong'],
 ['original phase promoted',f=>refreshOriginalPin(f,s=>s.phase='promoted')],
 ['original deployment rewritten',f=>refreshOriginalPin(f,s=>s.deploymentId=failedDeployment)],
 ['original baseline rewritten',f=>refreshOriginalPin(f,s=>s.expectedProductionDeploymentId=failedDeployment)],
 ['wrong child project',f=>f.options.remote.project.id=rootProject],
 ['wrong team',f=>f.options.remote.project.accountId='team_wrong'],
 ['wrong project name',f=>f.options.remote.project.name='iom_website'],
 ['Git link drift',f=>f.options.remote.project.link={type:'github'}],
 ['rootDirectory drift',f=>f.options.remote.project.rootDirectory='other'],
 ['build command drift',f=>f.options.remote.project.buildCommand='npm run build'],
 ['install command drift',f=>f.options.remote.project.installCommand='npm install'],
 ['output directory drift',f=>f.options.remote.project.outputDirectory='dist'],
 ['framework drift',f=>f.options.remote.project.framework='vite'],
 ['SSO removed',f=>f.options.remote.project.ssoProtection=null],
 ['SSO scope changed',f=>f.options.remote.project.ssoProtection={deploymentType:'preview'}],
 ['password policy changed',f=>f.options.remote.project.passwordProtection={deploymentType:'all'}],
 ['trusted IP drift',f=>f.options.remote.project.trustedIps={addresses:['127.0.0.1']}],
 ['incomplete deployments',f=>f.options.remote.deployments.pagination.next=1],
 ['missing deployments pagination',f=>delete f.options.remote.deployments.pagination],
 ['incomplete child aliases',f=>f.options.remote.aliases.pagination.next=1],
 ['incomplete root aliases',f=>f.options.remote.rootAliases.pagination.next=1],
 ['no matching deployment',f=>f.options.remote.deployments.deployments=[]],
 ['duplicate matching deployment',f=>f.options.remote.deployments.deployments.push(clone(f.options.remote.deployment))],
 ['unexpected second deployment',f=>f.options.remote.deployments.deployments.push({id:'dpl_extra',meta:{iomHarpAttempt:randomUUID()}})],
 ['wrong detailed deployment',f=>f.options.remote.deployment.id='dpl_other'],
 ['wrong deployment project',f=>f.options.remote.deployment.projectId=rootProject],
 ['preview instead of production',f=>f.options.remote.deployment.target='preview'],
 ['not READY',f=>f.options.remote.deployment.readyState='BUILDING'],
 ['remote source mismatch',f=>f.options.remote.deployment.meta.iomCommitSha='e'.repeat(40)],
 ['remote artifact mismatch',f=>f.options.remote.deployment.meta.iomHarpArtifact='e'.repeat(64)],
 ['remote attempt mismatch',f=>f.options.remote.deployment.meta.iomHarpAttempt=randomUUID()],
 ['routing defect no longer proven',f=>f.options.remote.deployment.routes=clone(expectedConfig.routes)],
 ['missing remote routes',f=>delete f.options.remote.deployment.routes],
 ['expected route pin mismatch',f=>f.options.expectedConfig.routes.reverse()],
 ['canonical child assigned',f=>f.options.remote.aliases.aliases.push({...clone(f.options.remote.aliases.aliases[0]),alias:'iom-harp-configurator.vercel.app'})],
 ['missing known child alias',f=>f.options.remote.aliases.aliases=[]],
 ['root deployment drift',f=>f.options.remote.rootAliases.aliases[0].deploymentId='dpl_changed'],
 ['root alias redirect',f=>f.options.remote.rootAliases.aliases[0].redirect='https://elsewhere.invalid'],
 ['child alias wrong project',f=>f.options.remote.aliases.aliases[0].projectId=rootProject],
 ['child alias wrong team',f=>f.options.remote.aliases.aliases[0].teamId='team_wrong'],
 ['child alias empty team',f=>f.options.remote.aliases.aliases[0].teamId=''],
 ['child alias deleted',f=>f.options.remote.aliases.aliases[0].deleted=true],
 ['child alias protection bypass',f=>f.options.remote.aliases.aliases[0].protectionBypass={enabled:true}],
 ['child alias deletion timestamp',f=>f.options.remote.aliases.aliases[0].deletedAt=now],
 ['child alias redirect',f=>f.options.remote.aliases.aliases[0].redirect='https://elsewhere.invalid'],
 ['child alias deployment drift',f=>f.options.remote.aliases.aliases[0].deploymentId='dpl_changed'],
 ['extra root alias',f=>f.options.remote.rootAliases.aliases.push({...clone(f.options.remote.rootAliases.aliases[0]),alias:'other.invalid'})],
 ['missing root inventory digest',f=>delete f.options.approval.recovery.rootAliasesDigest],
 ['wrong root inventory digest',f=>f.options.approval.recovery.rootAliasesDigest='f'.repeat(64)],
 ['missing file',f=>f.options.remote.files.pop()],
 ['extra file',f=>f.options.remote.files.push(clone(f.options.remote.files[0]))],
 ['duplicate file path',f=>f.options.remote.files[1].path=f.options.remote.files[0].path],
 ['root file path',f=>f.options.remote.files[1].path='.vercel/output/static/index.html'],
 ['traversal file path',f=>f.options.remote.files[1].path='.vercel/output/static/demos/harp-configurator-demo/../other'],
 ['file UID SHA1 mismatch',f=>f.options.remote.files[1].sha1='f'.repeat(40)],
 ['file SHA256 mismatch',f=>f.options.remote.files[1].sha256='f'.repeat(64)],
 ['file size mismatch',f=>f.options.remote.files[1].bytes++],
 ['file proof digest mismatch',f=>f.options.approval.recovery.filesDigest='f'.repeat(64)],
];
for(const [name,alter] of invalid)test('reconciliation refuses '+name,()=>{
 const f=fixture();alter(f);assert.throws(()=>recordRejection(f.options));unchanged(f);
 assert.equal(fs.existsSync(path.join(f.directory,'rejected')),false);
});
test('changed on-disk original refuses rejection despite old valid input bytes',()=>{
 const f=fixture(),changed=Buffer.concat([originalBytes,Buffer.from(' ')]);fs.writeFileSync(f.stateFile,changed);
 assert.throws(()=>recordRejection(f.options),/RECOVERY_ORIGINAL_CHANGED/);assert.deepEqual(fs.readFileSync(f.stateFile),changed);
});
test('file list ordering does not affect closure validation',()=>{const f=fixture();f.options.remote.files.reverse();validateRecovery(f.options);unchanged(f);});

test('successor uses fresh UUID and persists both intent and state before fake stage callback',()=>{
 const f=successorFixture();let calls=0;
 const result=callFakeStageOnce(f,started=>{calls++;assert.ok(fs.existsSync(started.intentFile));assert.ok(fs.existsSync(started.stateFile));assert.equal(json(started.intentFile).attempt,f.options.approval.successorAttempt);assert.equal(json(started.stateFile).phase,'stage-issued');return started;});
 assert.equal(calls,1);assert.notEqual(result.record.attempt,original.attempt);assert.equal(result.record.previousAttempt,original.attempt);
 assert.equal(result.record.deploymentId,null);assert.equal(result.record.expectedProductionDeploymentId,null);unchanged(f);
 assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);assert.equal(calls,1);unchanged(f);
});
test('lost fake stage response leaves durable intent and forbids a second callback',()=>{
 const f=successorFixture();let calls=0;
 assert.throws(()=>callFakeStageOnce(f,started=>{calls++;assert.ok(fs.existsSync(started.intentFile));throw Error('SIMULATED_RESPONSE_LOST_AFTER_UPLOAD');}),/SIMULATED_RESPONSE_LOST/);
 assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);assert.equal(calls,1);unchanged(f);
});
test('intent and successor state are fsynced before fake stage callback',()=>{
 const f=successorFixture(),realSync=fs.fsyncSync;let syncs=0,calls=0;
 fs.fsyncSync=(...args)=>{const result=realSync(...args);syncs++;return result;};
 try{callFakeStageOnce(f,()=>{calls++;assert.equal(syncs,2);});}finally{fs.fsyncSync=realSync;}
 assert.equal(calls,1);unchanged(f);
});
test('intent fsync failure refuses callback and automatic retry',()=>{
 const f=successorFixture(),realSync=fs.fsyncSync;let calls=0;
 fs.fsyncSync=()=>{throw Error('SIMULATED_FSYNC_FAILURE');};
 try{assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SIMULATED_FSYNC_FAILURE/);}finally{fs.fsyncSync=realSync;}
 assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);
 assert.equal(calls,0);unchanged(f);
});
test('crash after intent before successor state refuses retry with no stage callback',()=>{
 const f=successorFixture(),realOpen=fs.openSync;let calls=0;
 const stateSuffix=path.join('attempts',f.options.approval.successorAttempt,'state.json');
 fs.openSync=(file,...args)=>{if(String(file).endsWith(stateSuffix))throw Error('SIMULATED_STATE_WRITE_CRASH');return realOpen(file,...args);};
 try{assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SIMULATED_STATE_WRITE_CRASH/);}finally{fs.openSync=realOpen;}
 assert.ok(fs.existsSync(path.join(f.directory,'successors',original.attempt+'.json')));
 assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);assert.equal(calls,0);unchanged(f);
});
for(const [name,alter] of [
 ['old UUID reused',f=>f.options.approval.successorAttempt=original.attempt],
 ['invalid UUID',f=>f.options.approval.successorAttempt='../reset'],
 ['wrong rejection hash',f=>f.options.approval.rejectionSHA256='f'.repeat(64)],
 ['wrong binding digest',f=>f.options.approval.bindingDigest='f'.repeat(64)],
 ['wrong source',f=>f.options.approval.sourceCommit='c'.repeat(40)],
 ['wrong artifact',f=>f.options.approval.artifactDigest='d'.repeat(64)],
 ['production baseline changed',f=>f.options.approval.expectedProductionDeploymentId=failedDeployment],
 ['expired successor approval',f=>f.options.approval.expiresAt=new Date(now-1).toISOString()],
 ['reconcile approval reused',f=>f.options.approval.operation='reconcile'],
 ['missing alias transition approval',f=>delete f.options.approval.allowedAliasTransition],
 ['wrong alias transition hostname',f=>f.options.approval.allowedAliasTransition.hostname='iom-harp-configurator.vercel.app'],
 ['wrong alias transition baseline',f=>f.options.approval.allowedAliasTransition.fromDeploymentId='dpl_wrong'],
 ['wrong alias transition successor',f=>f.options.approval.allowedAliasTransition.toAttempt=randomUUID()],
])test('successor refuses '+name,()=>{const f=successorFixture();alter(f);assert.throws(()=>beginSuccessor(f.options));assert.equal(fs.existsSync(path.join(f.directory,'successors')),false);unchanged(f);});
test('missing rejection does not authorize a successor',()=>{const f=successorFixture();fs.renameSync(f.rejection.file,f.rejection.file+'.unavailable');assert.throws(()=>beginSuccessor(f.options));assert.equal(fs.existsSync(path.join(f.directory,'successors')),false);unchanged(f);});
for(const content of ['{','{}',JSON.stringify({kind:'other'})])test('existing intent refuses retry even when malformed: '+content,()=>{
 const f=successorFixture(),target=path.join(f.directory,'successors',original.attempt+'.json');fs.mkdirSync(path.dirname(target));fs.writeFileSync(target,content);
 assert.throws(()=>beginSuccessor(f.options),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);assert.equal(fs.readFileSync(target,'utf8'),content);unchanged(f);
});
test('orphan successor directory refuses retry without inventing a new UUID',()=>{const f=successorFixture();fs.mkdirSync(path.join(f.directory,'attempts',f.options.approval.successorAttempt),{recursive:true});assert.throws(()=>beginSuccessor(f.options),/SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED/);unchanged(f);});
test('exclusive intent creation refuses a concurrent writer without overwrite or callback',()=>{
 const f=successorFixture(),target=path.join(f.directory,'successors',original.attempt+'.json'),realOpen=fs.openSync;let raced=false,calls=0;
 fs.openSync=(file,...args)=>{if(String(file)===target&&!raced){raced=true;const fd=realOpen(file,'wx');try{fs.writeFileSync(fd,'concurrent-intent');}finally{fs.closeSync(fd);}}return realOpen(file,...args);};
 try{assert.throws(()=>callFakeStageOnce(f,()=>{calls++;}),/EEXIST/);}finally{fs.openSync=realOpen;}
 assert.equal(calls,0);assert.equal(fs.readFileSync(target,'utf8'),'concurrent-intent');unchanged(f);
});
test('identity extra fields cannot override immutable successor state fields',()=>{
 const f=successorFixture();Object.assign(f.options.identity,{phase:'promoted',attempt:original.attempt,deploymentId:failedDeployment,expectedProductionDeploymentId:failedDeployment});
 const r=beginSuccessor(f.options).record;assert.equal(r.phase,'stage-issued');assert.equal(r.attempt,f.options.approval.successorAttempt);assert.equal(r.deploymentId,null);assert.equal(r.expectedProductionDeploymentId,null);unchanged(f);
});
for(const [name,alter] of [['invalid source format',f=>f.options.identity.sourceCommit='not-a-commit'],['invalid artifact format',f=>f.options.identity.artifactDigest='not-a-digest'],['wrong static file count',f=>f.options.identity.files=12],['invalid byte count',f=>f.options.identity.bytes=-1]])test('successor refuses '+name,()=>{
 const f=successorFixture();alter(f);f.options.approval.sourceCommit=f.options.identity.sourceCommit;f.options.approval.artifactDigest=f.options.identity.artifactDigest;
 assert.throws(()=>beginSuccessor(f.options),/SUCCESSOR_IDENTITY_INVALID/);unchanged(f);
});

function postFixture(){
 const f=successorFixture(),started=beginSuccessor(f.options),successor={...started.record,deploymentId:'dpl_inertsuccessor'};
 const d={...clone(f.options.remote.deployment),id:successor.deploymentId,routes:clone(expectedConfig.routes),meta:{iomCommitSha:successor.sourceCommit,iomHarpArtifact:successor.artifactDigest,iomHarpAttempt:successor.attempt}};
 f.options.remote.deployments.deployments.push(clone(d));f.options.remote.deployment=d;f.options.remote.aliases.aliases[0].deploymentId=d.id;f.options.successor=successor;
 return f;
}
test('post-stage validation accepts exact new attempt and only known alias transition',()=>{const f=postFixture();validateRecovery(f.options);unchanged(f);});
for(const [name,alter] of [
 ['old bad routes',f=>f.options.remote.deployment.routes=clone(badRoutes)],
 ['route reordering',f=>f.options.remote.deployment.routes.reverse()],
 ['extra route field',f=>f.options.remote.deployment.routes[0].unexpected=true],
 ['status type coercion',f=>f.options.remote.deployment.routes[3].status='404'],
 ['third deployment',f=>f.options.remote.deployments.deployments.push({id:'dpl_third',meta:{iomHarpAttempt:randomUUID()}})],
 ['alias left on old deployment',f=>f.options.remote.aliases.aliases[0].deploymentId=failedDeployment],
 ['post-stage SSO drift',f=>f.options.remote.project.ssoProtection=null],
 ['post-stage root drift',f=>f.options.remote.rootAliases.aliases[0].deploymentId='dpl_other'],
])test('post-stage refuses '+name,()=>{const f=postFixture();alter(f);assert.throws(()=>validateRecovery(f.options));unchanged(f);});
test('code pins require all three reviewed modules and exact bytes',()=>{
 const f=fixture(),dir=path.join(f.directory,'code');fs.mkdirSync(path.join(dir,'scripts'),{recursive:true});
 const names=['independent-harp-cli.mjs','independent-harp-release.mjs','independent-harp-recovery.mjs'];
 const approval={codeSHA256:{}};
 for(const name of names){const bytes=Buffer.from('// inert fixture '+name);fs.writeFileSync(path.join(dir,'scripts',name),bytes);approval.codeSHA256[name]=sha256(bytes);}
 assertRecoveryCode(dir,approval);assert.throws(()=>assertRecoveryCode(dir,{codeSHA256:{}}),/RECOVERY_CODE_PINS_REQUIRED/);
 fs.appendFileSync(path.join(dir,'scripts',names[0]),'changed');assert.throws(()=>assertRecoveryCode(dir,approval),/RECOVERY_CODE_CHANGED/);unchanged(f);
});
test('read-only original assertion does not rewrite anything',()=>{const f=fixture();assertOriginalUnchanged(f.directory,originalBytes);unchanged(f);});
test('synthetic immutable original remains byte-identical after all fixture tests',()=>assert.equal(sha256(originalBytes),'1dfcfccdd7cfa188b8adb64dae18071656446775286d7b1a95df5adc1d0eca93'));

test('complete approved root alias inventory preserves existing secondary root alias',()=>{const f=fixture();assert.equal(f.options.remote.rootAliases.aliases.length,2);validateRecovery(f.options);unchanged(f);});
test('root inventory digest is order independent without dropping rows',()=>{const f=fixture(),before=rootAliasDigest(f.options.remote.rootAliases.aliases);f.options.remote.rootAliases.aliases.reverse();assert.equal(rootAliasDigest(f.options.remote.rootAliases.aliases),before);validateRecovery(f.options);unchanged(f);});
for(const [name,alter] of [
 ['secondary root deployment drift',f=>f.options.remote.rootAliases.aliases[1].deploymentId='dpl_changed'],
 ['secondary root alias removed',f=>f.options.remote.rootAliases.aliases.pop()],
 ['secondary root protection drift',f=>f.options.remote.rootAliases.aliases[1].protectionBypass={enabled:true}],
 ['secondary root wrong project despite new pin',f=>{f.options.remote.rootAliases.aliases[1].projectId=binding.projectId;f.options.approval.recovery.rootAliasesDigest=rootAliasDigest(f.options.remote.rootAliases.aliases);}],
 ['secondary root missing deployment ID despite new pin',f=>{delete f.options.remote.rootAliases.aliases[1].deploymentId;f.options.approval.recovery.rootAliasesDigest=rootAliasDigest(f.options.remote.rootAliases.aliases);}],
 ['secondary root malformed deployment ID despite new pin',f=>{f.options.remote.rootAliases.aliases[1].deploymentId='invalid';f.options.approval.recovery.rootAliasesDigest=rootAliasDigest(f.options.remote.rootAliases.aliases);}],
 ['duplicate root alias',f=>f.options.remote.rootAliases.aliases.push(clone(f.options.remote.rootAliases.aliases[0]))],
 ['child protection bypass false still set',f=>f.options.remote.aliases.aliases[0].protectionBypass=false],
 ['pagination missing own next',f=>delete f.options.remote.deployments.pagination.next],
 ['pagination undefined next',f=>f.options.remote.aliases.pagination.next=undefined],
 ['pagination empty cursor',f=>f.options.remote.rootAliases.pagination.next=''],
 ['deployment uid and id disagree',f=>f.options.remote.deployments.deployments[0].uid='dpl_different'],
 ['deployment malformed id',f=>f.options.remote.deployments.deployments[0].id='invalid'],
])test('strict inventory refuses '+name,()=>{const f=fixture();alter(f);assert.throws(()=>recordRejection(f.options));unchanged(f);assert.equal(fs.existsSync(path.join(f.directory,'rejected')),false);});
