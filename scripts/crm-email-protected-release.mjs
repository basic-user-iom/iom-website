// One approved release, invoked only by deploy-production.mjs. No HTTP surface.
import {createHash, randomUUID} from 'node:crypto'
import {existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, unlinkSync} from 'node:fs'
import {join} from 'node:path'

export const RELEASE_TARGET = Object.freeze({
  project: 'prj_fWUOXHiMmeE6RXfqgAAKJCi97nrv',
  team: 'team_9wCcYQpYqlDlPAaUpCqhWXj9',
  domain: 'iobjectm.com',
  notBefore: Date.parse('2026-10-27T00:13:00Z'),
  expires: Date.parse('2026-10-27T01:43:00Z'),
})
// Separate from the expired activation window. This does not reopen it.
export const UPGRADE_WINDOW = Object.freeze({
  notBefore: Date.parse('2026-10-27T06:30:00Z'),
  expires: Date.parse('2026-10-27T08:00:00Z'),
})
export const UPGRADE_BASELINE = Object.freeze({
  id: 'dpl_AjxZPNnCTShXdiPz1f4pUYJkBs91',
  base: '0d518e0c907c2859cddcf90890d3cb780ea310ac',
})
export const RELEASE_RECORDS = Object.freeze({
  activation: 'crm-protected-release-20261027',
  upgrade: 'crm-protected-release-upgrade-20261027',
})
const UPGRADE_OPERATIONS = new Set(['upgrade','upgrade-inspect','upgrade-promote'])
const PHASES = {A:'PREPARED', B:'PREPARED', C:'ACTIVE'}
export function isUpgradeOperation(operation) { return UPGRADE_OPERATIONS.has(operation) }
export function releaseRecordName(operation) {
  return isUpgradeOperation(operation) ? RELEASE_RECORDS.upgrade : RELEASE_RECORDS.activation
}
export function operationPhase(operation) {
  return operation==='upgrade' || operation==='active' ? 'ACTIVE' : 'PREPARED'
}
function releaseWindow(operation) {
  return isUpgradeOperation(operation) ? UPGRADE_WINDOW : RELEASE_TARGET
}
export function phaseBindingHolds(state, build) {
  if (state?.mode==='upgrade') return build?.letter==='A' && build?.phase==='ACTIVE'
  if (state?.mode && state.mode!=='activation') return false
  return build?.phase===PHASES[build?.letter]
}
const FRESH_MS = 30 * 60_000
export function accessDenied(response) {
  return response?.status===401 || (response?.status===302 &&
    response.locationOrigin==='https://vercel.com' && response.locationPath==='/sso-api')
}
export function requireRelease(value, code) {
  if (!value) { const e = new Error(code); e.name = 'DeployBlockedError'; throw e }
}
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b)
export function releaseOperation(argv) {
  const args = [...argv], values = []
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--crm-email-release') {
      requireRelease(args[i+1] && !args[i+1].startsWith('--'), 'release_operation_missing')
      values.push(args[++i])
    } else if(args[i].startsWith('--crm-email-release=')) values.push(args[i].split('=')[1])
  }
  requireRelease(values.length<=1, 'release_operation_duplicate')
  if(!values.length)return null
  requireRelease(['stage','inspect','promote','prepared','active','upgrade','upgrade-inspect','upgrade-promote'].includes(values[0]), 'release_operation_invalid')
  // Do not combine the fixed release state machine with arbitrary targets or phases.
  const allowed = ['--scope=crm-email', `--crm-email-release=${values[0]}`]
  requireRelease(args.length===2 && args.every(a=>allowed.includes(a)) &&
    args.includes('--scope=crm-email'), 'release_requires_exact_crm_options')
  return values[0]
}
export function protectedProject(project, now=Date.now(), window=RELEASE_TARGET) {
  requireRelease(now>=window.notBefore, 'release_approval_not_open')
  requireRelease(now<window.expires, 'release_approval_expired')
  requireRelease(project.id===RELEASE_TARGET.project && project.accountId===RELEASE_TARGET.team,'release_wrong_project')
  requireRelease(['all','all_except_custom_domains','prod_deployment_urls_and_all_previews']
    .includes(project.ssoProtection?.deploymentType),'release_url_protection_missing')
}
export function boundDeployment(d, state, build) {
  requireRelease(d.projectId===RELEASE_TARGET.project && d.target==='production', 'release_wrong_deployment')
  requireRelease(phaseBindingHolds(state, build), 'release_deployment_binding_mismatch')
  requireRelease(d.meta?.iomReleaseRun===state.run && d.meta.iomReleaseBuild===build.letter &&
    d.meta.iomReleasePhase===build.phase && d.meta.iomVerifierSha===state.verifier &&
    d.meta.iomCommitSha===state.head && d.meta.iomSnapshotBaseSha===state.base &&
    d.meta.iomScopeMap===state.scopeMap, 'release_deployment_binding_mismatch')
  requireRelease(state.mode==='upgrade' ? d.meta?.iomReleaseKind==='upgrade' : d.meta?.iomReleaseKind===undefined, 'release_deployment_binding_mismatch')
  requireRelease(typeof d.url==='string' && /^[a-z0-9-]+\.vercel\.app$/.test(d.url),'release_invalid_url')
}
export function proofFromLogs(logs, d, state, build, now=Date.now()) {
  const lines=String(logs).split(/\r?\n/).filter(l=>l.includes('[crm-email-proof] '))
  requireRelease(lines.length===1,'release_proof_missing_or_duplicate')
  let p
  try{p=JSON.parse(lines[0].slice(lines[0].indexOf('[crm-email-proof] ')+18))}
  catch{requireRelease(false,'release_proof_malformed')}
  requireRelease(phaseBindingHolds(state, build), 'release_proof_binding_mismatch')
  requireRelease(p.run===state.run && p.build===build.letter && p.phase===build.phase &&
    p.verifier===state.verifier && p.url===d.url && p.project===RELEASE_TARGET.project &&
    p.effective===true && p.ok===true && p.gateway==='iom_email_gateway' &&
    p.session==='iom_email_gateway' && p.combinations===12, 'release_proof_binding_mismatch')
  requireRelease(Number.isFinite(p.at) && p.at>=build.started && p.at<=now && now-p.at<=FRESH_MS,'release_proof_stale')
  const expected=['STAFF_ACCESS_PHASE','STAFF_EXPECTED_STATE','REGULAR_PROJECTS_CONTROLS','PUBLIC_CA',
    'GATEWAY_DB','OAUTH_DB','SIGNING_JWK','PROJECTS_SENDER','CONTACT_SENDER','CONTACT_TRANSPORT','VISUAL_SENDER']
  requireRelease(Array.isArray(p.checks) && p.checks.length===expected.length &&
    expected.every(k=>p.checks.includes(k)), 'release_full_gates_missing')
  // Select fixed fields only; raw logs and arbitrary proof fields never persist.
  return {at:p.at,phase:p.phase,effective:true,checks:expected,verifier:state.verifier,
    deployment:d.id,project:RELEASE_TARGET.project,run:state.run,build:build.letter}
}
export function validateLive(live, state, promoted) {
  requireRelease(live.id===(promoted?state.builds[0].id:state.baseline.id),'release_live_drift')
  requireRelease(live.readyState==='READY' && live.domainBinding?.alias===RELEASE_TARGET.domain &&
    live.domainBinding.deploymentId===live.id && live.domainBinding.projectId===RELEASE_TARGET.project,'release_live_not_ready')
  requireRelease(live.meta?.iomSnapshotBaseSha===(promoted?state.base:state.baseline.base) &&
    live.meta?.iomScopeMap===(promoted?state.scopeMap:state.baseline.scopeMap), 'release_live_composition_drift')
}
export function bindDomain(deployment,alias) {
  requireRelease(alias.alias===RELEASE_TARGET.domain && alias.projectId===RELEASE_TARGET.project &&
    alias.deploymentId===deployment.id && !alias.redirect && !alias.deletedAt,'release_domain_binding_mismatch')
  return {...deployment,domainBinding:{alias:alias.alias,projectId:alias.projectId,deploymentId:alias.deploymentId}}
}
export function nextBuild(state, operation, now=Date.now()) {
  const window=releaseWindow(operation==='upgrade'?'upgrade':'stage')
  requireRelease(now>=window.notBefore, 'release_approval_not_open')
  requireRelease(now<window.expires, 'release_approval_expired')
  requireRelease(state.builds.length<3 && !state.pending && !state.failed,'release_not_resumable')
  const letter=['A','B','C'][state.builds.length]
  if(operation==='upgrade') {
    requireRelease(state.mode==='upgrade' && letter==='A', 'release_wrong_sequence')
    return {letter:'A',phase:'ACTIVE',started:now,status:'UNKNOWN',verified:false}
  }
  requireRelease(state.mode!=='upgrade', 'release_wrong_sequence')
  requireRelease(({stage:'A',prepared:'B',active:'C'})[operation]===letter,'release_wrong_sequence')
  if(letter!=='A') {
    const previous=state.builds.at(-1)
    requireRelease(state.promoted===true && previous.verified===true &&
      now-previous.proof.at<=FRESH_MS, 'release_previous_gate_missing_or_stale')
  }
  return {letter,phase:PHASES[letter],started:now,status:'UNKNOWN',verified:false}
}
export function assertPromotable(state, now=Date.now()) {
  const window=releaseWindow(state.mode==='upgrade'?'upgrade':'stage')
  requireRelease(now>=window.notBefore, 'release_approval_not_open')
  requireRelease(now<window.expires, 'release_approval_expired')
  requireRelease(!state.pending && !state.failed && !state.promoted &&
    state.builds.length===1 && state.builds[0].verified===true &&
    phaseBindingHolds(state, state.builds[0]) &&
    now-state.builds[0].proof.at<=FRESH_MS,'release_not_promotable')
}

