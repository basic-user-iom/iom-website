// Static parsing through the existing pinned local PowerShell/Roslyn runtime.
// No install, PATH/ENV override, source execution or network. Unsupported cases
// fail closed. Raw child output is internal and must never reach diagnostics.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const runtime='C:\\Users\\Mirjan\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\'
const PINS=Object.freeze({"pwsh.exe":"2a6769a3330dc1084d0154bfde7d164ab750ca7f700f313f9d417c1be78b2233","System.Management.Automation.dll":"e767f5c26347b254dd06fa0b65e18424cc4eb93fc3102c5a8fdd9dd88355db97","Microsoft.CodeAnalysis.dll":"e7a25cbdec95390e9672659872189da368032625d784c25569617617932c145f","Microsoft.CodeAnalysis.CSharp.dll":"5e9323e98d99f669acd10705c40d985dbabeaf0984285ed32922f91df223124b","./deploy-native-source-facts.ps1":"8cf476f30e7b5c94d69f77549710f6b6b10b79c85f13f0d832f9531d572dd3aa"})
const failed=code=>({literals:[],assignments:[],errors:[code]})
const expectedPins=['./deploy-native-source-facts.ps1','Microsoft.CodeAnalysis.CSharp.dll','Microsoft.CodeAnalysis.dll','System.Management.Automation.dll','pwsh.exe'].sort()
function verifyPins(){
  if(JSON.stringify(Object.keys(PINS).sort())!==JSON.stringify(expectedPins))return false
  for(const [path,digest] of Object.entries(PINS)){
    const actual=path.startsWith('./')?fileURLToPath(new URL(path,import.meta.url)):runtime+path
    if(createHash('sha256').update(fs.readFileSync(actual)).digest('hex')!==digest)return false
  }
  return true
}
export function nativeSourceFacts(language,bytes){
  if(process.platform!=='win32')return failed('NATIVE_PARSER_WINDOWS_REQUIRED')
  if(!['cs','ps1'].includes(language)||!Buffer.isBuffer(bytes)||bytes.length>1048576)return failed('NATIVE_SOURCE_LIMIT')
  try{
    if(Object.keys(PINS).length!==5)return failed('NATIVE_PARSER_PINS_MISSING')
    if(!verifyPins())return failed('NATIVE_PARSER_SOURCE_CHANGED')
    const child=spawnSync(runtime+'pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./deploy-native-source-facts.ps1',import.meta.url))],{
      shell:false,windowsHide:true,encoding:'utf8',input:JSON.stringify({language,base64:bytes.toString('base64')}),timeout:20000,maxBuffer:4*1024*1024,
      env:Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP)$/i.test(key))),
    })
    if(child.error||child.status!==0)return failed('NATIVE_PARSER_PROCESS_FAILED')
    // Detect a persistent on-disk change during the request. These path reads
    // and the Windows loader are NOT atomic; change-and-restore is not proven.
    if(!verifyPins())return failed('NATIVE_PARSER_SOURCE_CHANGED')
    const facts=JSON.parse(child.stdout)
    if(typeof facts.runtime?.automationAssembly!=='string'||facts.runtime.automationAssembly.toLowerCase()!==(runtime+'System.Management.Automation.dll').toLowerCase())return failed('NATIVE_PARSER_RUNTIME_IDENTITY_INVALID')
    if(!Array.isArray(facts.literals)||!Array.isArray(facts.assignments)||!Array.isArray(facts.errors)||
      facts.literals.length>20000||facts.assignments.length>100000||facts.errors.length>30||
      facts.literals.some(v=>typeof v!=='string'||v.length>1048576)||
      facts.assignments.some(r=>typeof r?.key!=='string'||r.key.length>8192||!Array.isArray(r.values)||r.values.length>20000||r.values.some(v=>typeof v!=='string'||v.length>1048576))||
      facts.errors.some(e=>typeof e!=='string'||!/^NATIVE_|^CSHARP_|^POWERSHELL_/.test(e)||!/^[A-Z_]{1,80}$/.test(e)))return failed('NATIVE_PARSER_REPORT_INVALID')
    return facts
  }catch{return failed('NATIVE_PARSER_UNAVAILABLE')}
}
