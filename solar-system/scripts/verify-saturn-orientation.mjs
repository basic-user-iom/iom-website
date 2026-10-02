import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const url=process.env.SATURN_REVIEW_URL||'http://127.0.0.1:5194/demos/solar-system/';
const out=process.env.SATURN_REVIEW_OUT||'tmp/saturn-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1800,height:1100},reducedMotion:'reduce'});
const errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const canvas=page.getByTestId('solar-system-canvas');
const attrs=()=>canvas.evaluate(el=>({...el.dataset}));
const distance=async()=>{const d=await attrs();const p=d.cameraPosition.split(',').map(Number),t=d.cameraWorldTarget.split(',').map(Number);return Math.hypot(...p.map((v,i)=>v-t[i]));};
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="solar-system-canvas"]')?.dataset.assetState==='ready',null,{timeout:120000});
  if(await page.locator('vite-error-overlay').count())throw new Error('Vite error overlay');
  if(!(await page.getByTestId('camera-preset-saturn-from-earth').count()))throw new Error('Earth-view button missing');
  await page.screenshot({path:out+'/initial.png'});
  console.log('DEV SERVER VERIFIED',JSON.stringify({url,title:await page.title(),errors}));
  const pause=page.getByRole('button',{name:'Pause simulation',exact:true});if(await pause.isVisible())await pause.click();
  await page.getByTestId('visual-quality-select').selectOption('high');
  await page.getByTestId('navigator-body-saturn').click();
  const clock=page.getByTestId('simulation-time-controls');
  for(const date of ['2025-03-23T12:00','2026-10-02T12:00','2032-06-01T12:00']){
    await clock.locator('input[type="datetime-local"]').first().fill(date);
    await clock.getByRole('button',{name:'Set UTC',exact:true}).click();
    await page.getByTestId('camera-preset-saturn-from-earth').click();
    await page.waitForTimeout(2500);
    await canvas.screenshot({path:out+'/'+date.slice(0,10)+'.png'});
    records.push({date,attributes:await attrs()});console.log('CAPTURE',date,records.at(-1).attributes.currentJdTdb);
  }
  for(const delta of [-200,200]) for(const shift of [false,true]){
    await page.getByTestId('camera-preset-saturn-from-earth').click();await page.waitForTimeout(1000);
    const before=await distance();const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.6);
    if(shift)await page.keyboard.down('Shift');
    await page.mouse.wheel(0,delta);
    if(shift)await page.keyboard.up('Shift');
    await page.waitForTimeout(2000);const after=await distance();
    records.push({zoom:true,shift,delta,before,after,logChange:Math.log(after/before)});console.log('ZOOM',JSON.stringify(records.at(-1)));
  }
  for(const delta of [-200,200]){
    const z=records.filter(r=>r.zoom && r.delta===delta);const multiplier=z[1].logChange/z[0].logChange;
    if(Math.abs(multiplier-4)>0.15)throw new Error('Zoom multiplier '+multiplier+' expected 4');
  }
  await page.getByTestId('camera-preset-saturn-rings').click();await page.waitForTimeout(1500);
  await page.screenshot({path:out+'/inspection-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1500);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  if(layout.scroll>layout.width)throw new Error('Mobile horizontal overflow '+JSON.stringify(layout));
  await page.getByTestId('camera-close-up-presets').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-controls.png'});
  if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
  console.log('PASS: Saturn dates, Shift zoom x4, mobile width, no browser errors');
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}finally{await writeFile(out+'/results.json',JSON.stringify({url,records,errors},null,2));await browser.close();}
