/** Live transport, reached only through the protected entry after binding/approval validation.
 * Never invoked by the delivered tests. Uses existing authentication; does not install or link. */
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';

const fail=code=>{const e=new Error(code);e.name='DeployBlockedError';throw e;};
function run(file,args,options={}){
 const r=spawnSync(file,args,{cwd:options.cwd,env:{...(options.replaceEnvironment?{}:process.env),...options.env,GIT_TERMINAL_PROMPT:'0',NO_UPDATE_NOTIFIER:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true,timeout:options.timeout??60000,maxBuffer:8*1024*1024});
 if(r.status!==0)fail('HARP_COMMAND_FAILED_OR_OUTCOME_UNKNOWN');
 return {stdout:String(r.stdout??''),stderr:String(r.stderr??'')};
}
function json(text){try{return JSON.parse(text.trim());}catch{fail('HARP_REMOTE_JSON_INVALID');}}
export function parseStageResult(stdout){
 let result;try{result=JSON.parse(stdout.trim());}catch{fail('STAGE_RESULT_UNKNOWN_INSPECT_BEFORE_RETRY');}
 const d=result?.deployment;
 if(result?.status!=='ok'||!d||d.error||typeof d.id!=='string'||!/^dpl_[A-Za-z0-9]+$/.test(d.id)||d.readyState!=='READY'||d.target!=='production')fail('STAGE_RESULT_REFUSED_INSPECT_BEFORE_RETRY');
 let u;try{u=new URL(d.url);}catch{fail('STAGE_RESULT_URL_REFUSED');}
 if(typeof d.url!=='string'||!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app\/?$/.test(d.url)||u.origin+(d.url.endsWith('/')?'/':'')!==d.url)fail('STAGE_RESULT_URL_REFUSED');
 return {id:d.id,hostname:u.hostname}; // Never execute CLI guidance or trust its API URL.
}
export function createHarpCliAdapter(root,execute=run){
 const win=process.platform==='win32';
 const runner=win?process.execPath:'npx';
 const prefix=win?[join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js')]:[];
 const invoke=(b,args,options={})=>{
  const boundEnv={VERCEL_ORG_ID:b.teamId,VERCEL_PROJECT_ID:b.projectId};
  const version=execute(runner,[...prefix,'--no-install','vercel','--version'],{cwd:root,env:boundEnv});
  const match=(version.stdout+'\n'+version.stderr).match(/^(?:Vercel CLI\s+)?(\d+\.\d+\.\d+)\s*$/m);
  if(!match||match[1]!==b.cliVersion)fail('VERCEL_CLI_VERSION_MISMATCH');
  // CLI 59.16.0 reads process.cwd()/vercel.json before processing --cwd.
  return execute(runner,[...prefix,'--no-install','vercel',...args,'--cwd',options.cwd??root,'--scope',b.teamId,'--non-interactive'],{cwd:options.cwd??root,env:boundEnv,timeout:options.timeout}).stdout;
 };
 const api=(b,route)=>json(invoke(b,['api',route]));
 const projectRoute=b=>'/v9/projects/'+b.projectId+'?teamId='+b.teamId;
 const deployment=(b,id)=>api(b,'/v13/deployments/'+encodeURIComponent(id)+'?teamId='+b.teamId);
 return {
  inspectProject(b){
   const p=api(b,projectRoute(b));
   const domains=api(b,'/v9/projects/'+b.projectId+'/domains?teamId='+b.teamId);
   const host=new URL(b.productionOrigin).hostname;
   if(!Array.isArray(domains.domains)||!domains.domains.some(d=>d.name===host&&d.verified===true))fail('CHILD_PRODUCTION_ORIGIN_NOT_VERIFIED');
   return p;
  },
  verifyPublishedCommit(repository,commit){
   // Read only: refuse stale local origin/master; do not fetch or push automatically.
   const gitEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^GIT_/i.test(k)));
   Object.assign(gitEnv,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:win?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0'});
   const envRoot={cwd:repository,env:gitEnv,replaceEnvironment:true};
   const local=execute('git',['--no-replace-objects','rev-parse','--verify','refs/remotes/origin/master'],envRoot).stdout.trim();
   const remote=execute('git',['ls-remote','--exit-code','origin','refs/heads/master'],envRoot).stdout.trim().split(/\s+/)[0];
   if(!/^[a-f0-9]{40}$/.test(local)||local!==remote)return false;
   execute('git',['--no-replace-objects','merge-base','--is-ancestor',commit,local],envRoot);return true;
  },
  stage(b,r){
   const stdout=invoke(b,['deploy','--prebuilt','--prod','--skip-domain','--yes',
    '--meta','iomCommitSha='+r.sourceCommit,'--meta','iomHarpArtifact='+r.artifactDigest,'--meta','iomHarpAttempt='+r.attempt],{cwd:r.payload,timeout:300000});
   const ref=parseStageResult(stdout),d=deployment(b,ref.id);
   if(d?.id!==ref.id||d.url!==ref.hostname)fail('STAGE_RESULT_BINDING_MISMATCH');
   return d;
  },
  inspectDeployment:deployment,
  inspectRecovery(b,id){
   // Read-only, bounded to the approved child and the existing root hostname.
   const deployments=api(b,'/v6/deployments?projectId='+b.projectId+'&teamId='+b.teamId+'&limit=20');
   const d=deployment(b,id);
   const tree=api(b,'/v6/deployments/'+encodeURIComponent(id)+'/files?teamId='+b.teamId),entries=[];
   function walk(nodes,prefix=''){
    if(!Array.isArray(nodes))fail('RECOVERY_REMOTE_TREE_INVALID');
    for(const n of nodes){
     if(typeof n.name!=='string'||!n.name||n.name.includes('/')||n.name.includes('\\')||n.name==='.'||n.name==='..')fail('RECOVERY_REMOTE_TREE_INVALID');
     const name=prefix+n.name;
     if(n.type==='directory')walk(n.children,name+'/');
     else if(n.type==='file'&&/^[a-f0-9]{40}$/.test(n.uid??'')&&name.startsWith('src/.vercel/output/'))entries.push({path:name.slice(4),uid:n.uid});
     else fail('RECOVERY_REMOTE_TREE_INVALID');
    }
   }
   walk(tree);if(entries.length!==12)fail('RECOVERY_REMOTE_TREE_CLOSURE');
   const files=entries.map(f=>{
    const result=api(b,'/v8/deployments/'+encodeURIComponent(id)+'/files/'+f.uid+'?teamId='+b.teamId);
    if(typeof result.data!=='string')fail('RECOVERY_REMOTE_FILE_UNREADABLE');
    const bytes=Buffer.from(result.data,'base64'),sha1=createHash('sha1').update(bytes).digest('hex');
    if(sha1!==f.uid)fail('RECOVERY_REMOTE_FILE_UID_MISMATCH');
    return {path:f.path,bytes:bytes.length,sha1,sha256:createHash('sha256').update(bytes).digest('hex')};
   });
   const p=api(b,projectRoute(b));
   const project=Object.fromEntries(['id','accountId','name','framework','buildCommand','installCommand','outputDirectory','rootDirectory','link','ssoProtection','passwordProtection','trustedIps'].map(k=>[k,p[k]??null]));
   const aliases=api(b,'/v4/aliases?projectId='+b.projectId+'&teamId='+b.teamId+'&limit=100');
   const rootAliases=api(b,'/v4/aliases?projectId='+b.rootProjectId+'&domain=iobjectm.com&teamId='+b.teamId+'&limit=100');
   return {project,deployments,deployment:d,aliases,rootAliases,files};
  },
  promote(b,id){invoke(b,['promote',id,'--yes'],{timeout:190000});},
  inspectProduction(b){
   const host=new URL(b.productionOrigin).hostname;
   const result=api(b,'/v4/aliases?projectId='+b.projectId+'&domain='+encodeURIComponent(host)+'&teamId='+b.teamId);
   if(!Array.isArray(result.aliases))fail('PRODUCTION_ALIAS_LIST_UNKNOWN');
   const matches=result.aliases.filter(a=>a.alias===host);
   if(matches.length===0&&!result.pagination?.next)return null;
   if(matches.length!==1||!matches[0].deploymentId)fail('PRODUCTION_ALIAS_UNKNOWN');
   return deployment(b,matches[0].deploymentId);
  }
 };
}
