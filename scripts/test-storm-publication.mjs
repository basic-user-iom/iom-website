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

// Exercise the actual disclosure callbacks with controlled layout/observer inputs.
// Native keyboard dispatch and real CSS layout remain browser QA responsibilities.
const ts = (await import('typescript')).default
const vm = await import('node:vm')
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const cardSource = readFileSync('src/components/ProjectCard.tsx', 'utf8')
const cardTree = ts.createSourceFile('card.tsx', cardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const disclosure = cardTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ThreeDCardDescription')
assert.ok(disclosure)
const executable = ts.transpileModule('export ' + disclosure.getText(cardTree), {
  fileName: 'disclosure.tsx', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function disclosureHarness(props, scrollHeight = 160, clientHeight = 64) {
  const slots = [], observers = new Set(), listeners = new Set()
  const element = { scrollHeight, clientHeight }
  let cursor = 0, pending = [], dirty = true, tree
  const exports = {}
  const context = vm.createContext({ exports, require,
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true }
      }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useId: () => 'test-description',
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i]))) {
        const slot = { deps, cleanup: null }; slots[index] = slot
        pending.push(() => { previous?.cleanup?.(); slot.cleanup = effect() })
      }
    },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback }
      observe() { observers.add(this) }
      disconnect() { observers.delete(this) }
    },
    window: { addEventListener: (_name, callback) => listeners.add(callback), removeEventListener: (_name, callback) => listeners.delete(callback) },
    document: { fonts: { ready: Promise.resolve() } },
  })
  vm.runInContext(executable, context)
  const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
    : value && typeof value === 'object' && value.props ? [value, ...nodes(value.props.children)] : []
  function flush() {
    let count = 0
    do {
      assert.ok(++count < 12, 'Disclosure render loop')
      dirty = false; cursor = 0; pending = []
      tree = exports.ThreeDCardDescription(props)
      const paragraph = nodes(tree).find(n => n.type === 'p')
      paragraph.props.ref.current = element
      pending.forEach(effect => effect())
    } while (dirty)
    return tree
  }
  flush()
  return {
    flush,
    paragraph: () => nodes(tree).find(n => n.type === 'p'),
    button: () => nodes(tree).find(n => n.type === 'button'),
    expanded: () => tree.props['data-expanded'],
    click(detail = 1) {
      let stopped = false
      const button = nodes(tree).find(n => n.type === 'button'); assert.ok(button)
      button.props.onClick({ detail, stopPropagation() { stopped = true } })
      assert.equal(stopped, true, 'Disclosure must not activate the card link')
    },
    resize(scroll, client) { element.scrollHeight = scroll; element.clientHeight = client; observers.forEach(o => o.callback()); listeners.forEach(f => f()); return flush() },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); assert.equal(observers.size, 0); assert.equal(listeners.size, 0) },
  }
}
const dictionariesBuild = await build({ stdin: { contents: app.SITE_LANGS.map(lang => "export { " + lang + "Ui } from './src/i18n/ui/" + lang + "';").join('\n'), resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' })
const dictionaries = await import('data:text/javascript;base64,' + Buffer.from(dictionariesBuild.outputFiles[0].text).toString('base64'))
for (const lang of app.SITE_LANGS) {
  const dict = dictionaries[lang + 'Ui']
  assert.ok(dict['card.readMore'] && dict['card.readLess'])
  assert.notEqual(dict['card.readMore'], dict['card.readLess'])
  const props = { text: app.localizeProject(threeD.find(p => p.id === 'raven-path'), lang).description, moreLabel: dict['card.readMore'], lessLabel: dict['card.readLess'] }
  const h = disclosureHarness(props)
  assert.equal(h.expanded(), false)
  assert.equal(h.paragraph().props.children, props.text)
  assert.equal(h.button().props.type, 'button')
  assert.equal(h.button().props['aria-controls'], h.paragraph().props.id)
  assert.equal(h.button().props['aria-expanded'], false)
  assert.equal(h.button().props.onKeyDown, undefined, 'Use native button keyboard semantics')
  for (let repeat = 0; repeat < 3; repeat++) {
    h.click(0); h.flush() // A native button's keyboard activation dispatches click.
    assert.equal(h.expanded(), true); assert.equal(h.button().props.children, props.lessLabel)
    assert.equal(h.paragraph().props.children, props.text)
    h.click(); h.flush(); assert.equal(h.expanded(), false); assert.equal(h.button().props.children, props.moreLabel)
  }
  h.click(); h.click(); h.flush(); assert.equal(h.expanded(), false, 'Rapid repeated clicks must not leave stale state')
  h.resize(40, 40); assert.equal(h.button(), undefined, 'Fitting text needs no empty control')
  h.resize(180, 64); assert.ok(h.button(), 'Narrow/mobile wrapping restores expansion')
  h.click(); h.flush(); h.resize(40, 40); assert.ok(h.button(), 'Keep collapse reachable after widening')
  h.click(); h.flush(); assert.equal(h.button(), undefined)
  h.unmount()
}
assert.ok(cardSource.includes("key={project.id + ':' + lang + ':' + project.description}"), 'Locale/text changes remount collapsed state')
assert.match(cardSource, /project\.section === '3d' \? \(\s*<ThreeDCardDescription/)
assert.ok(cardSource.includes(') : <p className="card-desc">{project.description}</p>}'), 'Other sections preserve full description markup')
assert.ok(cardSource.includes("hasSecondaryLinks || hasEmbedPreview || project.section === '3d'"), 'Disclosure buttons cannot be nested inside card anchors')
const cssSource = readFileSync('src/index.css', 'utf8')
const disclosureCss = cssSource.slice(cssSource.indexOf('/* Compact 3D descriptions;'), cssSource.indexOf('\n.card-footer {', cssSource.indexOf('/* Compact 3D descriptions;')))
assert.ok(disclosureCss.includes('-webkit-line-clamp: 3'))
assert.ok(disclosureCss.includes("[data-expanded='false']"))
assert.ok(disclosureCss.includes('min-height: 44px'))
assert.ok(disclosureCss.includes(':focus-visible'))
assert.ok(!/max-height:|(?<!min-)height:|@media/.test(disclosureCss.replace('min-height: 44px;', '')), 'No fixed card height or viewport-specific text clipping')
for (const selector of [...disclosureCss.matchAll(/(?:^|\n)([^{}\n]+)\s*\{/g)].map(m => m[1].trim())) assert.ok(selector.startsWith('.project-card--3d '))
assert.equal(JSON.parse(readFileSync('docs/STORM-PUBLICATION-SCOPE.json', 'utf8')).files.length, 40)
console.log('PASS: 3D disclosure full-text/state/repeated activation/overflow-resize/cleanup, native button semantics, six locale labels, locale reset key and section-scoped CSS. Real browser keyboard/layout still require visual QA.')
