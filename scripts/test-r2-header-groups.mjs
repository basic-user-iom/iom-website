import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { groupedLegacyHeaders, MAX_HEADER_SOURCE_LENGTH, routeSource, releaseConfig, PUBLIC_ORIGIN, objectKey, sha256 } from './r2-release-manifest.mjs'
// Isolated provider-owned test dependency; not included in the deployed app.
const require=createRequire(import.meta.url)
const provider=require(process.env.R2_ROUTING_UTILS || '@vercel/routing-utils')
const regex=source=>new RegExp(provider.sourceToRegex(source).src)
const cache=[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'},{key:'CDN-Cache-Control',value:'public, max-age=0, must-revalidate'},{key:'Vercel-CDN-Cache-Control',value:'public, max-age=0, must-revalidate'}]
const compile=headers=>headers.map(h=>({regex:regex(h.source),headers:h.headers}))
const effective=(headers,path)=>Object.fromEntries(headers.filter(h=>h.regex.test(path)).flatMap(h=>h.headers.map(({key,value})=>[key.toLowerCase(),value])))
const entry=(path,delivery='legacy')=>{const hash=sha256(Buffer.from(path));return{path,delivery,access:'public',bytes:42,sha256:hash,rangeSha256:hash,key:objectKey(path,hash)}}
test('provider accepts bounded exact groups with unchanged encoding, case, anchors and header precedence',()=>{
  const files=['/models/a.b.glb','/photos/A (one).jpg','/photos/é & x.png','/odd/$dollar|pipe+.svg','/odd/[brackets]{braces}.png','/odd/caret^x.svg',...Array.from({length:120},(_,i)=>'/demos/example/assets/texture-'+i+'-'.repeat(30)+'.png')].map(p=>entry(p))
  const base=[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'}]},{source:'/photos/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/models/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/private/(.*)',headers:[{key:'Cache-Control',value:'private, no-store'}]}]
  const old=[...base,...files.map(f=>({source:routeSource(f.path),headers:cache}))],groups=groupedLegacyHeaders(files),next=[...base,...groups]
  assert(groups.length>1);assert(groups.every(g=>g.source.length<=MAX_HEADER_SOURCE_LENGTH))
  assert.equal(provider.getTransformedRoutes({headers:next}).error,null)
  const a=compile(old),b=compile(next)
  const urls=new Set(['/private/customer.png','/api/private','/demos/example/index.html','/models/aXb.glb','/photos/A%20(one).jpg'])
  for(const f of files){const p=encodeURI(f.path);for(const url of[p,p+'/',p+'.bak','/prefix'+p,p.toLowerCase(),p.toUpperCase(),decodeURI(p),p.replace(/\./g,'X')])urls.add(url)}
  for(const url of urls)assert.deepEqual(effective(b,url),effective(a,url),url)
  assert.throws(()=>groupedLegacyHeaders([{path:'/'+ 'a'.repeat(MAX_HEADER_SOURCE_LENGTH)+'.png'}]),/budget/)
})
test('50 new demos with 1000 assets, 100 page rewrites and 50 access headers fit without per-asset growth',()=>{
  const files=Array.from({length:976},(_,i)=>entry('/demos/legacy/assets/image-'+i+'.png'))
  const baseline=releaseConfig({},{version:1,origin:PUBLIC_ORIGIN,files}),growth={rewrites:[],headers:[]}
  for(let i=0;i<50;i++){
    const path='/demos/growth-'+i
    growth.rewrites.push({source:path,destination:path+'/index.html'},{source:path+'/',destination:path+'/index.html'})
    growth.headers.push({source:path+'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]})
    for(let j=0;j<20;j++)files.push(entry(path+'/image-'+j+'.png','canonical'))
  }
  const final=releaseConfig(growth,{version:1,origin:PUBLIC_ORIGIN,files})
  assert.equal(final.rewrites.length+final.headers.length,baseline.rewrites.length+baseline.headers.length+150)
  assert(final.rewrites.length+final.headers.length<2048)
  assert.equal(provider.getTransformedRoutes(final).error,null)
})
