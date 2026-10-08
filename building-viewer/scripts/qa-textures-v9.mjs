import fs from 'node:fs';
import {chromium} from 'playwright';
const outDir='../../evidence/textures-v9'; fs.mkdirSync(outDir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try {
 await page.goto('http://127.0.0.1:5204/');
 await page.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 const info=await page.evaluate(()=>{const v=window.__iomBuildingViewer;v.modelAnim.stop();v.orbit.setEnabled(false);return{quality:v.quality,near:v.camera.near,far:v.camera.far,sun:v.lighting.sun.shadow.toJSON(),layers:v.models.listLayers().map(l=>({id:l.id,visible:l.root.visible})),label:document.body.innerText.slice(0,900)}});fs.writeFileSync(outDir+'/initial.json',JSON.stringify(info,null,2));
 for(const [name,pos,target] of [['foyer-east',[-60,8.5,-28],[-60,7,-5]],['foyer-west',[-86,8.5,-24],[-86,7,0]],['foyer-north',[-78,8.5,22],[-50,7,22]]]) {
  await page.evaluate(({pos,target})=>{const v=window.__iomBuildingViewer;v.camera.position.set(...pos);v.orbit.controls.target.set(...target);v.camera.lookAt(v.orbit.controls.target);v.camera.updateMatrixWorld(true)},{pos,target});
  await page.waitForTimeout(400);await page.screenshot({path:outDir+'/'+name+'-before.png'});
  await page.evaluate(()=>{window.__iomBuildingViewer.renderer.shadowMap.enabled=false});await page.waitForTimeout(250);await page.screenshot({path:outDir+'/'+name+'-no-shadows.png'});
  await page.evaluate(()=>{const v=window.__iomBuildingViewer;v.renderer.shadowMap.enabled=true;v.models.listLayers().find(l=>l.id==='icm-ext').root.visible=false});await page.waitForTimeout(250);await page.screenshot({path:outDir+'/'+name+'-no-exterior.png'});
  await page.evaluate(()=>{window.__iomBuildingViewer.models.listLayers().find(l=>l.id==='icm-ext').root.visible=true});
 }
 fs.writeFileSync(outDir+'/errors.json',JSON.stringify(errors));console.log('screenshots ready',errors);
}finally{await browser.close()}
