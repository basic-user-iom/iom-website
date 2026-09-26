import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.CORONA_OUT??'tmp/corona-before';await mkdir(out,{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(90000);
const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
await p.goto('http://127.0.0.1:5194/demos/solar-system/');
await p.getByTestId('ephemeris-provider-badge').waitFor();
await p.evaluate(async()=>{
for(const [file,cls,key,method] of [
['/src/rendering/DebugSolarSystemRenderer.ts','DebugSolarSystemRenderer','r','setSolarEvolutionRenderState'],
['/src/simulation/scenarios/solar-fate/ScientificSolarEvolutionScenario.ts','ScientificSolarEvolutionScenario','evo','start']]){
const url=performance.getEntriesByType('resource').find(e=>e.name.includes(file)).name;
const m=await import(url),orig=m[cls].prototype[method];m[cls].prototype[method]=function(...args){window[key]=this;return orig.apply(this,args)};
}});
await p.getByTestId('solar-fate-drawer-toggle').click();
await p.getByTestId('solar-evolution-start').click();await p.getByTestId('solar-evolution-pause').click();
await p.getByTestId('solar-fate-stage-present').click();
const results=[];
for(const quality of ['medium','high','ultra','low']){
await p.evaluate(q=>window.r.setVisualQuality(q),quality);
await p.getByTestId('viewport-fullscreen-toggle').click();await p.waitForTimeout(1200);
await p.screenshot({path:out+'/solar-'+quality+'.png'});
results.push(await p.locator('canvas[data-testid="solar-system-canvas"]').evaluate(e=>({...e.dataset})));
await p.getByTestId('viewport-fullscreen-toggle').click();
}
await p.evaluate(()=>window.r.setVisualQuality('high'));
await p.getByTestId('solar-fate-stage-red-giant').click();
await p.evaluate(()=>window.evo.frameStep(4));
await p.waitForTimeout(300);
assert.equal(await p.evaluate(()=>window.r.markers.get('sun').visual.coronaShells.some(s=>s.visible)),false);
await p.getByTestId('solar-evolution-reset').click();
await p.getByTestId('navigator-body-sun').click();
await p.waitForTimeout(1200);
await p.getByTestId('viewport-fullscreen-toggle').click();await p.waitForTimeout(700);
await p.screenshot({path:out+'/observatory.png'});
assert.equal(await p.evaluate(()=>window.r.markers.get('sun').visual.coronaShells.some(s=>s.visible)),true);
assert.deepEqual(errors,[]);
await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));console.log({errors,captures:5});
}finally{await b.close()}
