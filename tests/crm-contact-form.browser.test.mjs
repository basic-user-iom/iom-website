// Local only: actual CRM components/getLead/updateLead; synthetic transport and auth.
// node --test tests/crm-contact-form.browser.test.mjs
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { basename, dirname } from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { contactLead, catalogLead } from './fixtures/crm-contact-leads.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
let browser, server, origin, state
const evidence = { cases: [], payloads: [], externalRequests: [], unexpectedRequests: [], pageErrors: [] }
function reset() { state = { rows:{a:contactLead('a'),b:contactLead('b')}, plans:{}, gets:[], patches:[], held:[] } }
function override(source, functions) {
  for(const [name,body] of Object.entries(functions)) {
    const expression = new RegExp('export (async )?function '+name+'\\(')
    assert.match(source,expression,'real export must exist: '+name)
    source=source.replace(expression,(_,async)=>(async||'')+'function original_'+name+'(')
    source+='\nexport '+body+'\n'
  }
  return source
}
const apiMocks = {
  getCurrentUser:"async function getCurrentUser() { return {id:'mock-user',email:'owner@example.test',avatar_url:null} }",
  onAuthChange:"function onAuthChange() { return () => {} }",
  listLeads:"async function listLeads() { return (await fetch('/mock/catalog')).json() }",
  listStaffProfiles:"async function listStaffProfiles() { return new Map() }",
  probeOwnerAttributionSchema:"async function probeOwnerAttributionSchema() { return {ownerSnapshotColumns:true,staffProfiles:true} }",
  backfillOwnLeadOwnerSnapshot:"async function backfillOwnLeadOwnerSnapshot() { return [] }",
  backfillMissingClientReplyAts:"async function backfillMissingClientReplyAts() { return [] }",
}
for(const name of ['probeClientLocaleSchema','probeLinksSchema','probeValueEmojiSchema','probeContactPrioritySchema','probeScheduledSendSchema','probeEmailsSchema','probeAtlasEvalSchema','probeOutreachSchema'])
  apiMocks[name]='async function '+name+'() { return true }'
for(const name of ['listActivities','listLeadMessages','listActivitiesForLeads','listLeadMessagesForLeads'])
  apiMocks[name]='async function '+name+'() { return [] }'
const nullComponents = new Set(['BlogView','DemosView','LinksView','ProjectCostsEmbedView','CrmFollowUpCalendar',
  'CrmLogin','CrmMusicPlayer','IdeasView','NotesView','ScreenRecorderView','SeoView','LeadBulkImportPanel',
  'ProjectsView','ClientAccountsView','ClientPortalView','UnmatchedInboundPanel','StaffMfaSetup','TimeView',
  'UserProfileMenu','ActivityPanel','EmailThreadPanel','InitialOutreachPanel','LeadNdaPanel','LeadClientLocal'])
