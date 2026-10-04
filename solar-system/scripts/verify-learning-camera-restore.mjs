/* global document */
import{chromium,webkit}from'playwright';import assert from'node:assert/strict';import{writeFile,mkdir}from'node:fs/promises';
await mkdir('tmp/learning',{recursive:true});
const rows=[];
for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});await page.goto(process.env.SOLAR_SYSTEM_REVIEW_URL ?? 'http://127.0.0.1:5198/demos/solar-system/');await page.getByTestId('startup-screen').waitFor({state:'hidden',timeout:90000});
 const canvas=page.getByTestId('solar-system-canvas');
 const capture=()=>canvas.evaluate(c=>({preset:c.dataset.closeUpPreset,mode:c.dataset.cameraMode,target:c.dataset.cameraTarget,position:c.dataset.cameraPosition,worldTarget:c.dataset.cameraWorldTarget,spaceObject:c.dataset.spaceObjectDetailedInspection,moon:c.dataset.naturalSatelliteSelected,layers:[...document.querySelectorAll('.layer-controls input')].map(i=>[i.parentElement.textContent.trim(),i.checked])}));
 for(const mode of['saturn-from-earth','earth-moon-system','free-orbit','voyager-1','io'])for(const lesson of['sizes','seasons','moon']){
 if(mode==='saturn-from-earth')await page.getByTestId('camera-preset-saturn-from-earth').click();
 else if(mode==='earth-moon-system')await page.getByTestId('camera-earth-moon-system').click();
 else if(mode==='voyager-1'||mode==='io'){await page.locator('#body-search').fill(mode==='io'?'Io':'Voyager 1');await page.getByTestId('navigator-catalog-'+(mode==='io'?'natural-satellite-io':'spacecraft-voyager-1')).click();}
 else{await page.getByTestId('camera-mode-select').selectOption('free-orbit');const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+60,b.y+b.height*.5+25,{steps:6});await page.mouse.up();await page.keyboard.down('Shift');await page.mouse.wheel(0,-100);await page.keyboard.up('Shift');}
 await page.waitForTimeout(700);const before=await capture();
 await page.getByTestId('learn-start').focus();await page.keyboard.press('Enter');await page.getByTestId('learn-'+lesson).focus();await page.keyboard.press('Enter');await page.getByTestId('lesson-panel').waitFor();
 await page.getByRole('button',{name:'Next',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.getByTestId('lesson-step-title').evaluate(el=>el===document.activeElement),true);
 await page.getByTestId('lesson-exit').focus();await page.keyboard.press('Enter');await page.waitForTimeout(700);const after=await capture();assert.deepEqual(after,before);
 assert.equal(await page.getByTestId('learn-start').evaluate(el=>el===document.activeElement),true);rows.push({browser:name,mode,lesson,before,after});console.log(name,mode,lesson,'restored; keyboard focus passed');
 }
 await page.close();
 }finally{await browser.close()}
}
await writeFile('tmp/learning/preset-restore.json',JSON.stringify(rows,null,2));
