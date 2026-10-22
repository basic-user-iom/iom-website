/** Single-successor recovery ledger. No remote mutation, state reset, or implicit retry. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertPlainPath} from './prepare-independent-project.mjs';

const fail=code=>{const e=new Error(code);e.name='DeployBlockedError';throw e;};
const check=(ok,code)=>{if(!ok)fail(code);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const digest=value=>sha256(JSON.stringify(canonical(value)));
export const rootAliasDigest=aliases=>digest(aliases.map(a=>({alias:a.alias,projectId:a.projectId,deploymentId:a.deploymentId,redirect:a.redirect??null,deletedAt:a.deletedAt??null,protectionBypass:a.protectionBypass??null})).sort((a,b)=>a.alias.localeCompare(b.alias)));
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const dpl=value=>typeof value==='string'&&/^dpl_[A-Za-z0-9]+$/.test(value);
const TEAM='team_9wCcYQpYqlDlPAaUpCqhWXj9',CHILD='prj_jusDEdRJnTEsMu6q3VgbHpffxp6T',ROOT='prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv';
const STAGING='iom-harp-configurator-ioms-projects-e24b30ec.vercel.app';
function parse(bytes){try{return JSON.parse(bytes.toString('utf8'));}catch{fail('RECOVERY_JSON_INVALID');}}
function read(file){assertPlainPath(file);const s=fs.statSync(file);check(s.isFile()&&s.nlink===1&&s.size<1024*1024,'RECOVERY_FILE_REFUSED');return fs.readFileSync(file);}
function complete(result,key){check(Array.isArray(result?.[key])&&result.pagination&&Object.hasOwn(result.pagination,'next')&&result.pagination.next===null,'RECOVERY_INCOMPLETE_REMOTE_LIST');return result[key];}
function alias(a,host,projectId,deploymentId){
 check(a?.alias===host&&a.projectId===projectId&&dpl(a.deploymentId)&&a.deploymentId===deploymentId&&(!a.deployment||a.deployment.id===a.deploymentId)&&(a.redirect==null||a.redirect===false)&&a.redirectStatusCode==null&&(a.deleted==null||a.deleted===false)&&a.deletedAt==null&&(a.teamId==null||a.teamId===TEAM),'RECOVERY_ALIAS_DRIFT');
}
function fileList(files){
 check(Array.isArray(files)&&files.length===12,'RECOVERY_FILE_CLOSURE');
 const names=new Set();
 for(const f of files){
  check(f&&typeof f.path==='string'&&(f.path==='.vercel/output/config.json'||f.path.startsWith('.vercel/output/static/demos/harp-configurator-demo/'))&&!f.path.includes('..')&&!f.path.includes('\\')&&!names.has(f.path)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&hex(f.sha256)&&/^[a-f0-9]{40}$/.test(f.sha1),'RECOVERY_FILE_INVALID');names.add(f.path);
 }
 return [...files].sort((a,b)=>a.path.localeCompare(b.path));
}
export function validateRecovery({originalStateBytes,bindingBytes,approval:a,remote:r,expectedFiles,expectedConfig,now=Date.now(),successor=null}){
 const s=parse(originalStateBytes),b=parse(bindingBytes),p=a?.recovery;
 check(a?.version===1&&a.approved===true&&['reconcile','recover-stage'].includes(a.operation),'RECOVERY_APPROVAL_REQUIRED');
 const expires=Date.parse(a.expiresAt);check(expires>now&&expires<=now+48*3600*1000,'RECOVERY_APPROVAL_EXPIRED');
 check(p&&hex(p.originalStateSHA256)&&hex(p.bindingFileSHA256)&&sha256(originalStateBytes)===p.originalStateSHA256&&sha256(bindingBytes)===p.bindingFileSHA256,'RECOVERY_LOCAL_IDENTITY');
 check(s.version===1&&s.phase==='stage-issued'&&s.deploymentId===null&&s.expectedProductionDeploymentId===null&&uuid(s.attempt)&&s.attempt===p.failedAttempt&&s.sourceCommit===p.failedSourceCommit&&s.artifactDigest===p.failedArtifactDigest&&s.bindingDigest===sha256(JSON.stringify(b)),'RECOVERY_ORIGINAL_STATE');
 check(b.enabled===true&&b.teamId===TEAM&&b.projectId===CHILD&&b.rootProjectId===ROOT&&b.projectName==='iom-harp-configurator'&&b.productionOrigin==='https://iom-harp-configurator.vercel.app'&&dpl(p.failedDeploymentId)&&dpl(p.rootDeploymentId)&&p.stagingAlias===STAGING,'RECOVERY_TARGET_REFUSED');
 check(expectedConfig?.version===3&&Array.isArray(expectedConfig.routes)&&digest(expectedConfig.routes)===p.expectedRoutesSHA256&&hex(p.failedRoutesSHA256)&&p.failedRoutesSHA256!==p.expectedRoutesSHA256,'RECOVERY_ROUTE_PINS');
 const project=r?.project;
 check(project?.id===CHILD&&project.accountId===TEAM&&project.name===b.projectName&&project.framework==null&&project.buildCommand==null&&project.installCommand==null&&project.outputDirectory==null&&project.rootDirectory==null&&project.link==null,'RECOVERY_PROJECT_DRIFT');
 check(same({passwordProtection:project.passwordProtection??null,ssoProtection:project.ssoProtection??null,trustedIps:project.trustedIps??null},b.protection)&&same(b.protection,{passwordProtection:null,ssoProtection:{deploymentType:'all'},trustedIps:null}),'RECOVERY_PROTECTION_DRIFT');
 const list=complete(r.deployments,'deployments'),aliases=complete(r.aliases,'aliases'),roots=complete(r.rootAliases,'aliases');
 const ids=list.map(d=>d.uid??d.id);check(ids.every(dpl)&&new Set(ids).size===ids.length&&list.every(d=>!d.uid||!d.id||d.uid===d.id),'RECOVERY_DEPLOYMENT_LIST_INVALID');
 const oldMatches=list.filter(d=>d.meta?.iomHarpAttempt===s.attempt);
 check(oldMatches.length===1&&(oldMatches[0].uid??oldMatches[0].id)===p.failedDeploymentId,'RECOVERY_ATTEMPT_NOT_UNIQUE');
 check(list.length===(successor?2:1),'RECOVERY_UNEXPECTED_DEPLOYMENTS');
 const expected=successor??{...s,deploymentId:p.failedDeploymentId},d=r.deployment;
 check(d?.id===expected.deploymentId&&d.projectId===CHILD&&d.target==='production'&&d.readyState==='READY'&&d.meta?.iomCommitSha===expected.sourceCommit&&d.meta?.iomHarpArtifact===expected.artifactDigest&&d.meta?.iomHarpAttempt===expected.attempt,'RECOVERY_DEPLOYMENT_IDENTITY');
 check(Array.isArray(d.routes)&&digest(d.routes)===(successor?p.expectedRoutesSHA256:p.failedRoutesSHA256),'RECOVERY_ROUTING_EVIDENCE');
 if(successor){const matches=list.filter(x=>x.meta?.iomHarpAttempt===successor.attempt);check(successor.deploymentId!==p.failedDeploymentId&&matches.length===1&&(matches[0].uid??matches[0].id)===successor.deploymentId,'RECOVERY_SUCCESSOR_NOT_UNIQUE');}
 check(aliases.length===1&&roots.length>0&&new Set(roots.map(a=>a.alias)).size===roots.length,'RECOVERY_ALIAS_INVENTORY');
 alias(aliases[0],STAGING,CHILD,expected.deploymentId);check(aliases[0].protectionBypass==null,'RECOVERY_CHILD_ALIAS_PROTECTION_DRIFT');
 const main=roots.filter(a=>a.alias==='iobjectm.com');check(main.length===1,'RECOVERY_ROOT_ALIAS_MISSING');alias(main[0],'iobjectm.com',ROOT,p.rootDeploymentId);
 for(const a of roots)alias(a,a.alias,ROOT,a.deploymentId);
 check(hex(p.rootAliasesDigest)&&rootAliasDigest(roots)===p.rootAliasesDigest,'RECOVERY_ROOT_ALIAS_INVENTORY_DRIFT');
 const expectedSorted=fileList(expectedFiles),actualSorted=fileList(r.files);
 check(digest(expectedSorted)===p.filesDigest&&same(actualSorted,expectedSorted),'RECOVERY_REMOTE_CONTENT_MISMATCH');
 return s;
}
function originalUnchanged(directory,bytes){check(read(path.join(directory,'state.json')).equals(bytes),'RECOVERY_ORIGINAL_CHANGED');}
function exclusive(file,value){let ancestor=path.dirname(file);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);assertPlainPath(ancestor);fs.mkdirSync(path.dirname(file),{recursive:true});assertPlainPath(path.dirname(file));const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return {file,sha256:sha256(read(file)),event:value};}
export function recordRejection(options){
 const s=validateRecovery(options);check(options.approval.operation==='reconcile','RECONCILE_APPROVAL_REQUIRED');
 originalUnchanged(options.directory,options.originalStateBytes);
 const file=path.join(options.directory,'rejected',s.attempt+'.json');
 const event={version:1,kind:'rejected-routing',originalStateSHA256:sha256(options.originalStateBytes),recovery:options.approval.recovery,evidenceDigest:digest(options.remote)};
 if(fs.existsSync(file)){const bytes=read(file);check(same(parse(bytes),event),'RECOVERY_CONFLICTING_REJECTION');return {file,event,sha256:sha256(bytes)};}
 return exclusive(file,event);
}
export function beginSuccessor(options){
 const s=validateRecovery(options),a=options.approval;
 check(a.operation==='recover-stage'&&uuid(a.successorAttempt)&&a.successorAttempt!==s.attempt,'SUCCESSOR_APPROVAL_REQUIRED');
 check(same(a.allowedAliasTransition,{hostname:STAGING,fromDeploymentId:a.recovery.failedDeploymentId,toAttempt:a.successorAttempt}),'SUCCESSOR_ALIAS_TRANSITION_NOT_APPROVED');
 check(a.expectedProductionDeploymentId===null&&a.bindingDigest===s.bindingDigest&&same({sourceCommit:a.sourceCommit,artifactDigest:a.artifactDigest},{sourceCommit:options.identity.sourceCommit,artifactDigest:options.identity.artifactDigest}),'SUCCESSOR_IDENTITY_MISMATCH');
 originalUnchanged(options.directory,options.originalStateBytes);
 const rejected=read(path.join(options.directory,'rejected',s.attempt+'.json')),event=parse(rejected);
 check(hex(a.rejectionSHA256)&&sha256(rejected)===a.rejectionSHA256&&event.version===1&&event.kind==='rejected-routing'&&event.originalStateSHA256===a.recovery.originalStateSHA256&&same(event.recovery,a.recovery),'SUCCESSOR_REJECTION_LINK');
 const intentFile=path.join(options.directory,'successors',s.attempt+'.json'),stateFile=path.join(options.directory,'attempts',a.successorAttempt,'state.json');
 check(!fs.existsSync(intentFile)&&!fs.existsSync(path.dirname(stateFile)),'SUCCESSOR_ALREADY_ISSUED_OR_INTERRUPTED');
 const {sourceCommit,artifactDigest,files,bytes}=options.identity;
 check(/^[a-f0-9]{40}$/.test(sourceCommit)&&hex(artifactDigest)&&files===11&&Number.isSafeInteger(bytes)&&bytes>0,'SUCCESSOR_IDENTITY_INVALID');
 const record={version:1,phase:'stage-issued',attempt:a.successorAttempt,bindingDigest:a.bindingDigest,sourceCommit,artifactDigest,files,bytes,deploymentId:null,expectedProductionDeploymentId:null,previousAttempt:s.attempt,rejectionSHA256:a.rejectionSHA256,originalStateSHA256:a.recovery.originalStateSHA256};
 // The deterministic slot is written first. Every crash from here refuses any automatic retry.
 exclusive(intentFile,{version:1,kind:'single-successor-issued',attempt:a.successorAttempt,previousAttempt:s.attempt,rejectionSHA256:a.rejectionSHA256,approvalSHA256:digest(a),sourceCommit:record.sourceCommit,artifactDigest:record.artifactDigest});
 exclusive(stateFile,record);return {stateFile,record,intentFile};
}
export function assertRecoveryCode(root,approval){
 const names=['independent-harp-cli.mjs','independent-harp-release.mjs','independent-harp-recovery.mjs'];
 check(same(Object.keys(approval.codeSHA256??{}).sort(),[...names].sort()),'RECOVERY_CODE_PINS_REQUIRED');
 for(const name of names)check(sha256(read(path.join(root,'scripts',name)))===approval.codeSHA256[name],'RECOVERY_CODE_CHANGED');
}
export function assertOriginalUnchanged(directory,bytes){originalUnchanged(directory,bytes);}
