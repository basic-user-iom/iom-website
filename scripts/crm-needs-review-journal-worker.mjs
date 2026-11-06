// Private transport worker; the main thread remains synchronous. No fs journal I/O.
import {parentPort,workerData} from 'node:worker_threads'
import {spawn} from 'node:child_process'
import {createConnection} from 'node:net'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'

const control=new Int32Array(workerData.shared,0,4)
const output=new Uint8Array(workerData.shared,16)
let socket, pending=null, incoming=Buffer.alloc(0), failed=false
const reply=value=>{
  if(!pending)return
  const bytes=Buffer.from(JSON.stringify(value))
  if(bytes.length>output.length) return fail('journal_transport_response_too_large')
  output.set(bytes); Atomics.store(control,1,bytes.length); Atomics.store(control,0,1); Atomics.notify(control,0)
  pending=null
}
function fail(code){
  if(failed)return
  failed=true
  reply({ok:false,error:code})
  socket?.destroy()
}
try {
  for(const {path,sha256} of workerData.pins)
    if(createHash('sha256').update(readFileSync(path)).digest('hex')!==sha256) throw Error('pin')
} catch { failed=true }
const child=failed?null:spawn('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',[
  '-NoLogo','-NoProfile','-NonInteractive','-File',workerData.script,
  '-PipeName',workerData.pipe,'-Directory',workerData.directory,'-ParentPid',String(process.pid),
  ...(workerData.inspect?['-InspectOnly']:[]),
],{shell:false,windowsHide:true,stdio:'ignore',env:{...process.env,
  PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}})
child?.on('error',()=>fail('journal_broker_start_failed'))
child?.on('exit',()=>fail('journal_broker_ended_review_required'))
parentPort.on('message',request=>{
  if(pending)throw Error('journal_parallel_request_forbidden')
  pending=request
  if(failed){reply({ok:false,error:'journal_broker_unavailable'});return}
  if(socket?.readyState==='open')socket.write(JSON.stringify(request)+'\n')
})
const deadline=Date.now()+15000
function connect(){
  if(failed)return
  const candidate=createConnection('\\\\.\\pipe\\'+workerData.pipe)
  candidate.once('error',()=>{
    candidate.destroy()
    if(Date.now()>=deadline)fail('journal_broker_connect_failed')
    else setTimeout(connect,100)
  })
  candidate.once('connect',()=>{
    socket=candidate
    candidate.removeAllListeners('error')
    candidate.on('error',()=>fail('journal_transport_failed_review_required'))
    candidate.on('end',()=>{if(pending)fail('journal_transport_ended_review_required')})
    candidate.on('data',chunk=>{
      incoming=Buffer.concat([incoming,chunk])
      if(incoming.length>output.length){fail('journal_transport_response_too_large');return}
      const end=incoming.indexOf(10)
      if(end<0)return
      if(end!==incoming.length-1){fail('journal_transport_framing_invalid');return}
      try{reply(JSON.parse(incoming.subarray(0,end).toString('utf8')))}catch{fail('journal_transport_json_invalid')}
      incoming=Buffer.alloc(0)
    })
    if(pending)socket.write(JSON.stringify(pending)+'\n')
  })
}
if(!failed)connect()
