/** Protected npm deploy branch. No automatic project creation, linking, push, root build or R2. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {captureSnapshot} from './capture-project-snapshot.mjs';
import {prepareProject,listFiles,assertPlainPath,outputConfig,validateProject} from './prepare-independent-project.mjs';
import {verifyArtifact} from './verify-independent-artifact.mjs';
import {assertReleaseManifestSecrets,knownValuesFromEnvironment,withScannedRelease} from './deploy-secret-scan.mjs';

export const HARP=Object.freeze({project:'harp-configurator-demo',basePath:'/demos/harp-configurator-demo/',teamId:'team_9wCcYQpYqlDlPAaUpCqhWXj9',rootProjectId:'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv'});
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{const e=new Error(code);e.name='DeployBlockedError';throw e;};
const check=(ok,code)=>{if(!ok)fail(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sync=value=>{check(!(value&&typeof value.then==='function'),'ASYNC_ADAPTER_REFUSED');return value;};
export function readJson(file){try{assertPlainPath(path.resolve(file));const s=fs.statSync(file);check(s.isFile()&&s.nlink===1&&s.size<1024*1024,'JSON_INPUT_REFUSED');return JSON.parse(fs.readFileSync(file,'utf8'));}catch{fail('JSON_INPUT_REFUSED');}}
export function bindingDigest(b){return hash(JSON.stringify(b));}
export function validateBinding(b){
 check(b?.version===1&&b.enabled===true,'CHILD_BINDING_NOT_APPROVED');
 check(b.project===HARP.project&&b.basePath===HARP.basePath&&b.teamId===HARP.teamId&&b.rootProjectId===HARP.rootProjectId,'CHILD_BOUNDARY_MISMATCH');
 check(typeof b.projectId==='string'&&/^prj_[A-Za-z0-9]+$/.test(b.projectId)&&b.projectId!==HARP.rootProjectId,'CHILD_PROJECT_REFUSED');
 check(typeof b.projectName==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(b.projectName)&&b.projectName!=='iom-website'&&b.projectName!=='iom_website','CHILD_NAME_REFUSED');
 let u;try{u=new URL(b.productionOrigin);}catch{fail('CHILD_ORIGIN_REFUSED');}
 check(u.protocol==='https:'&&u.origin===b.productionOrigin&&!u.username&&!u.password&&u.port===''&&u.hostname.endsWith('.vercel.app'),'CHILD_ORIGIN_REFUSED');
 check(typeof b.cliVersion==='string'&&/^\d+\.\d+\.\d+$/.test(b.cliVersion),'CLI_VERSION_NOT_PINNED');
 check(b.protection&&same(Object.keys(b.protection).sort(),['passwordProtection','ssoProtection','trustedIps']),'PROTECTION_NOT_PINNED');
 return b;
}
export function artifactIdentity(release){
 const r=readJson(path.join(release,'verification.json'));
 check(r.project===HARP.project&&r.basePath===HARP.basePath&&/^[a-f0-9]{40}$/.test(r.sourceCommit),'ARTIFACT_SCOPE_REFUSED');
 const files=[...r.files].sort((a,b)=>a.path.localeCompare(b.path));
 return {sourceCommit:r.sourceCommit,artifactDigest:hash(JSON.stringify({project:r.project,basePath:r.basePath,sourceCommit:r.sourceCommit,configSHA256:r.configSHA256,files})),files:r.fileCount,bytes:r.totalBytes};
}
export function validateApproval(a,operation,b,identity,now=Date.now()){
 check(a?.version===1&&a.approved===true&&a.operation===operation,'RELEASE_APPROVAL_REQUIRED');
 const expires=Date.parse(a.expiresAt);check(Number.isFinite(expires)&&expires>now&&expires<=now+48*3600*1000,'APPROVAL_EXPIRED_OR_INVALID');
 check(a.bindingDigest===bindingDigest(b)&&a.sourceCommit===identity.sourceCommit&&a.artifactDigest===identity.artifactDigest,'APPROVAL_BINDING_MISMATCH');
 if(operation==='promote')check(a.deploymentId===identity.deploymentId&&a.onlineChecksPassed===true,'ONLINE_APPROVAL_REQUIRED');
 check(a.expectedProductionDeploymentId===null||/^dpl_[A-Za-z0-9]+$/.test(a.expectedProductionDeploymentId??''),'PRODUCTION_BASELINE_REQUIRED');
}
export function validateProjectMetadata(p,b){
 check(p?.id===b.projectId&&p.accountId===b.teamId&&p.name===b.projectName,'REMOTE_PROJECT_MISMATCH');
 check(p.framework==null&&p.buildCommand==null&&p.link==null,'CHILD_PROJECT_NOT_STATIC_ISOLATED');
 const protection={passwordProtection:p.passwordProtection??null,ssoProtection:p.ssoProtection??null,trustedIps:p.trustedIps??null};
 check(same(protection,b.protection),'REMOTE_PROTECTION_DRIFT');
}
export function validateDeployment(d,b,record){
 check(/^dpl_[A-Za-z0-9]+$/.test(record.deploymentId??''),'DEPLOYMENT_ID_INVALID');
 check(d?.id===record.deploymentId&&d.projectId===b.projectId&&d.target==='production'&&d.readyState==='READY','DEPLOYMENT_BINDING_MISMATCH');
 check(d.meta?.iomCommitSha===record.sourceCommit&&d.meta?.iomHarpArtifact===record.artifactDigest&&d.meta?.iomHarpAttempt===record.attempt,'DEPLOYMENT_PROVENANCE_MISMATCH');
}
function receiptCheck(release,registry,knownValues){
 let result;try{result=verifyArtifact(release,{knownValues});}catch(e){if(e.name==='SecretScanError')throw e;fail('ARTIFACT_VERIFICATION_FAILED');}
 const id=artifactIdentity(release);
 const actual=readJson(path.join(release,'.vercel/output/config.json'));
 check(same(actual,outputConfig(validateProject(registry,HARP.project))),'OUTPUT_ROUTING_POLICY_CHANGED');
 check(result.project===HARP.project&&result.basePath===HARP.basePath,'WRONG_PROJECT');return id;
}
function prepareFromCommit(root,commit,output,knownValues){
 check(/^[a-f0-9]{40}$/.test(commit),'EXACT_COMMIT_REQUIRED');
 const snapshotPath=output+'.source-snapshot.json';
 check(!fs.existsSync(output)&&!fs.existsSync(snapshotPath),'FRESH_OUTPUT_REQUIRED');
 captureSnapshot({repository:root,commit,projectIds:[HARP.project],configPath:path.join(root,'config/independent-projects.json'),output:snapshotPath});
 prepareProject({sourceRoot:root,output,projectId:HARP.project,configPath:path.join(root,'config/independent-projects.json'),snapshotPath,knownValues});
 return output;
}
function scanPayload(payload,expected,b,knownValues,expectedIdentity){
 assertPlainPath(payload);
 // Only the exact non-served project binding may exist beside Build Output.
 // Keep the unchanged scanner rooted at Build Output, as in the packager.
 const metadata=path.join(payload,'.vercel'),output=path.join(metadata,'output'),link=path.join(metadata,'project.json');
 assertPlainPath(metadata);assertPlainPath(output);
 check(same(fs.readdirSync(payload).sort(),['.vercel'])&&same(fs.readdirSync(metadata).sort(),['output','project.json']),'PUBLISH_PAYLOAD_CLOSURE_CHANGED');
 check(same(readJson(link),{orgId:b.teamId,projectId:b.projectId}),'PROJECT_LINK_CHANGED');
 const files=listFiles(output);
 const transportFiles=[{path:'.vercel/project.json',size:fs.statSync(link).size},...files.map(f=>({path:'.vercel/output/'+f.path,size:f.size}))];
 check(same(transportFiles.map(f=>f.path).sort(),Object.keys(expected).sort()),'PUBLISH_PAYLOAD_CLOSURE_CHANGED');
 for(const f of transportFiles)check(f.size===expected[f.path].bytes&&hash(fs.readFileSync(path.join(payload,f.path)))===expected[f.path].sha256,'PUBLISH_PAYLOAD_BYTES_CHANGED');
 return assertReleaseManifestSecrets(output,{files,fileCount:files.length,totalSize:files.reduce((n,f)=>n+f.size,0)},{knownValues,expectedIdentity});
}
function writeExclusive(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});assertPlainPath(path.dirname(file));fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function writeState(file,value){assertPlainPath(file);const temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,file);}
export function parseHarpOperation(argv){
 if(!argv.some(x=>x.startsWith('--harp-release')))return null;
 const args={};for(let i=0;i<argv.length;i++){
  const x=argv[i];if(x.startsWith('--harp-release=')){check(!args.operation,'DUPLICATE_ARGUMENT');args.operation=x.slice('--harp-release='.length);continue;}
  check(['--target','--output','--release','--approval'].includes(x)&&argv[i+1]&&!argv[i+1].startsWith('--')&&!Object.hasOwn(args,x),'INVALID_HARP_ARGUMENT');args[x]=argv[++i];
 }
 const shape={prepare:['--output','--target'],stage:['--approval','--release'],inspect:[],promote:['--approval']}[args.operation];
 check(shape&&same(Object.keys(args).filter(k=>k!=='operation').sort(),shape),'INVALID_HARP_ARGUMENT');return args;
}
function runUnlocked({root,args,adapter,environment=process.env,now=Date.now()}){
 root=path.resolve(root);assertPlainPath(root);
 const registry=readJson(path.join(root,'config/independent-projects.json')),knownValues=knownValuesFromEnvironment(environment);
 if(args.operation==='prepare'){
  const output=path.resolve(args['--output']);prepareFromCommit(root,args['--target'],output,knownValues);
  return {status:'prepared-locally-not-published',...receiptCheck(output,registry,knownValues),output};
 }
 const b=validateBinding(readJson(path.join(root,'config/independent-harp-binding.json')));
 check(adapter&&typeof adapter.inspectProject==='function','PUBLISH_ADAPTER_REQUIRED');
 const stateFile=path.join(root,'.qa-out/harp-independent-release/state.json');
 const project=()=>validateProjectMetadata(sync(adapter.inspectProject(b)),b);
 if(args.operation==='inspect'){
  const r=readJson(stateFile);check(r.bindingDigest===bindingDigest(b),'STATE_BINDING_MISMATCH');
  check(r.deploymentId,'UNKNOWN_STAGE_OUTCOME_REQUIRES_INSPECTION');project();
  const d=sync(adapter.inspectDeployment(b,r.deploymentId));validateDeployment(d,b,r);
  const liveId=sync(adapter.inspectProduction(b))?.id??null;let phase=r.phase;
  if(r.phase==='stage-issued'){
   check(liveId===r.expectedProductionDeploymentId,'UNEXPECTED_PRODUCTION_CHANGE_REQUIRES_REVIEW');phase='staged';
  }else if(r.phase==='promotion-issued'){
   check(liveId===r.deploymentId,'PROMOTION_NOT_CONFIRMED_REQUIRES_REVIEW');phase='promoted';
  }
  if(phase!==r.phase)writeState(stateFile,{...r,phase});
  return {status:'inspected-ready',recordedPhase:phase,deploymentId:r.deploymentId,sourceCommit:r.sourceCommit,artifactDigest:r.artifactDigest};
 }
 const a=readJson(path.resolve(args['--approval']));
 if(args.operation==='promote'){
  const r=readJson(stateFile);check(r.phase==='staged'&&r.bindingDigest===bindingDigest(b),'STAGED_RECORD_REQUIRED');
  validateApproval(a,'promote',b,r,now);project();validateDeployment(sync(adapter.inspectDeployment(b,r.deploymentId)),b,r);
  check(sync(adapter.verifyPublishedCommit(root,r.sourceCommit))===true,'SOURCE_COMMIT_NOT_PUBLISHED');
  check((sync(adapter.inspectProduction(b))?.id??null)===a.expectedProductionDeploymentId,'PRODUCTION_BASELINE_CHANGED');
  check(bindingDigest(validateBinding(readJson(path.join(root,'config/independent-harp-binding.json'))))===bindingDigest(b),'BINDING_CHANGED_DURING_RELEASE');
  const freshApproval=readJson(path.resolve(args['--approval']));
  validateApproval(freshApproval,'promote',b,r,Math.max(now,Date.now()));
  check(same(freshApproval,a),'APPROVAL_CHANGED_DURING_RELEASE');
  writeState(stateFile,{...r,phase:'promotion-issued',promotionBaselineId:a.expectedProductionDeploymentId});
  sync(adapter.promote(b,r.deploymentId));
  const live=sync(adapter.inspectProduction(b));check(live?.id===r.deploymentId,'PROMOTION_OUTCOME_UNCERTAIN');validateDeployment(live,b,r);
  writeState(stateFile,{...r,phase:'promoted'});return {status:'promoted',deploymentId:r.deploymentId,sourceCommit:r.sourceCommit};
 }
 check(args.operation==='stage','UNKNOWN_OPERATION');
 let previousBytes=null;
 if(fs.existsSync(stateFile)){
  const previous=readJson(stateFile);check(previous.phase==='promoted'&&previous.bindingDigest===bindingDigest(b),'PRIOR_STAGE_RECORD_REQUIRES_REVIEW');
  previousBytes=fs.readFileSync(stateFile);
 }
 const release=path.resolve(args['--release']),identity=receiptCheck(release,registry,knownValues);
 validateApproval(a,'stage',b,identity,now);
 // Recreate from the actual committed static input. A self-consistent forged receipt cannot add payload.
 const scratch=fs.mkdtempSync(path.join(path.dirname(root),'harp-stage-'));
 const recreated=prepareFromCommit(root,identity.sourceCommit,path.join(scratch,'verified'),knownValues);
 check(artifactIdentity(recreated).artifactDigest===identity.artifactDigest,'RELEASE_DOES_NOT_MATCH_COMMITTED_SOURCE');
 const payload=path.join(scratch,'payload');fs.mkdirSync(payload);
 fs.cpSync(path.join(recreated,'.vercel'),path.join(payload,'.vercel'),{recursive:true,errorOnExist:true,force:false});
 fs.writeFileSync(path.join(payload,'.vercel/project.json'),JSON.stringify({orgId:b.teamId,projectId:b.projectId})+'\n',{flag:'wx'});
 const freshReceipt=readJson(path.join(recreated,'verification.json'));
 const configBytes=fs.readFileSync(path.join(recreated,'.vercel/output/config.json'));
 const linkBytes=Buffer.from(JSON.stringify({orgId:b.teamId,projectId:b.projectId})+'\n');
 const expected={'.vercel/project.json':{bytes:linkBytes.length,sha256:hash(linkBytes)},'.vercel/output/config.json':{bytes:configBytes.length,sha256:freshReceipt.configSHA256},...Object.fromEntries(freshReceipt.files.map(f=>['.vercel/output/static/'+f.path,{bytes:f.bytes,sha256:f.sha256}]))};
 const record={version:1,phase:'stage-issued',attempt:randomUUID(),bindingDigest:bindingDigest(b),...identity,payload,deploymentId:null,expectedProductionDeploymentId:a.expectedProductionDeploymentId};
 let result;
 withScannedRelease({verifyOnly:false,
  scan:expectedIdentity=>scanPayload(payload,expected,b,knownValues,expectedIdentity),
  // Preserve the published-source requirement without pushing unrelated root commits.
  push:()=>{project();check(sync(adapter.verifyPublishedCommit(root,identity.sourceCommit))===true,'SOURCE_COMMIT_NOT_PUBLISHED');check((sync(adapter.inspectProduction(b))?.id??null)===a.expectedProductionDeploymentId,'PRODUCTION_BASELINE_CHANGED');},
  publish:()=>{
   check(bindingDigest(validateBinding(readJson(path.join(root,'config/independent-harp-binding.json'))))===bindingDigest(b),'BINDING_CHANGED_DURING_RELEASE');
   const freshApproval=readJson(path.resolve(args['--approval']));
   validateApproval(freshApproval,'stage',b,identity,Math.max(now,Date.now()));
   check(same(freshApproval,a),'APPROVAL_CHANGED_DURING_RELEASE');
   if(previousBytes){
    check(fs.existsSync(stateFile)&&hash(fs.readFileSync(stateFile))===hash(previousBytes),'STATE_CHANGED');
    const archived=path.join(path.dirname(stateFile),'history',hash(previousBytes)+'.json');
    writeExclusive(archived,JSON.parse(previousBytes));fs.unlinkSync(stateFile);
   }
   writeExclusive(stateFile,record); // Persist intent before the first potentially uncertain mutation.
   const d=sync(adapter.stage(b,{payload,sourceCommit:identity.sourceCommit,artifactDigest:identity.artifactDigest,attempt:record.attempt}));
   check(d&&typeof d.id==='string'&&/^dpl_[A-Za-z0-9]+$/.test(d.id),'STAGE_OUTCOME_UNCERTAIN');
   const bound={...record,deploymentId:d.id};writeState(stateFile,bound);
   validateDeployment(sync(adapter.inspectDeployment(b,d.id)),b,bound);
   check((sync(adapter.inspectProduction(b))?.id??null)===a.expectedProductionDeploymentId,'STAGING_CHANGED_PRODUCTION_UNEXPECTEDLY');
   writeState(stateFile,{...bound,phase:'staged'});result={status:'staged-production-no-domain-assignment',deploymentId:d.id,...identity};
  }});
 return result;
}
export function runHarpRelease(options){
 if(!['stage','promote','inspect'].includes(options.args.operation))return runUnlocked(options);
 const root=path.resolve(options.root);
 validateBinding(readJson(path.join(root,'config/independent-harp-binding.json')));
 const lock=path.join(root,'.qa-out/harp-independent-release/operation.lock');
 fs.mkdirSync(path.dirname(lock),{recursive:true});assertPlainPath(path.dirname(lock));
 let fd;try{fd=fs.openSync(lock,'wx');}catch{fail('RELEASE_OPERATION_ALREADY_RUNNING_OR_INTERRUPTED');}
 try{fs.writeFileSync(fd,JSON.stringify({startedAt:new Date().toISOString(),pid:process.pid}));return runUnlocked(options);}
 finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
