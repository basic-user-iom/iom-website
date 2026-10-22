/** Live transport, reached only through the protected entry after binding/approval validation.
 * Never invoked by the delivered tests. Uses existing authentication; does not install or link. */
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';

const fail=code=>{const e=new Error(code);e.name='DeployBlockedError';throw e;};
function run(file,args,options={}){
 const r=spawnSync(file,args,{cwd:options.cwd,env:{...(options.replaceEnvironment?{}:process.env),...options.env,GIT_TERMINAL_PROMPT:'0',NO_UPDATE_NOTIFIER:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true,timeout:options.timeout??60000,maxBuffer:8*1024*1024});
 if(r.status!==0)fail('HARP_COMMAND_FAILED_OR_OUTCOME_UNKNOWN');
 return {stdout:String(r.stdout??''),stderr:String(r.stderr??'')};
}
function json(text){try{return JSON.parse(text.trim());}catch{fail('HARP_REMOTE_JSON_INVALID');}}
export function createHarpCliAdapter(root,execute=run){
 const win=process.platform==='win32';
 const runner=win?process.execPath:'npx';
 const prefix=win?[join(dirname(process.execPath),'node_modules/npm/bin/npx-cli.js')]:[];
 const invoke=(b,args,options={})=>{
  const boundEnv={VERCEL_ORG_ID:b.teamId,VERCEL_PROJECT_ID:b.projectId};
  const version=execute(runner,[...prefix,'--no-install','vercel','--version'],{cwd:root,env:boundEnv});
  const match=(version.stdout+'\n'+version.stderr).match(/^(?:Vercel CLI\s+)?(\d+\.\d+\.\d+)\s*$/m);
  if(!match||match[1]!==b.cliVersion)fail('VERCEL_CLI_VERSION_MISMATCH');
  return execute(runner,[...prefix,'--no-install','vercel',...args,'--cwd',options.cwd??root,'--scope',b.teamId,'--non-interactive'],{cwd:root,env:boundEnv,timeout:options.timeout}).stdout;
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
   const line=stdout.trim().split(/\r?\n/).findLast(s=>/^https:\/\/[^\s]+\.vercel\.app\/?$/.test(s.trim()));
   if(!line)fail('STAGE_RESULT_URL_UNKNOWN_INSPECT_BEFORE_RETRY');
   const u=new URL(line.trim());if(u.username||u.password||u.search||u.hash)fail('STAGE_RESULT_URL_REFUSED');
   return deployment(b,u.hostname);
  },
  inspectDeployment:deployment,
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
