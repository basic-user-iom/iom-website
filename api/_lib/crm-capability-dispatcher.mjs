import { fields, fail } from './crm-email-workflow.mjs'
import { createReviewedEmailProvider } from './crm-email-provider.mjs'
import { capabilityWorkerGetHasNoBody, validateCapabilityWorkerTransport } from './crm-capability-worker-auth.mjs'

// One bounded server invocation, no browser timer, long sleep or detached promise.
// The database serializes a sender's active batch; this function never retries a
// claim or SMTP request, including when acknowledgements are missing.
export function createCrmBatchDispatcher({enabled=()=>false, startsEnabled=()=>false, workerEnabled=()=>true,
  workerScheduleAllowed=()=>true, store, authorizeWorker, resolveBinding, targets,
  providerDependenciesFor, validateHandoff=()=>true, now=Date.now}) {
  if (!Array.isArray(targets) || !targets.length || targets.length > 2 || targets.some(t=>
    !t || !/^[a-f0-9-]{36}$/i.test(t.ownerId || '') || !['projects','visual'].includes(t.fromIdentity)) ||
    new Set(targets.map(t=>t.ownerId+':'+t.fromIdentity)).size !== targets.length) fail('batch_dispatch_targets_invalid')
  const configured=structuredClone(targets)
  const requireWorkerDelivery=()=>{
    if (enabled() !== true) fail('crm_capabilities_disabled')
    if (workerEnabled() !== true) fail('capability_worker_paused')
    if (workerScheduleAllowed('delivery') !== true) fail('capability_worker_outside_schedule')
    if (startsEnabled() !== true) fail('capability_starts_paused')
  }
  return {
    async tick(worker,args={}) {
      fields(args,[])
      if (enabled() !== true) fail('crm_capabilities_disabled')
      if (typeof authorizeWorker !== 'function' || await authorizeWorker(worker) !== true) fail('batch_worker_denied')
      const results=[]
      for (const target of configured) {
        if(workerEnabled()!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'worker_paused'});continue}
        if(workerScheduleAllowed('claim')!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'outside_worker_schedule'});continue}
        if(startsEnabled()!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'new_starts_paused'});continue}
        const binding=await resolveBinding(target)
        if (binding?.authorized !== true || binding.ownerId !== target.ownerId || binding.fromIdentity !== target.fromIdentity) {
          results.push({sender:target.fromIdentity,status:'paused',reason:'authorization_unavailable'});continue
        }
        // Never use user-supplied IDs or enumerate other owners from a trigger body.
        const due=await store.listDueBatches(binding,{limit:1,now:now()})
        if (!Array.isArray(due) || due.length > 1) fail('batch_dispatch_selection_invalid')
        if (!due.length) {results.push({sender:target.fromIdentity,status:'idle'});continue}
        let claim
        try {
          if(workerEnabled()!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'worker_paused'});continue}
          if(workerScheduleAllowed('claim')!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'outside_worker_schedule'});continue}
          if(startsEnabled()!==true) {results.push({sender:target.fromIdentity,status:'paused',reason:'new_starts_paused'});continue}
          claim=await store.claimBatch(binding,due[0],now())
        }
        catch {results.push({sender:target.fromIdentity,status:'unknown',reason:'claim_outcome_unconfirmed_do_not_retry'});break}
        if (!claim) {results.push({sender:target.fromIdentity,status:'waiting'});continue}
        const {batchId,jobId,snapshot}=claim
        if (batchId !== due[0] || !jobId || snapshot?.fromIdentity !== target.fromIdentity) {
          results.push({sender:target.fromIdentity,status:'unknown',reason:'claim_binding_mismatch'});break
        }
        let result
        try {
          const dependencies=providerDependenciesFor(target.fromIdentity)
          if (!dependencies || typeof dependencies.createTransport !== 'function') throw Error('provider unavailable')
          // Keep the existing renderer/identity/claim contract; require explicit
          // single-recipient SMTP acceptance before storing a sent receipt.
          const send=createReviewedEmailProvider({...dependencies,
            createTransport:()=>{
              const transport=dependencies.createTransport()
              return {sendMail:async options=>{
                // Database authorization may have crossed a calendar/pause
                // boundary. Recheck immediately before the actual handoff.
                requireWorkerDelivery()
                if(validateHandoff(claim,now())!==true) throw Error('delivery window closed')
                const info=await transport.sendMail(options)
                const accepted=info?.accepted
                if (!Array.isArray(accepted) || accepted.length !== 1 || String(accepted[0]).toLowerCase() !== snapshot.to ||
                    !Array.isArray(info.rejected) || info.rejected.length !== 0) throw Error('acceptance unconfirmed')
                return info
              }}
            },
            beginDelivery:async()=>{
              requireWorkerDelivery()
              if(validateHandoff(claim,now())!==true) throw Error('delivery window closed')
              return store.beginBatchDelivery(binding,{batchId,jobId,snapshot})
            }})
          result=await send(snapshot,{ownerId:binding.ownerId,jobId})
          if (result.ok !== true) throw Error('acceptance unconfirmed')
        } catch {
          // Whether before transport, during SMTP, or after acceptance, an already
          // committed claim is never released for another attempt automatically.
          try {await store.finishBatch(binding,{batchId,jobId,status:'unknown',result:{error:'delivery_outcome_unknown_do_not_retry'},now:now()})} catch {}
          results.push({sender:target.fromIdentity,status:'unknown',reason:'delivery_outcome_unknown_do_not_retry'});break
        }
        try {
          await store.finishBatch(binding,{batchId,jobId,status:'sent',result:{messageId:result.messageId || null,simulated:result.simulated===true},now:now()})
          results.push({sender:target.fromIdentity,status:'sent'})
        } catch {
          results.push({sender:target.fromIdentity,status:'unknown',reason:'acceptance_receipt_unconfirmed_do_not_retry'})
        }
        // A tick never starts a second message. Concurrent ticks are serialized
        // by the durable shared lane in claim/start/receipt SQL, not this loop.
        break
      }
      // Counts/categories only. No recipients, bodies, cookie/token values or
      // provider exception strings are returned by the trigger.
      return {ok:!results.some(r=>r.status==='unknown'),results}
    },
  }
}

// The host supplies its existing authenticated worker verifier; no new secret is
// created/read here and no production endpoint imports this candidate factory.
export function createCrmBatchTriggerHandler({dispatcher,enabled=()=>false,verifyWorker,workerTransport='pg-net',
  workerEnabled=()=>workerTransport==='pg-net'}) {
  validateCapabilityWorkerTransport(workerTransport)
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store')
    if (enabled() !== true) return res.status(503).json({ok:false,error:'crm_capabilities_disabled'})
    if (req.method !== (workerTransport==='vercel-cron'?'GET':'POST')) return res.status(405).json({ok:false,error:'method_not_allowed'})
    if (workerTransport==='vercel-cron' ? !await capabilityWorkerGetHasNoBody(req) :
      (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length)) return res.status(400).json({ok:false,error:'empty_trigger_body_required'})
    let worker
    try {worker=await verifyWorker(req)} catch {worker=null}
    if (!worker) return res.status(401).json({ok:false,error:'worker_unauthorized'})
    if (workerEnabled()!==true) return res.status(200).json({ok:true,status:'paused',reason:'worker_paused'})
    try {return res.status(200).json(await dispatcher.tick(worker))}
    catch {return res.status(503).json({ok:false,error:'batch_dispatch_unavailable'})}
  }
}
