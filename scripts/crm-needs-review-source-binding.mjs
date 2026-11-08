// Isolated proposal. The fixed source designation requires an explicit workflow
// decision before installation. No ENV/CLI path override or provisioning here.
import fs from 'node:fs'
import {resolve,dirname,join,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {NEEDS_REVIEW_TARGET,NEEDS_REVIEW_SCOPE} from './crm-needs-review-release.mjs'

export const PRIVATE_SOURCE_POLICY=Object.freeze({
  source:'C:\\Users\\Mirjan\\Documents\\IomCrmReleaseSources\\needs-review-publication',
  journalBase:'C:\\Users\\Mirjan\\Documents\\IomCrmReleaseJournal',
  history:Object.freeze([
    'F:\\iom_website\\.qa-out\\crm-needs-review-release',
    'F:\\iom_website\\.qa-out\\release-worktrees\\crm-capabilities\\.qa-out\\crm-needs-review-release',
    'F:\\iom-crm-needs-review-release',
    'C:\\Users\\Mirjan\\Documents\\Codex\\2026-11-03\\task-3\\batch-20261104\\phase5\\publication\\.qa-out\\crm-needs-review-release',
    'C:\\Users\\Mirjan\\Documents\\Codex\\2026-11-03\\task-3\\batch-20261104\\phase5\\iom-crm-needs-review-release',
  ]),
  scope:NEEDS_REVIEW_SCOPE,
  projectId:NEEDS_REVIEW_TARGET.projectId,teamId:NEEDS_REVIEW_TARGET.teamId,domain:NEEDS_REVIEW_TARGET.domain,
})
// Same filename the journal broker reads. The WAL is the state until a snapshot exists.
export const HOSTED_EVIDENCE_NAME=/^hosted-dpl_[A-Za-z0-9]+\.json$/
const key=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p)
const hash=b=>createHash('sha256').update(b).digest('hex')
const fail=code=>{throw Object.assign(Error(code),{code})}
const check=(ok,code)=>{if(!ok)fail(code)}
const inside=(p,root)=>key(p)===key(root)||key(p).startsWith(key(root)+sep)

// Pure deterministic record: commit/approval are separately bound by the release
// protocol so a new reviewed commit keeps the SAME historical journal identity.
export function privateSourceBinding(source,policy=PRIVATE_SOURCE_POLICY){
  check(key(source)===key(policy.source),'needs_review_private_source_required')
  const record={version:1,source:key(source),journalBase:key(policy.journalBase),
    scope:policy.scope,projectId:policy.projectId,teamId:policy.teamId,domain:policy.domain}
  const bytes=Buffer.from(JSON.stringify(record)+'\n')
  return {record,bytes,bucket:hash(bytes),directory:join(resolve(policy.journalBase),hash(bytes))}
}

// This pure read-only resolver accepts a policy/I/O seam for isolated tests.
// The launcher uses ONLY PRIVATE_SOURCE_POLICY; no tool/CLI/ENV can supply one.
export function resolvePrivateJournal(source,policy=PRIVATE_SOURCE_POLICY,io=fs){
  let physical
  try{physical=io.realpathSync.native(resolve(source));check(io.statSync(physical).isDirectory(),'needs_review_private_source_required')}
  catch{fail('needs_review_private_source_unverifiable')}
  check(key(physical)===key(policy.source),'needs_review_private_source_required')
  const binding=privateSourceBinding(physical,policy)
  check(!inside(binding.directory,physical),'needs_review_journal_inside_checkout')
  function physicalOrAbsent(path){
    let current=resolve(path)
    while(true){
      try{
        const stat=io.lstatSync(current)
        check(!stat.isSymbolicLink()&&stat.isDirectory(),'needs_review_journal_redirected')
        check(key(io.realpathSync.native(current))===key(current),'needs_review_journal_redirected')
      }catch(error){
        if(error.code!=='ENOENT')throw error.code?.startsWith('needs_review_')?error:Object.assign(Error('needs_review_journal_path_unverifiable'),{code:'needs_review_journal_path_unverifiable'})
        if(dirname(current)===current)fail('needs_review_journal_path_unverifiable')
      }
      const parent=dirname(current);if(parent===current)break;current=parent
    }
  }
  function entries(path){
    physicalOrAbsent(path)
    try{return io.readdirSync(path)}catch(error){if(error.code==='ENOENT')return [];fail('needs_review_journal_path_unverifiable')}
  }
  // No receipt, age check or override permits skipping prior/sibling evidence.
  for(const old of [...policy.history,join(physical,'.qa-out','crm-needs-review-release'),
    join(dirname(physical),'iom-crm-needs-review-release')])
    check(entries(old).length===0,'needs_review_prior_history_review_required')
  check(entries(policy.journalBase).every(name=>name===binding.bucket),'needs_review_journal_identity_review_required')
  const names=entries(binding.directory)
  check(!names.some(name=>/^state-.*\.tmp$/i.test(name)),'needs_review_journal_incomplete_write_review_required')
  if(!names.includes('state.json'))check(names.every(name=>[
    'source-binding.json','approval.json','consents.json','operation.lock','state-wal.log',
  ].includes(name) || HOSTED_EVIDENCE_NAME.test(name)),'needs_review_journal_orphan_evidence_review_required')
  physicalOrAbsent(binding.directory)
  for(let current=binding.directory;;current=dirname(current)){
    try{io.lstatSync(join(current,'.git'));fail('needs_review_journal_inside_checkout')}
    catch(error){if(error.code!=='ENOENT')throw error.code?.startsWith('needs_review_')?error:Object.assign(Error('needs_review_journal_path_unverifiable'),{code:'needs_review_journal_path_unverifiable'})}
    if(dirname(current)===current)break
  }
  return binding
}

export function isPrivateReleaseSource(root){
  try{return key(fs.realpathSync.native(resolve(root)))===key(PRIVATE_SOURCE_POLICY.source)}catch{return false}
}
export function assertPrivateReleaseSource(root){
  check(isPrivateReleaseSource(root),'needs_review_private_source_required')
  return resolvePrivateJournal(root)
}
export function assertPrivateBindingBytes(bytes,binding){
  check(Buffer.isBuffer(bytes)&&bytes.equals(binding.bytes),'needs_review_source_binding_missing_or_changed')
}
