import fs from 'node:fs';import {chromium} from 'playwright';
const out='../../evidence/textures-v9';const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{await page.goto('http://127.0.0.1:5204/');await page.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
console.log(await page.evaluate(()=>{const v=window.__iomBuildingViewer;v.modelAnim.stop();v.orbit.setEnabled(false);v.camera.position.set(-60,8.5,-28);v.orbit.controls.target.set(-60,7,-5);v.camera.lookAt(v.orbit.controls.target);return {sun:v.lighting.sun.position.toArray(),target:v.lighting.sun.target.position.toArray()}}));
for(const bias of [-.0003,-.0006,-.0012]){await page.evaluate(bias=>{window.__iomBuildingViewer.lighting.sun.shadow.bias=bias},bias);await page.waitForTimeout(500);await page.screenshot({path:out+'/bias-'+String(bias)+'.png'})}
}finally{await browser.close()}
