// Called only by the existing npm deploy launcher with its existing checked helpers.
// No credential creation, access provisioning, OAuth consent, or standalone entry.
import {readFileSync,existsSync,lstatSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {runNeedsReviewRelease,verifyNeedsReviewFiles,remoteBranchAllowed} from './crm-needs-review-release.mjs'
import {createNeedsReviewReleaseDriver,needsReviewReleaseJournalDir,needsReviewSourceInventory} from './crm-needs-review-release-driver.mjs'
import {openNeedsReviewJournal,inspectNeedsReviewJournal} from './crm-needs-review-journal-session.mjs'
import {assertPrivateReleaseSource,isPrivateReleaseSource,resolvePrivateJournal,assertPrivateBindingBytes} from './crm-needs-review-source-binding.mjs'

// Provider metadata endpoints return either a JSON object or a JSON array.
// Keep parsing strict; endpoint-specific inventory/shape checks still run.
export function parseNeedsReviewMetadata(output) {
  const fail=()=>{throw Object.assign(Error('needs_review_metadata_invalid_json'),{code:'needs_review_metadata_invalid_json'})}
  if(typeof output!=='string')fail()
  const starts=[output.indexOf('{'),output.indexOf('[')].filter(index=>index>=0)
  if(starts.length===0)fail()
  try{return JSON.parse(output.slice(Math.min(...starts)))}catch{fail()}
}
// Local diagnostics only. Never print approval, lock contents, history, errors
// supplied by the journal, or arbitrary strings from a recovered state.
function journalSummary(report,head,manifestSha256) {
  if(typeof report?.staleLock!=='boolean'||report.automaticRecovery!==false||
    !Number.isInteger(report.records)||report.records<0||report.records>256||
    (report.state!==null&&typeof report.state!=='string'))throw Error('needs_review_journal_report_invalid')
  const bytes=report.state===null?null:Buffer.from(report.state,'base64')
  const state=bytes===null?null:JSON.parse(bytes.toString('utf8'))
  if(state!==null&&(typeof state!=='object'||Array.isArray(state)))throw Error('needs_review_journal_state_invalid')
  const pending=state===null?null:state.pending===false?false:
    ['CREATE_UNKNOWN','VERIFY_REQUIRED','PROMOTE_UNKNOWN','ROLLBACK_UNKNOWN'].includes(state.pending)?state.pending:'UNRECOGNIZED'
  const pin=(value,pattern)=>typeof value==='string'&&pattern.test(value)?value:null
  const candidate=state?.candidate||state?.previousCandidate
  return {status:'LOCAL_JOURNAL_INSPECTED',readOnly:true,providerChecked:false,
    automaticRecovery:false,retryAuthorized:false,lockPresent:report.staleLock,
    // Presence alone is not proof that its former holder is dead or retry safe.
    manualReviewRequired:report.staleLock||state!==null,
    head,manifestSha256,walRecords:report.records,statePresent:state!==null,
    stateSha256:bytes===null?null:createHash('sha256').update(bytes).digest('hex'),pending,
    evidence:candidate?{
      deploymentId:pin(candidate.deploymentId,/^dpl_[A-Za-z0-9]{1,120}$/),
      head:pin(candidate.head,/^[a-f0-9]{40}$/),
      artifactDigest:pin(candidate.artifactDigest,/^[a-f0-9]{64}$/),
      manifestDigest:pin(candidate.manifestDigest,/^[a-f0-9]{64}$/),
    }:null}
}
export function runNeedsReviewEntry(operation,context) {
  const {root,git,npx,fail,parseJsonOutput,productionState,composeSnapshot,readProductionManifest,snapshotFiles,withScannedRelease,cleanupStage,assertProductionUnchanged,ensureAncestor,changedFiles,matchesDeployScope,command,buildSnapshot,verifyUploadManifest,knownValuesFromEnvironment,buildReleaseMetadata,provenanceScopes}=context
  // Local diagnostics/old-outcome reconciliation stay available on prior roots.
  // All verification/new publication actions require the designated private root.
  if(!['plan','inspect-journal','inspect'].includes(operation))assertPrivateReleaseSource(root)
  const binding=isPrivateReleaseSource(root)?resolvePrivateJournal(root):null
  const head=git(['rev-parse','HEAD'])
  const profile=JSON.parse(readFileSync(join(root,'config/crm-needs-review-release.json'),'utf8'))
  // Owner approval is an explicit nonsecret local record, never a CLI override,
  // environment switch, uploaded file or a reused legacy approval window.
  const journalDir=needsReviewReleaseJournalDir(root)
  if(operation==='inspect-journal'){
    if(!/^[a-f0-9]{40}$/.test(head))fail('needs_review_inspection_source_invalid')
    const local=verifyNeedsReviewFiles(profile,path=>readFileSync(join(root,path)))
    const result=journalSummary(inspectNeedsReviewJournal(journalDir,binding),head,local.manifestSha256)
    console.log('[crm-needs-review-release] '+JSON.stringify(result))
    return result
  }
  let approval=null,journalSession=null
  if(operation!=='plan'){
    // Validate binding with a read-only session before attempting a new lock.
    // Revalidate through the mutation session's retained handle before approval.
    if(binding)inspectNeedsReviewJournal(journalDir,binding)
    journalSession=openNeedsReviewJournal(journalDir)
    try {
      if(binding)assertPrivateBindingBytes(journalSession.read('source-binding.json'),binding)
      const bytes=journalSession.read('approval.json'); if(bytes!==null)approval=JSON.parse(bytes.toString('utf8'))
    }
    catch(error){journalSession.abandon();throw error}
  }
  const cli=(args,options={})=>{
    const r=spawnSync(npx.file,[...npx.prefix,'--no-install','vercel',...args,
      '--scope','team_9wCcYQpYqlDlPAaUpCqhWXj9','--non-interactive'],{
      cwd:options.cwd||root,env:{...process.env,NO_UPDATE_NOTIFIER:'1'},encoding:'utf8',shell:false,
      windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:args[0]==='deploy'?300000:190000,maxBuffer:64*1024*1024})
    if(r.status!==0)fail('needs_review_cli_failed_or_unknown_inspect_before_retry')
    return String(r.stdout||'')
  }
  const readCommittedFile=(commit,path)=>execFileSync('git',['show',`${commit}:${path}`],{cwd:root,maxBuffer:64*1024*1024,windowsHide:true})
  const readDeploymentInventory=deployment=>{
    const raw=cli(['api',`/v6/deployments/${deployment.id}/files`])
    const start=Math.min(...[raw.indexOf('['),raw.indexOf('{')].filter(n=>n>=0))
    let response
    try{response=JSON.parse(raw.slice(start))}catch{fail('needs_review_inventory_invalid_json')}
    if(response.truncated)fail('needs_review_inventory_truncated')
    const nodes=Array.isArray(response)?response:response.files
    if(!Array.isArray(nodes))fail('needs_review_inventory_shape_invalid')
    return needsReviewSourceInventory(nodes,{
      ...(deployment.id===profile.baseline.id?{expectedCount:profile.baseline.sourceCount}:{}),
      ...(deployment.expectedDigest?{expectedDigest:deployment.expectedDigest}:{})})
  }
  const readUploadInventory=stage=>{
    const raw=cli(['deploy','--dry','--format=json','--cwd',stage],{cwd:stage})
    const manifest=parseJsonOutput(raw,'NeedsReview upload inventory')
    if(!Array.isArray(manifest.files)||manifest.fileCount!==manifest.files.length)fail('needs_review_upload_inventory_incomplete')
    const seen=new Set(),rows=[]
    for(const row of manifest.files){
      // Same directory-marker rule as the secret scan: a real directory whose
      // declared type is 040000 and whose declared size is zero is not a file.
      if(typeof row?.path!=='string'||row.path.length===0||/[\\\x00-\x1f:*?"<>|]/.test(row.path)||
        !row.path.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[ .]$/.test(part)))fail('needs_review_upload_path_invalid')
      const key=row.path.toLowerCase()
      if(seen.has(key))fail('needs_review_upload_path_invalid')
      seen.add(key)
      const file=join(stage,row.path)
      let current=file
      while(true){
        if(lstatSync(current).isSymbolicLink())fail('needs_review_upload_path_invalid')
        if(current===dirname(current))break
        current=dirname(current)
      }
      const stat=lstatSync(file)
      const declaredType=Number.isSafeInteger(row.mode)?row.mode&0o170000:null
      if(stat.isDirectory()&&declaredType===0o040000&&row.size===0)continue
      if(declaredType!==null&&declaredType!==0o100000)fail('needs_review_upload_path_invalid')
      if(!stat.isFile()||stat.nlink!==1||!Number.isSafeInteger(row.size)||row.size<0||stat.size!==row.size)fail('needs_review_upload_path_invalid')
      const bytes=readFileSync(file)
      if(!Buffer.isBuffer(bytes)||bytes.length!==row.size)fail('needs_review_upload_path_invalid')
      rows.push({path:row.path,sha1:createHash('sha1').update(bytes).digest('hex')})
    }
    return rows
  }
  // The driver is lazy: plan/missing approval does not lock, access services,
  // inspect credentials, scan media or create a staging checkout.
  const api=route=>parseNeedsReviewMetadata(cli(['api',route]))
  const deployment=id=>{
    const d=api('/v13/deployments/'+id)
    const identities=[d.teamId,d.ownerId,d.team?.id].filter(value=>value!==undefined&&value!==null)
    if(!identities.length||identities.some(value=>value!==profile.target.teamId))
      fail('needs_review_provider_team_identity_unverified')
    return {...d,teamId:identities[0]}
  }
  let driver
  try { driver=createNeedsReviewReleaseDriver({root,profile,approval,journalSession,helpers:{
    git,cli,api,deployment,readCommittedFile,productionState,composeSnapshot,readProductionManifest,snapshotFiles,
    withScannedRelease,cleanupStage,assertProductionUnchanged,readDeploymentInventory,
    live:()=>{
      const d=deployment('iobjectm.com')
      const alias=api('/v4/aliases/iobjectm.com?projectId='+profile.target.projectId)
      return {...d,alias}
    },
    preflight:({head,baseline})=>{
      if(git(['status','--porcelain']))fail('needs_review_release_checkout_dirty')
      ensureAncestor(baseline.meta.iomCommitSha,head,'NeedsReview publication commit must descend from current Storm production.')
      const remote=git(['ls-remote','origin','refs/heads/master']).split(/\s/)[0]
      const ancestor=(left,right)=>spawnSync('git',['merge-base','--is-ancestor',left,right],{cwd:root,stdio:'ignore',windowsHide:true}).status===0
      if(!remoteBranchAllowed({remote,head,liveCommit:baseline.meta.iomCommitSha,state:journalSession.load(),isAncestor:ancestor}))fail('needs_review_remote_branch_changed')
      if(changedFiles(baseline.meta.iomCommitSha,head).some(path=>!matchesDeployScope(path,'crm-needs-review')))
        fail('needs_review_unrelated_commit_paths')
      command(process.execPath,[join(root,'scripts/pre-deploy-check.mjs')])
      const project=api('/v9/projects/'+profile.target.projectId)
      if(project.id!==profile.target.projectId||project.accountId!==profile.target.teamId||
        !['all','all_except_custom_domains','prod_deployment_urls_and_all_previews'].includes(project.ssoProtection?.deploymentType))
        fail('needs_review_project_or_deployment_protection_changed')
      for(const state of ['BUILDING','INITIALIZING','QUEUED']){
        const listing=api(`/v6/deployments?projectId=${profile.target.projectId}&state=${state}&limit=1`)
        if(!Array.isArray(listing.deployments)||listing.deployments.length)fail('needs_review_other_release_running')
      }
      return true
    },
    buildSnapshot:(snapshot,phase,env)=>{
      buildSnapshot(snapshot.stage,['crm-needs-review'],snapshot.reuse,'',snapshot.cutover,'',env)
      return {complete:true,env}
    },
    prepareR2:(snapshot,{verifyOnly})=>{
      if(verifyOnly!==true)fail('needs_review_r2_mutation_forbidden')
      if(existsSync(join(snapshot.stage,'config/website-r2.json'))){
        verifyUploadManifest(snapshot.stage,['crm-needs-review'],{knownValues:knownValuesFromEnvironment(process.env)},true,snapshot.cutover)
        command(process.execPath,[join(root,'scripts/prepare-r2-release.mjs'),'--stage',snapshot.stage,'--verify-only',
          ...(snapshot.reuseIdentity?['--reuse-identity',snapshot.reuseIdentity]:[])])
      }
      return {complete:true,mode:'verify-only'}
    },
    scan:(snapshot,expectedIdentity)=>verifyUploadManifest(snapshot.stage,['crm-needs-review'],
      {knownValues:knownValuesFromEnvironment(process.env),...(expectedIdentity?{expectedIdentity}:{})},false,snapshot.cutover),
    uploadInventory:readUploadInventory,
    pushReviewed:({head})=>command('git',['-c','http.version=HTTP/1.1','push','origin',`${head}:refs/heads/master`],
      {env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}),
    releaseMetadata:(snapshot,head)=>buildReleaseMetadata({descriptor:snapshot.provenance,descriptorDigest:snapshot.provenanceDigest,
      base:snapshot.base,overlays:snapshot.overlays,parentOverlays:snapshot.parentOverlays,head,scope:'crm-needs-review',
      parentDeploymentId:snapshot.parentDeploymentId},provenanceScopes(Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url'))),
    verifyConsents:(consents)=>{
      const bytes=journalSession.read('consents.json')
      if(bytes===null)fail('needs_review_consents_missing')
      const record=JSON.parse(bytes.toString('utf8'))
      return JSON.stringify(record)===JSON.stringify(consents)
    },
    readHostedEvidence:record=>{
      if(!/^dpl_[A-Za-z0-9]+$/.test(record.deploymentId))fail('needs_review_evidence_deployment_invalid')
      const bytes=journalSession.read(`hosted-${record.deploymentId}.json`)
      if(bytes===null)fail('needs_review_hosted_evidence_missing')
      return JSON.parse(bytes.toString('utf8'))
    },
  }}) } catch(error) { journalSession?.abandon(); throw error }
  try{console.log('[crm-needs-review-release] '+JSON.stringify(runNeedsReviewRelease({operation,profile,approval,head,driver})))}
  catch(error){driver.abandon();throw error}
  finally{driver.close?.()}
}
