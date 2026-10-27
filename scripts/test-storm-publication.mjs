import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root=process.cwd()
const result=await build({stdin:{contents:
  "export { SITE_LANGS } from './src/i18n/types'; export { localePath } from './src/i18n/routing'; export { PROJECTS, projectAllowsHoverEmbed } from './src/data/projects'; export { localizeProject } from './src/i18n/projects/localize'; export { getCaseStudyOverlay } from './src/i18n/caseStudies'; export { SITE_PUBLISHED_POSTS, mergeSitePublishedPosts } from './src/blog/sitePublishedPosts';",resolveDir:root,loader:'ts'},
  bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',
  plugins:[{name:'raw-markdown',setup(b){b.onLoad({filter:/\.md\?raw$/},args=>({contents:readFileSync(args.path.replace(/\?raw$/,''),'utf8'),loader:'text'}));b.onResolve({filter:/\.md\?raw$/},args=>({path:resolve(args.resolveDir,args.path)}))}}]})
const app=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
const story=JSON.parse(readFileSync('src/data/stormPublication.json','utf8'))
const meta=JSON.parse(readFileSync('src/blog/posts/storm-monolith/metadata.json','utf8'))
assert.deepEqual(Object.keys(story.locales).sort(),[...app.SITE_LANGS].sort())
assert.deepEqual(Object.keys(meta.locales).sort(),[...app.SITE_LANGS].sort())
const cards=app.PROJECTS.filter(p=>[story.slug,'case-study-storm-monolith'].includes(p.id))
assert.equal(cards.length,2)
assert.equal(cards.find(p=>p.id===story.slug).section,'3d')
assert.equal(cards.find(p=>p.id===story.slug).url,story.live)
const threeD=app.PROJECTS.filter(p=>p.section==='3d')
assert.equal(threeD[0].id,story.slug)
assert.equal(threeD.at(-1).id,'artist-globe')
assert.deepEqual(threeD.filter(p=>p.featured).map(p=>p.id),[story.slug])
for(const lang of app.SITE_LANGS){
  const localized=threeD.map(p=>app.localizeProject(p,lang))
  assert.equal(localized[0].featured,true)
  assert.equal(localized.at(-1).id,'artist-globe')
  assert.ok(!localized.at(-1).featured)
  assert.equal(localized.at(-1).url,'/artist-globe')
}

for(const card of cards)assert.equal(app.projectAllowsHoverEmbed(card),false)
assert.equal(new Set(app.PROJECTS.map(p=>p.id)).size,app.PROJECTS.length)
const post=app.SITE_PUBLISHED_POSTS.find(p=>p.slug===story.article)
assert.ok(post)
assert.equal(app.mergeSitePublishedPosts([{...post,id:'cms-copy'}]).filter(p=>p.slug===story.article).length,1)
const built=existsSync('dist/index.html')
for(const lang of app.SITE_LANGS){
  const c=story.locales[lang]
  const blog=app.localePath(lang,'/blog/'+story.article)
  const study=app.localePath(lang,'/case-studies/'+story.slug)
  assert.ok(post.translations[lang].body.includes(']('+study+')'))
  assert.ok(post.translations[lang].body.includes(story.live))
  assert.equal(c.stages.length,4)
  assert.ok(c.deliverables.length>=4)
  if(lang!=='en'){
    const overlay=app.getCaseStudyOverlay(lang,story.slug)
    assert.equal(overlay.title,c.title)
    assert.equal(Object.keys(overlay.stages).length,4)
    assert.notEqual(c.title,story.locales.en.title)
  }
  for(const card of cards){
    const p=app.localizeProject(card,lang)
    assert.equal(p.referenceUrls.find(r=>r.url.includes('/blog/')).url,blog)
    const casePath=p.caseStudyPath??p.url
    assert.equal(app.localePath(lang,casePath),study)
  }
  for(const text of [JSON.stringify(c),post.translations[lang].body])assert.ok(!/[\uFFFD\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
  if(built){
    const html=readFileSync('dist'+blog+'/index.html','utf8')
    assert.ok(html.includes('<html lang="'+lang+'">'))
    assert.ok(html.includes('href="https://iobjectm.com'+blog+'"'))
    assert.ok(html.includes(c.title.replaceAll('&','&amp;')))
    assert.ok(html.includes(study))
    assert.ok(html.includes(story.live))
    const json=html.match(/<script type="application\/ld\+json" data-iom-blog-jsonld="true">(.*?)<\/script>/s)
    assert.equal(JSON.parse(json[1]).inLanguage,lang)
    for(const other of app.SITE_LANGS)assert.ok(html.includes('hreflang="'+other+'"'))
    assert.ok(readFileSync('dist/sitemap.xml','utf8').includes('https://iobjectm.com'+blog))
  }
}
const config=JSON.parse(readFileSync('vercel.json','utf8'))
const rewrites=config.rewrites.filter(r=>r.destination?.includes(story.article+'/index.html'))
assert.equal(rewrites.length,4)
for(const rewrite of rewrites)assert.ok(config.rewrites.indexOf(rewrite)<config.rewrites.findIndex(r=>r.destination==='/index.html'))
for(const file of ['scene.webp','scene-400.webp','detail.webp']){
  const asset='public/assets/blog/storm-monolith-studio/'+file
  assert.ok(readFileSync(asset).length<350000)
  if(built)assert.deepEqual(readFileSync(asset),readFileSync(asset.replace('public/','dist/')))
}
console.log('PASS: six locales, card/case/article links, translations, CMS deduplication, static metadata/hreflang, rewrite order, images and sitemap article URLs. Built output: '+built)