const mockClient = [
  'export const isSupabaseConfigured = true',
  'export const useLiveCrmBackend = () => true',
  'export function getSupabase() { return { from(table) {',
  "if(table !== 'crm_leads') throw Error('Blocked mock table: '+table)",
  'let id, payload',
  'const query = { select() { return query },',
  "eq(key,value) { if(key !== 'id') throw Error('Blocked mock filter'); id=value; return query },",
  'update(value) { payload=value; return query },',
  'async maybeSingle() {',
  "const response=await fetch('/mock/leads/'+id, payload === undefined ? {} :",
  "{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})",
  "return response.ok ? {data:await response.json(),error:null} : {data:null,error:{message:'mock detail failure'}}",
  '}, single() { return query.maybeSingle() } }; return query } } }',
].join('\n')
const plugin = {
  name:'local-only-contact-boundaries',
  setup(build) {
    build.onLoad({filter:/[\\/]src[\\/]crm[\\/].*\.(ts|tsx)$/},async ({path})=>{
      const name=basename(path).replace(/\.tsx?$/,'')
      let source=await readFile(path,'utf8')
      if(name==='supabaseClient') return {loader:'ts',contents:mockClient}
      if(name==='api') source=override(source,apiMocks)
      else if(name==='workspaceApi') {
        const mocks={}
        for(const key of ['listProjectsForLead','listProjectsForLeads','listMindMaps'])
          mocks[key]='async function '+key+'() { return [] }'
        mocks.listMindMapLeadIds='async function listMindMapLeadIds() { return new Set() }'
        source=override(source,mocks)
      } else if(name==='clientTenancyApi') source=override(source,{
        resolveCrmAccessRole:"async function resolveCrmAccessRole() { return 'staff' }",
      })
      else if(name==='crmMfa') source=override(source,{
        getPostLoginMfaState:"async function getPostLoginMfaState() { return {kind:'signed_in'} }",
        staffHasVerifiedMfa:"async function staffHasVerifiedMfa() { return true }",
      })
      else if(name==='CrmWelcomeGuide') return {loader:'tsx',contents:
        'export const CrmWelcomeGuide=()=>null; export const hasSeenCrmWelcome=()=>true; export const markCrmWelcomeSeen=()=>{}'}
      else if(nullComponents.has(name)) {
        const names=[...source.matchAll(/export (?:async )?(?:function|const|class) (\w+)/g)].map(m=>m[1])
        return {loader:'tsx',contents:names.map(n=>'export const '+n+'=()=>null').join('\n')}
      } else return
      return {contents:source,loader:'ts'}
    })
  },
}
before(async ()=>{
  const result=await build({
    absWorkingDir:root,
    stdin:{contents:[
      "import React,{useEffect,useState} from 'react'",
      "import {createRoot} from 'react-dom/client'",
      "import {CrmApp} from './src/crm/CrmApp'",
      "import {LeadDetail} from './src/crm/LeadDetail'",
      "import {CrmI18nProvider} from './src/crm/i18n'",
      "import {getLead} from './src/crm/api'",
      "function Harness(){ const [lead,setLead]=useState(null);",
      "useEffect(()=>{window.refreshContact=async()=>{const next=await getLead('a');setLead(next)};void window.refreshContact()},[]);",
      "return <CrmI18nProvider>{lead && <LeadDetail lead={lead} currentUser={null} onChanged={setLead} onDeleted={()=>{}} pollEnabled={false}/>}</CrmI18nProvider> }",
      "createRoot(document.getElementById('root')).render(<React.StrictMode>{location.search ? <Harness/> : <CrmApp/>}</React.StrictMode>)",
    ].join(';'),resolveDir:root,loader:'tsx'},
    bundle:true,write:false,outfile:'app.js',jsx:'automatic',logLevel:'silent',
    define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[plugin],loader:{'.md':'text'},
  })
  const bundle=Object.fromEntries(result.outputFiles.map(f=>[basename(f.path),f.contents]))
  server=createServer(async(req,res)=>{
    const reply=(value,code=200)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
    if(req.url==='/' || req.url==='/?detail-harness') {res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');return}
    if(bundle[req.url.slice(1)]) {res.writeHead(200,{'Content-Type':req.url.endsWith('.css')?'text/css':'text/javascript'});res.end(bundle[req.url.slice(1)]);return}
    if(req.url==='/mock/catalog' && req.method==='GET') return reply([catalogLead('a'),catalogLead('b')])
    const match=/^\/mock\/leads\/([ab])$/.exec(req.url)
    if(match) {
      const id=match[1]
      if(req.method==='PATCH') {
        let raw='';for await(const chunk of req) raw+=chunk
        const patch=JSON.parse(raw)
        state.patches.push({id,patch});evidence.payloads.push({id,patch})
        state.rows[id]={...state.rows[id],...patch}
        return reply(state.rows[id])
      }
      if(req.method==='GET') {
        const plan=state.plans[id]??{}
        state.gets.push(id)
        if(plan.hold) await new Promise(resolve=>state.held.push({id,resolve}))
        if(plan.error) return reply({error:'mock detail failure'},500)
        const row={...state.rows[id]}
        for(const key of plan.omit??[]) delete row[key]
        return reply(row)
      }
    }
    if(req.url==='/favicon.ico') {res.writeHead(204);res.end();return}
    evidence.unexpectedRequests.push({method:req.method,path:req.url})
    reply({error:'blocked local route'},403)
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  origin='http://127.0.0.1:'+server.address().port
  browser=await chromium.launch({headless:true})
})
after(async()=>{
  for(const item of state?.held??[]) item.resolve()
  await browser?.close()
  await new Promise(resolve=>server?server.close(resolve):resolve())
  if(process.env.CRM_CONTACT_TEST_REPORT) {
    await mkdir(dirname(process.env.CRM_CONTACT_TEST_REPORT),{recursive:true})
    await writeFile(process.env.CRM_CONTACT_TEST_REPORT,JSON.stringify(evidence,null,2))
  }
})
async function openPage(t, harness=false) {
  const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block'})
  t.after(async()=>{for(const r of state.held) r.resolve();await context.close()})
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin) {
      evidence.externalRequests.push(route.request().url());return route.abort()
    }
    return route.continue()
  })
  await context.addInitScript(()=>{localStorage.setItem('iom-crm-lang','en');localStorage.setItem('iom-crm-detail-expanded','1')})
  const page=await context.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror',error=>evidence.pageErrors.push(error.message))
  await page.goto(origin+(harness?'/?detail-harness':''))
  await page.locator('.crm-detail').waitFor()
  return page
}
const editButton=page=>page.locator('.crm-detail').getByRole('button',{name:'Edit',exact:true})
const company=page=>page.getByRole('textbox',{name:'Company / account',exact:true})
async function waitFor(predicate) {
  const deadline=Date.now()+6000
  while(!predicate()) {if(Date.now()>deadline) throw Error('Timed out waiting for mock request');await new Promise(resolve=>setTimeout(resolve,25))}
}
function pass(name) {evidence.cases.push({name,status:'PASS'})}

