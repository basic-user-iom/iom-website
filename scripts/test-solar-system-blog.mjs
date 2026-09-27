import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { emitSolarSystemBlog } from './emit-solar-system-blog.mjs'
const root=process.cwd(), locales=['en','de','fr','nl','it','es']
const parse=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const meta=parse('src/blog/posts/solar-system/metadata.json')
assert.deepEqual(Object.keys(meta.locales).sort(),[...locales].sort())
for(const locale of locales){
 const body=readFileSync(`src/blog/posts/solar-system/${locale}.md`,'utf8')
 assert(body.split(/\s+/).length>1000,locale+' has a complete article')
 assert.equal((body.match(/^## /gm)||[]).length,9)
 const images=[...body.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)]
 assert.equal(images.length,7)
 for(const [,caption,url] of images){assert(caption.length>40);assert(existsSync('public'+url))}
 assert(!body.includes('\uFFFD'))
 for(const key of ['title','excerpt','seo_title','seo_description']) assert(meta.locales[locale][key].length>25)
}
assert(existsSync('public'+meta.cover_image_url))
const bundle=await build({entryPoints:['src/blog/publicApi.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[
 {name:'markdown',setup(b){b.onLoad({filter:/\.md$/},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}))}},
 {name:'cms-fixture',setup(b){b.onLoad({filter:/supabaseClient\.ts$/},()=>({contents:`
 export const isBlogSupabaseReady=()=>true;
 export const getBlogSupabase=()=>globalThis.__noCms?null:{from(table){let slug=null;const q={select(){return q},eq(k,v){if(k==='slug')slug=v;return q},order(){return q},in(){return q},maybeSingle(){return q},then(ok,err){return Promise.resolve(globalThis.__cmsFailure?Promise.reject(Error('offline')):{data:table==='blog_post_translations'?[]:slug?globalThis.__rows.find(p=>p.slug===slug)??null:globalThis.__rows,error:null}).then(ok,err)}};return q}};
 `}))}},
]})
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
globalThis.__rows=[]
for(const locale of locales){
 const list=await api.fetchPublishedPosts(locale);assert.equal(list.length,1);assert.equal(list[0].title,meta.locales[locale].title)
 const detail=await api.fetchPublishedPostBySlug(meta.slug,locale);assert.equal(detail.title,list[0].title);assert(detail.body.length>6000)
}
assert.equal(await api.fetchPublishedPostBySlug('not-published'),null)
globalThis.__rows=[{id:'cms-solar',slug:meta.slug,title:'CMS edition',body:'CMS body',status:'published',published_at:meta.published_at},{id:'another',slug:'another',title:'Existing article',status:'published',published_at:'2026-07-01T00:00:00Z'}]
assert.equal((await api.fetchPublishedPosts()).length,2)
assert.equal((await api.fetchPublishedPostBySlug(meta.slug)).title,'CMS edition')
globalThis.__cmsFailure=true
assert.equal((await api.fetchPublishedPostBySlug(meta.slug,'fr')).title,meta.locales.fr.title)
globalThis.__cmsFailure=false;globalThis.__noCms=true
assert.equal((await api.fetchPublishedPostBySlug(meta.slug,'es')).title,meta.locales.es.title)
mkdirSync('tmp',{recursive:true});const output=mkdtempSync(resolve('tmp/solar-blog-html-'))
writeFileSync(resolve(output,'index.html'),readFileSync('index.html','utf8'))
writeFileSync(resolve(output,'sitemap.xml'),'<?xml version="1.0"?><urlset xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>')
await emitSolarSystemBlog(root,output)
for(const locale of locales){
 const p=(locale==='en'?'':locale+'/')+'blog/'+meta.slug+'/index.html'
 const html=readFileSync(resolve(output,p),'utf8')
 assert(html.includes(`<html lang="${locale}">`));assert(html.includes('property="og:type" content="article"'))
 assert(html.includes(meta.locales[locale].title));assert.equal((html.match(/class="blog-figure"/g)||[]).length,7)
 assert(html.includes('data-iom-blog-jsonld'));assert(html.includes(meta.cover_image_url));assert(!html.includes('og-image.svg'))
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert.equal((html.match(/\shreflang=/g)||[]).length,13)
}
console.log('PASS: six complete translations, eight screenshots, CMS coexistence/precedence/failover, static article HTML and sharing metadata.')
