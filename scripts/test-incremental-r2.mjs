import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { assessReuse, readReusePlan, REUSE_FILE, validateCanonicalReferences, assertRemoteMedia, assertRemoteRange } from './incremental-r2-release.mjs'
import { PUBLIC_ORIGIN, sha256, objectKey, canonicalAssetUrl, releaseConfig, validateManifest } from './r2-release-manifest.mjs'
import { createDemoMediaManifest } from './create-demo-media-manifest.mjs'
const sourceId = 'git:' + '1'.repeat(40), policyId = '2'.repeat(64)
const content = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')
function asset(path = '/demos/example/model.svg', data = content, delivery = 'legacy') {
  const hash=sha256(data)
  return {path,bytes:data.length,sha256:hash,key:objectKey(path,hash),rangeSha256:sha256(data.subarray(0,1024)),delivery,access:'public'}
}
function fixture() {
  const prefix=resolve(tmpdir(),'iom-incremental-test-'),root=mkdtempSync(prefix)
  return {root,cleanup(){assert.ok(resolve(root).startsWith(prefix));rmSync(root,{recursive:true,force:true})}}
}
test('fresh hash and scanner receipt; changed media never reuses stale bytes',()=>{
  const entry=asset(), result=assessReuse(entry,sourceId,()=>content,policyId)
  assert.deepEqual(result.reuse,{sourceIdentity:sourceId,policyId})
  assert.equal(assessReuse(entry,sourceId,()=>Buffer.from('changed'),policyId),null)
  assert.deepEqual(assessReuse(result,sourceId,()=>{throw Error('payload should not be read')},policyId),result)
  let reads=0
  assessReuse(result,sourceId,()=>{reads++;return content},'3'.repeat(64));assert.equal(reads,1)
  assessReuse(result,sourceId,()=>{reads++;return content},policyId,['known-sensitive-value']);assert.equal(reads,2)
  assert.throws(()=>assessReuse(result,sourceId,()=>content,policyId,['xmlns']),/secret scan/)
})
test('private, credential, oversized and tampered receipt inputs fail closed',()=>{
  for(const entry of [{...asset(),access:'private'},{...asset(),path:'/.env/model.svg'},{...asset(),bytes:128*1024*1024+1}])assert.throws(()=>assessReuse(entry,sourceId,()=>content,policyId))
  const f=fixture();try{
    const plan={version:1,origin:PUBLIC_ORIGIN,sourceDeployment:'dpl_test',policyId,files:[assessReuse(asset(),sourceId,()=>content,policyId)]}
    const raw=Buffer.from(JSON.stringify(plan));writeFileSync(join(f.root,REUSE_FILE),raw)
    assert.equal(readReusePlan(f.root,sha256(raw)).files.length,1)
    writeFileSync(join(f.root,REUSE_FILE),JSON.stringify({...plan,policyId:'4'.repeat(64)}))
    assert.throws(()=>readReusePlan(f.root,sha256(raw)),/changed/)
    assert.throws(()=>validateManifest({...plan,files:[{...asset(),access:'private'}]}),/Private/)
  }finally{f.cleanup()}
})
test('missing objects, differing hash/size and invalid ranges block reuse',()=>{
  const entry=asset(),headers=new Headers({'content-length':String(entry.bytes),'x-amz-meta-sha256':entry.sha256})
  assertRemoteMedia(entry,{status:200,headers})
  for(const status of [403,404,500])assert.throws(()=>assertRemoteMedia(entry,{status,headers}))
  assert.throws(()=>assertRemoteMedia(entry,{status:200,headers:new Headers({'content-length':'1','x-amz-meta-sha256':entry.sha256})}))
  assert.throws(()=>assertRemoteMedia(entry,{status:200,headers:new Headers({'content-length':String(entry.bytes),'x-amz-meta-sha256':'0'.repeat(64)})}))
  const rangeHeaders=new Headers({'content-range':`bytes 0-${entry.bytes-1}/${entry.bytes}`,'access-control-allow-origin':'*'})
  assertRemoteRange(entry,{status:206,headers:rangeHeaders},content)
  assert.throws(()=>assertRemoteRange(entry,{status:200,headers:rangeHeaders},content))
  assert.throws(()=>assertRemoteRange(entry,{status:206,headers:rangeHeaders},Buffer.from('wrong')))
})
test('canonical references must resolve and rollback retains immutable keys and legacy cache policy',()=>{
  const f=fixture();try{
    const old=asset(),next=asset(old.path,Buffer.from('new payload'))
    const oldManifest={version:1,origin:PUBLIC_ORIGIN,files:[old]}
    const oldConfig=releaseConfig({},oldManifest),newConfig=releaseConfig({},{...oldManifest,files:[next]})
    assert.notEqual(oldConfig.rewrites[0].destination,newConfig.rewrites[0].destination)
    assert.deepEqual(releaseConfig({},oldManifest),oldConfig)
    assert.match(oldConfig.headers[0].headers[0].value,/must-revalidate/)
    writeFileSync(join(f.root,'index.html'),canonicalAssetUrl(old))
    validateCanonicalReferences(f.root,oldManifest,canonicalAssetUrl)
    writeFileSync(join(f.root,'index.html'),canonicalAssetUrl(next))
    assert.throws(()=>validateCanonicalReferences(f.root,oldManifest,canonicalAssetUrl),/Unresolved/)
  }finally{f.cleanup()}
})
test('50 new demos retain constant routing, skip unchanged payload reads, and preserve originals',()=>{
  const f=fixture();try{
    const old=asset(),files=[old],originals=[];let receiptReads=0,newBytes=0
    const base=releaseConfig({},{version:1,origin:PUBLIC_ORIGIN,files})
    for(let i=0;i<50;i++){
      const slug=`growth-${i}`,dir=join(f.root,'demos',slug);mkdirSync(dir,{recursive:true})
      const payload=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><!-- demo ${i} --></svg>`)
      writeFileSync(join(dir,'model.svg'),payload);originals.push([join(dir,'model.svg'),sha256(payload)])
      const approval=createDemoMediaManifest(f.root,slug,'public')
      const entry=asset(approval.files[0].path,payload,'canonical')
      assert.equal(approval.files[0].url,canonicalAssetUrl(entry));newBytes+=payload.length
      const receipt=assessReuse(entry,sourceId,()=>payload,policyId)
      assessReuse(receipt,sourceId,()=>{receiptReads++;return payload},policyId)
      files.push(receipt)
    }
    const config=releaseConfig({},{version:1,origin:PUBLIC_ORIGIN,files})
    assert.equal(config.rewrites.length,base.rewrites.length);assert.equal(config.headers.length,base.headers.length)
    assert.equal(receiptReads,0)
    for(const [file,hash]of originals)assert.equal(sha256(readFileSync(file)),hash)
    const privateManifest=createDemoMediaManifest(f.root,'growth-0','private')
    assert.equal(privateManifest.visibility,'private');assert.equal(privateManifest.files[0].url,privateManifest.files[0].path)
    console.log(JSON.stringify({growthDemos:50,newMediaBytes:newBytes,unchangedPayloadReads:receiptReads,additionalRouteRules:0,originalFilesPreserved:originals.length,uploaded:0}))
  }finally{f.cleanup()}
})
