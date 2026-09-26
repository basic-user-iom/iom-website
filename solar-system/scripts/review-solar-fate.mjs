import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.REVIEW_OUT ?? 'tmp/scenario-review-after';await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true});const page=await b.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
await page.goto('http://127.0.0.1:5194/demos/solar-system/');
await page.getByTestId('ephemeris-provider-badge').waitFor({timeout:120000});
await page.evaluate(async()=>{
for(const [file,cls,key,method] of [
['/src/rendering/DebugSolarSystemRenderer.ts','DebugSolarSystemRenderer','r','setSolarEvolutionRenderState'],
['/src/simulation/scenarios/solar-fate/ScientificSolarEvolutionScenario.ts','ScientificSolarEvolutionScenario','evo','start'],
['/src/simulation/scenarios/solar-fate/FictionalSolarSupernovaScenario.ts','FictionalSolarSupernovaScenario','nova','start']]){
const u=performance.getEntriesByType('resource').find(r=>r.name.includes(file));if(!u)continue;
const m=await import(u.name),original=m[cls].prototype[method];if(!original)continue;
m[cls].prototype[method]=function(...args){window[key]=this;return original.apply(this,args)};
}});
await page.getByTestId('solar-fate-drawer-toggle').click();
await page.getByTestId('solar-evolution-start').click();
await page.getByTestId('solar-evolution-pause').click();
const results=[];
for(const [phase,offset] of [['present',2],['red-giant',4],['inner-system-heating',4],['mass-loss-nebular',4],['white-dwarf',2],['cooling-remnant',3]]){
await page.evaluate(([p,t])=>{window.evo.skipToPhase(p);if(window.evo.state==='running')window.evo.pause();window.evo.frameStep(t)},[phase,offset]);
await page.waitForTimeout(1400);await page.getByTestId('viewport-fullscreen-toggle').click();await page.waitForTimeout(600);
await page.screenshot({path:out+'/evolution-'+phase+'.png'});
results.push(await page.locator('canvas[data-testid="solar-system-canvas"]').evaluate(e=>({...e.dataset})));
await page.getByTestId('viewport-fullscreen-toggle').click();
}
await page.getByTestId('solar-fate-stage-mass-loss-nebular').click();
await page.evaluate(()=>window.evo.frameStep(4));
for(const view of ['wide','star','auto']){
 await page.getByTestId('solar-fate-camera').selectOption(view);
 await page.waitForTimeout(1000);
 if(await page.getByTestId('solar-fate-camera').inputValue()!==view)throw Error('Camera control did not update');
 await page.screenshot({path:out+'/camera-'+view+'.png'});
}
for(const quality of ['low','medium','high','ultra']){
 await page.evaluate(quality=>window.r.setVisualQuality(quality),quality);
 await page.waitForTimeout(800);
 await page.getByTestId('viewport-fullscreen-toggle').click();
 await page.waitForTimeout(400);
 await page.screenshot({path:out+'/quality-'+quality+'.png'});
 await page.getByTestId('viewport-fullscreen-toggle').click();
}
await page.getByTestId('solar-fate-stage-present').click();
if(await page.getByTestId('solar-fate-stage-present').getAttribute('aria-current')!=='step')throw Error('Backward phase navigation failed');
await page.setViewportSize({width:320,height:900});
await page.getByTestId('solar-fate-stage-red-giant').scrollIntoViewIfNeeded();
await page.getByTestId('solar-fate-stage-red-giant').click();
await page.getByTestId('solar-fate-camera').selectOption('wide');
await page.screenshot({path:out+'/mobile-controls.png'});
if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1))throw Error('Mobile overflow');
await page.setViewportSize({width:1440,height:900});
await page.getByTestId('solar-fate-camera').selectOption('auto');
await page.getByTestId('solar-evolution-reset').click();
await page.getByTestId('fictional-supernova-start').click();await page.getByTestId('fictional-supernova-confirm').click();
await page.getByTestId('fictional-supernova-pause').click();
for(const t of [1,3,5,8,15,28,38]){
await page.evaluate(t=>{const s=window.nova.getSnapshot();window.nova.frameStep(Math.max(.01,t-s.scenarioTimeSeconds))},t);
await page.waitForTimeout(1000);await page.getByTestId('viewport-fullscreen-toggle').click();await page.waitForTimeout(400);await page.screenshot({path:out+'/nova-'+t+'.png'});
results.push(await page.locator('canvas[data-testid="solar-system-canvas"]').evaluate(e=>({...e.dataset})));
await page.getByTestId('viewport-fullscreen-toggle').click();
}
await page.getByTestId('fictional-supernova-reset').click();
await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));console.log({errors,captures:results.length});
if(errors.length)throw Error(errors.join('\n'));
if(results.some(r=>r.scaleMode!=='true'))throw Error('Scenario changed True scale');
}finally{await b.close()}
