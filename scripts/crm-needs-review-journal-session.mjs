import {Worker} from 'node:worker_threads'
import {randomBytes,createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {assertPrivateBindingBytes} from './crm-needs-review-source-binding.mjs'

// Updated only with the reviewed local source closure; no caller/ENV override.
const PINS=Object.freeze({"./crm-needs-review-native.cs":"a9043e084068f76a7541ffdbb388470e81adc98a3b9dc0bff9b101d93506e00e","./crm-needs-review-broker.cs":"936597da7d0d611a22beab92dc2b7398691a1c212b381f282e6d2e1ebf7c97a6","./crm-needs-review-broker.ps1":"af19f3ecb93362793debcc219721b4d999d313bac454d365656508bc50734a47","./crm-needs-review-journal-worker.mjs":"4d6bd6edb7fb7b0f9f3c28d090e20f73f244ae71f56c3bb7dc763fb3958faf0d"}) // populated before running the isolated tests
const fail=code=>{throw Object.assign(Error(code),{code})}
const owned=new WeakMap()
function start(directory,inspect){
  if(process.platform!=='win32')fail('journal_windows_required')
  const pins=Object.entries(PINS).map(([name,sha256])=>({path:fileURLToPath(new URL(name,import.meta.url)),sha256}))
  if(pins.length!==4)fail('journal_source_pins_missing')
  for(const pin of pins)if(createHash('sha256').update(readFileSync(pin.path)).digest('hex')!==pin.sha256)fail('journal_source_pin_mismatch')
  const shared=new SharedArrayBuffer(16+1024*1024),control=new Int32Array(shared,0,4)
  const worker=new Worker(new URL('./crm-needs-review-journal-worker.mjs',import.meta.url),{workerData:{shared,directory,inspect,pins,
    pipe:'iom-nr-'+randomBytes(24).toString('hex'),script:fileURLToPath(new URL('./crm-needs-review-broker.ps1',import.meta.url))}})
  worker.unref()
  // A failed worker must become a bounded transport failure, never an unhandled
  // event which skips caller cleanup. Atomics timeout remains fail-closed.
  worker.on('error',()=>{poisoned=true})
  let closed=false,poisoned=false
  function request(message){
    if(closed||poisoned)fail('journal_session_unavailable')
    Atomics.store(control,0,0);Atomics.store(control,1,0)
    worker.postMessage(message)
    if(Atomics.wait(control,0,0,30000)==='timed-out'){
      poisoned=true;void worker.terminate();fail('journal_transport_timeout_review_required')
    }
    let result
    try{result=JSON.parse(Buffer.from(new Uint8Array(shared,16,Atomics.load(control,1))).toString('utf8'))}
    catch{poisoned=true;void worker.terminate();fail('journal_transport_invalid')}
    if(result?.ok!==true){poisoned=true;void worker.terminate();fail(result?.error||'journal_operation_failed_review_required')}
    return result.result
  }
  try{request({method:'init'})}catch(error){closed=true;void worker.terminate();throw error}
  const session=Object.freeze({
    read(name){const value=request({method:'read',name});return value===null?null:Buffer.from(value,'base64')},
    load(){const bytes=this.read('state.json');return bytes===null?null:JSON.parse(bytes.toString('utf8'))},
    save(state){const bytes=Buffer.from(JSON.stringify(state));if(bytes.length>669816)fail('journal_state_too_large');request({method:'save',data:bytes.toString('base64')})},
    verify(){request({method:'verify'})},
    inspection(){return request({method:'inspect'})},
    abandon(){if(closed)return;try{if(!poisoned)request({method:'abandon'})}finally{closed=true;void worker.terminate()}},
    close(){if(closed)return;try{if(!poisoned)request({method:'close'})}finally{closed=true;void worker.terminate()}},
  })
  owned.set(session,{directory:resolve(directory).toLowerCase(),inspect})
  return session
}
export const openNeedsReviewJournal=directory=>start(directory,false)
export function adoptNeedsReviewJournal(session,directory){
  const binding=owned.get(session)
  if(!binding||binding.inspect||binding.directory!==resolve(directory).toLowerCase())fail('journal_session_binding_invalid')
  return session
}
export function inspectNeedsReviewJournal(directory,binding=null){
  const session=start(directory,true)
  try{
    const result=session.inspection()
    if(binding)assertPrivateBindingBytes(result.binding===null?null:Buffer.from(result.binding,'base64'),binding)
    return result
  }finally{session.close()}
}