test('slow load: only the edited company reaches the real updateLead transport',async t=>{
  reset();state.plans.a={hold:true}
  const page=await openPage(t)
  await waitFor(()=>state.gets.includes('a'))
  assert.equal(await editButton(page).isDisabled(),true)
  assert.equal(state.patches.length,0)
  state.plans.a={};for(const r of state.held) r.resolve()
  await editButton(page).click()
  await company(page).fill('Changed company')
  await page.getByRole('button',{name:'Save lead',exact:true}).click()
  await waitFor(()=>state.patches.length===1)
  assert.deepEqual(state.patches,[{id:'a',patch:{company_name:'Changed company'}}])
  assert.equal(state.rows.a.offer,'Pavilion walkthrough')
  assert.equal(state.rows.a.initial_email_drafted_at,null)
  pass(t.name)
})

test('error/retry blocks editing until successful detail read',async t=>{
  reset();state.plans.a={error:true}
  const page=await openPage(t)
  const retry=page.locator('.crm-detail').getByRole('button',{name:'Retry',exact:true})
  await retry.waitFor()
  assert.equal(await editButton(page).isDisabled(),true)
  state.plans.a={}
  await retry.click()
  await editButton(page).click()
  assert.equal(await company(page).inputValue(),'Acme Mock')
  assert.equal(state.patches.length,0)
  pass(t.name)
})

test('lead change ignores the previous lead late response',async t=>{
  reset();state.plans.a={hold:true}
  const page=await openPage(t)
  await waitFor(()=>state.gets.includes('a'))
  await page.locator('.crm-lead-row').filter({hasText:'Beta Mock'}).click()
  await editButton(page).click()
  await company(page).fill('Unsaved Beta draft')
  for(const r of state.held) r.resolve()
  await page.waitForTimeout(100)
  assert.equal(await company(page).inputValue(),'Unsaved Beta draft')
  assert.equal(state.patches.length,0)
  pass(t.name)
})

test('background refresh keeps draft; cancel/reopen restores saved data',async t=>{
  reset()
  const page=await openPage(t,true)
  await editButton(page).click()
  await company(page).fill('Unsaved draft')
  state.rows.a={...state.rows.a,company_name:'Server refresh name'}
  const readsBefore=state.gets.length
  await page.evaluate(()=>window.refreshContact())
  assert.ok(state.gets.length>readsBefore, 'a real mock GET completed during editing')
  await page.waitForTimeout(50)
  assert.equal(await company(page).inputValue(),'Unsaved draft')
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await editButton(page).click()
  assert.equal(await company(page).inputValue(),'Server refresh name')
  assert.equal(state.patches.length,0)
  pass(t.name)
})

test('offer/notes with missing phone cannot erase stored phone',async t=>{
  reset();state.plans.a={omit:['phone']}
  const phone=state.rows.a.phone
  const page=await openPage(t)
  await page.locator('.crm-detail').getByRole('button',{name:'Retry',exact:true}).waitFor()
  assert.equal(await editButton(page).isDisabled(),true)
  assert.equal(state.patches.length,0)
  assert.equal(state.rows.a.phone,phone)
  pass(t.name)
})

test('real normalization of missing contact_role cannot blank it on another edit',async t=>{
  reset();state.plans.a={omit:['contact_role']}
  state.rows.a.contact_role='Server value must survive'
  const page=await openPage(t)
  await editButton(page).click()
  assert.equal(await page.getByRole('textbox',{name:'Contact role',exact:true}).inputValue(),'')
  await company(page).fill('Only company changed')
  await page.getByRole('button',{name:'Save lead',exact:true}).click()
  await waitFor(()=>state.patches.length===1)
  assert.deepEqual(state.patches[0],{id:'a',patch:{company_name:'Only company changed'}})
  assert.equal(state.rows.a.contact_role,'Server value must survive')
  pass(t.name)
})

test('isolation: no external requests, unexpected local routes or page errors',()=>{
  assert.deepEqual(evidence.externalRequests,[])
  assert.deepEqual(evidence.unexpectedRequests,[])
  assert.deepEqual(evidence.pageErrors,[])
  pass('test isolation')
})
