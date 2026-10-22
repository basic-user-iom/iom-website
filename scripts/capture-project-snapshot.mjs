/** Read ONLY the chosen local Git commit; never commits, pushes, fetches or deploys. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {devNull} from 'node:os';
import {safeRelative} from './deploy-secret-scan.mjs';
import {validateProject,assertPlainPath} from './prepare-independent-project.mjs';
const root=path.resolve(import.meta.dirname,'..');
export function captureSnapshot({repository,commit,projectIds,configPath=path.join(root,'config/independent-projects.json'),output}){
 if(!/^(?:[a-f0-9]{40}|HEAD)$/.test(commit))throw Error('Use exact 40-character commit SHA or HEAD');
 repository=path.resolve(repository);output=path.resolve(output);assertPlainPath(repository);assertPlainPath(path.dirname(output));
 if(fs.existsSync(output))throw Error('Snapshot output already exists');
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^GIT_/i.test(key))),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':devNull,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'};
 const git=args=>execFileSync('git',['--no-replace-objects','-C',repository,...args],{env,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
 if(fs.realpathSync(git(['rev-parse','--show-toplevel']).trim())!==fs.realpathSync(repository))throw Error('Repository must be the actual checkout root');
 const sha=git(['rev-parse','--verify',`${commit}^{commit}`]).trim();if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid resolved commit');
 const config=JSON.parse(fs.readFileSync(configPath,'utf8')),projects={};
 if(!projectIds.length||new Set(projectIds).size!==projectIds.length)throw Error('One or more unique project IDs required');
 for(const id of projectIds){const project=validateProject(config,id),prefix=project.input+'/';
  const records=git(['ls-tree','-r','-l','-z',sha,'--',project.input]).split('\0').filter(Boolean).map(line=>{
   const tab=line.indexOf('\t'),meta=line.slice(0,tab).trim().split(/\s+/),full=line.slice(tab+1);
   if(meta[1]!=='blob'||!['100644','100755'].includes(meta[0])||!full.startsWith(prefix)||!safeRelative(full))throw Error('Unsupported committed input');
   const size=Number(meta[3]);if(!Number.isSafeInteger(size)||size<0||size>128*1024*1024)throw Error('Invalid committed size');
   return{path:full.slice(prefix.length),size,gitBlob:meta[2]};
  });
  if(!records.length||!records.some(f=>f.path==='index.html'))throw Error('Committed static output missing');
  projects[id]=records;
 }
 const value={version:1,repository:'local Git checkout (no remote credentials read)',commit:sha,projects};
 fs.writeFileSync(output,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return value;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const argv=process.argv.slice(2),args={};for(let i=0;i<argv.length;i+=2){if(!['--repository','--commit','--projects','--output','--config'].includes(argv[i])||!argv[i+1]||Object.hasOwn(args,argv[i]))throw Error('Invalid argument');args[argv[i]]=argv[i+1];}
 if(!args['--repository']||!args['--commit']||!args['--projects']||!args['--output'])throw Error('Use --repository PATH --commit SHA_OR_HEAD --projects ID[,ID] --output FRESH_JSON [--config JSON]');
 const result=captureSnapshot({repository:args['--repository'],commit:args['--commit'],projectIds:args['--projects'].split(','),output:args['--output'],...(args['--config']?{configPath:args['--config']}:{})});console.log(JSON.stringify({commit:result.commit,projects:Object.keys(result.projects),mode:'read-only-local-git'}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