// All Vercel commands go through the existing CLI session. The caller provides
// only fixed operations; the record is local, outside the upload manifest.
export function protectedRelease({root, operation, head, api, cli, checkUrl, prepare, preflight, now=Date.now()}) {
  const folder=join(root,'.qa-out',releaseRecordName(operation))
  const step=operation==='upgrade'?'stage':operation==='upgrade-inspect'?'inspect':operation==='upgrade-promote'?'promote':operation
  const window=releaseWindow(operation)
  mkdirSync(folder,{recursive:true})
  const lock=join(folder,'lock'), statePath=join(folder,'state.json')
  let fd
  try{fd=openSync(lock,'wx')}catch{requireRelease(false,'release_already_locked')}
  let state
  const save=()=>{writeFileSync(statePath+'.tmp',JSON.stringify(state,null,2));renameSync(statePath+'.tmp',statePath)}
  const live=()=>bindDomain(api('/v13/deployments/'+RELEASE_TARGET.domain),
    api('/v4/aliases/'+RELEASE_TARGET.domain+'?projectId='+RELEASE_TARGET.project))
  const project=()=>api('/v9/projects/'+RELEASE_TARGET.project)
  const idle=()=> {
    for(const status of ['BUILDING','INITIALIZING','QUEUED']) {
      const r=api(`/v6/deployments?projectId=${RELEASE_TARGET.project}&state=${status}&limit=1`)
      requireRelease(Array.isArray(r.deployments) && r.deployments.length===0,'release_other_build_in_progress')
    }
  }
  try {
    protectedProject(project(), now, window)
    if(existsSync(statePath))state=JSON.parse(readFileSync(statePath,'utf8'))
    if(step==='stage')requireRelease(!state,'release_record_exists_no_retry')
    else requireRelease(state && state.head===head,'release_source_changed')
    if(step==='inspect') {
      requireRelease(state.pending && state.builds.length>0,'release_nothing_pending')
      const b=state.builds.at(-1)
      requireRelease(b.id,'release_unknown_creation_inspect_manually_no_retry')
      const d=api('/v13/deployments/'+b.id)
      boundDeployment(d,state,b)
      validateLive(live(),state,state.promoted===true)
      if(['BUILDING','INITIALIZING','QUEUED'].includes(d.readyState))return {status:d.readyState,id:d.id,build:b.letter}
      requireRelease(d.readyState==='READY','release_build_failed')
      requireRelease(!d.alias?.includes(RELEASE_TARGET.domain),'release_check_unexpectedly_promoted')
      requireRelease(accessDenied(checkUrl(d.url)),'release_unauthenticated_access_not_denied')
      const logs=cli(['inspect',d.id,'--logs'],{capture:true})
      const proof=proofFromLogs(logs,d,state,b,now)
      b.status='READY';b.verified=true;b.proof=proof;state.pending=false
      save()
      return {status:'VERIFIED',build:b.letter,id:b.id,proof}
    }
    if(step==='promote') {
      assertPromotable(state, now);idle()
      validateLive(live(),state,false)
      const b=state.builds[0],d=api('/v13/deployments/'+b.id)
      boundDeployment(d,state,b)
      requireRelease(d.readyState==='READY' && !d.alias?.includes(RELEASE_TARGET.domain),'release_candidate_changed')
      requireRelease(accessDenied(checkUrl(d.url)),'release_unauthenticated_access_not_denied')
      proofFromLogs(cli(['inspect',d.id,'--logs'],{capture:true}),d,state,b,now)
      // Re-read immediately before the only domain-changing command.
      protectedProject(project(), now, window);validateLive(live(),state,false)
      state.pending='PROMOTION_UNKNOWN';save()
      cli(['promote',b.id,'--yes','--timeout','3m'],{capture:true})
      validateLive(live(),state,true)
      state.promoted=true;state.pending=false;state.promotedAt=now;save()
      return {status:'PROMOTED',id:b.id,baseline:state.baseline.id}
    }
    idle()
    preflight()
    const baseline=live()
    if(operation==='upgrade')requireRelease(baseline.id===UPGRADE_BASELINE.id &&
      baseline.meta?.iomSnapshotBaseSha===UPGRADE_BASELINE.base,'release_live_drift')
    if(state)validateLive(baseline,state,true)
    // prepare retains the original committed snapshot/scoped-push/secret-scanner gates.
    return prepare({baseline, state, publish: snapshot => {
      const verifier=digest(readFileSync(join(snapshot.stage,'scripts','validate-crm-email-build.mjs')))
      const config=digest(readFileSync(join(snapshot.stage,'vercel.json')))
      const scopeMap=Buffer.from(JSON.stringify(snapshot.overlays)).toString('base64url')
      if(!state)state={run:randomUUID(),head,base:snapshot.base,scopeMap,verifier,config,mode:operation==='upgrade'?'upgrade':'activation',
        baseline:{id:baseline.id,base:baseline.meta.iomSnapshotBaseSha,scopeMap:baseline.meta.iomScopeMap},
        created:now,builds:[],promoted:false,pending:false}
      requireRelease(state.base===snapshot.base && state.scopeMap===scopeMap &&
        state.verifier===verifier && state.config===config,'release_snapshot_changed')
      const b=nextBuild(state,operation,now)
      protectedProject(project(), now, window);idle();validateLive(live(),state,state.promoted===true)
      state.builds.push(b);state.pending=true;save() // Reserve before any remote creation.
      const args=['deploy','--prod','--skip-domain','--force','--no-wait','--yes','--cwd',snapshot.stage,
        '--project',RELEASE_TARGET.project,
        '--build-env','IOM_SKIP_BLOG_SYNC=true','--build-env',`CRM_EMAIL_RELEASE_PHASE=${b.phase}`,
        '--build-env',`CRM_EMAIL_RELEASE_RUN=${state.run}`,'--build-env',`CRM_EMAIL_RELEASE_BUILD=${b.letter}`]
      if(state.mode==='upgrade')args.push('--build-env','CRM_EMAIL_RELEASE_KIND=upgrade')
      const meta={githubCommitRef:'master',iomCommitSha:head,iomDeployScope:'crm-email',
        iomSnapshotBaseSha:state.base,iomScopeMap:state.scopeMap,iomReleaseRun:state.run,
        iomReleaseBuild:b.letter,iomReleasePhase:b.phase,iomVerifierSha:state.verifier}
      if(state.mode==='upgrade')meta.iomReleaseKind='upgrade'
      for(const [key,value] of Object.entries(meta)) args.push('--meta',`${key}=${value}`)
      cli(args,{capture:true,cwd:snapshot.stage})
      // Agent-mode CLI output may be structured JSON. Resolve the one already
      // created deployment by immutable run/build metadata, never by free text.
      const listing=api(`/v6/deployments?projectId=${RELEASE_TARGET.project}&since=${b.started-1000}&limit=100`)
      requireRelease(Array.isArray(listing.deployments) && !listing.pagination?.next,'release_creation_outcome_unknown')
      const matches=listing.deployments.filter(d=>d.meta?.iomReleaseRun===state.run && d.meta?.iomReleaseBuild===b.letter)
      requireRelease(matches.length===1,'release_creation_outcome_unknown')
      const id=matches[0].uid||matches[0].id
      requireRelease(/^dpl_[A-Za-z0-9]+$/.test(id),'release_creation_outcome_unknown')
      const d=api('/v13/deployments/'+id)
      boundDeployment(d,state,b)
      b.id=d.id;b.url=d.url;b.status=d.readyState;save()
      validateLive(live(),state,state.promoted===true)
      return {status:'CREATED_PENDING_VERIFICATION',build:b.letter,id:b.id,phase:b.phase}
    }})
  } catch(error) {
    if(state){state.failed=true;state.failureCode=error?.name==='DeployBlockedError'?error.message:'release_operation_failed';save()}
    throw error
  } finally {if(fd!==undefined){closeSync(fd);unlinkSync(lock)}}
}
