import { test, expect, type Page, type CDPSession } from '@playwright/test';
test.use({hasTouch:true, video:'off'});
for(const [width,height,scale] of [[390,844,'True scale'],[844,390,'True scale'],[667,320,'Presentation']] as const){

test(`pinch after overview stays centred at ${width}x${height} in ${scale}`, async({page,browserName,context},info)=>{
 test.setTimeout(180000);
 await page.emulateMedia({reducedMotion:'reduce'});
 // WebKit's automation has no native multi-touch dispatch. Exercise the same
 // PointerEvent listeners there; Chromium below uses browser-dispatched touches.
 if(browserName==='webkit')await page.addInitScript(()=>{const set=Element.prototype.setPointerCapture,release=Element.prototype.releasePointerCapture;Element.prototype.setPointerCapture=function(id){if(id<900)set.call(this,id);};Element.prototype.releasePointerCapture=function(id){if(id<900)release.call(this,id);};});
 await page.goto('./');await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:90000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=browserName==='chromium'?await context.newCDPSession(page):null;
 const canvas=page.getByTestId('solar-system-canvas');
 const pose=()=>canvas.evaluate(c=>{const p=c.dataset.cameraPosition!.split(',').map(Number),t=c.dataset.cameraWorldTarget!.split(',').map(Number);return{distance:Math.hypot(...p.map((v,i)=>v-t[i]!)),x:Number(c.dataset.selectedScreenX)/c.clientWidth,y:Number(c.dataset.selectedScreenY)/c.clientHeight};});
  await page.setViewportSize({width,height});await page.locator('#toggle-view').click();await page.getByTestId('render-scale-controls').getByRole('button',{name:scale,exact:true}).click();await page.getByRole('button',{name:'Close view',exact:true}).click();
  await page.getByTestId('planets-menu-toggle').click();await page.getByTestId('legend-body-sun').click();await page.getByTestId('system-overview').click();await page.waitForTimeout(650);const before=await pose();
  for(let i=0;i<5;i++){
   await pinch(page,cdp,false,i===0);const p=await pose();expect(p.x).toBeCloseTo(.5,2);expect(p.y).toBeCloseTo(.5,2);await expect(canvas).toHaveAttribute('data-camera-target','sun');
  }
  const close=await pose();expect(close.distance/before.distance).toBeLessThan(.01);
  await page.screenshot({path:info.outputPath(`pinch-${width}.png`)});
  for(let i=0;i<3;i++)await pinch(page,cdp,true,false);expect((await pose()).distance).toBeGreaterThan(close.distance*8);
  await page.getByTestId('system-overview').click();await page.waitForTimeout(350);expect((await pose()).distance).toBeGreaterThan(before.distance*.95);
 // A label still selects via touch and keyboard after capture is moved to the frame.
 await page.getByTestId('body-label-sun').tap();await expect(canvas).toHaveAttribute('data-camera-target','sun');
 expect(errors).toEqual([]);
});
}

async function pinch(page:Page,cdp:CDPSession|null,reverse:boolean,overLabel:boolean){
 const box=(await page.getByTestId('solar-system-canvas').boundingBox())!;
 const label=overLabel?await page.getByTestId('body-label-sun').boundingBox():null;
 const cx=label?Math.min(box.x+box.width-100,label.x+label.width/2+20):box.x+box.width*.55;
 const cy=label?label.y+label.height/2:box.y+box.height*.43;
 const points=(t:number)=>{const s=reverse?85-t*65:20+t*65;return[{x:cx-s+t*9,y:cy,id:900},{x:cx+s+t*9,y:cy+5*t,id:901}];};
 const emit=async(type:'touchStart'|'touchMove'|'touchEnd',t:number)=>{
  const ps=points(t);
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:ps});return;}
  await page.evaluate(({type,ps})=>{const frame=document.querySelector('.observatory-canvas-frame')!;for(const [i,p]of ps.entries()){const target=type==='touchStart'?document.elementFromPoint(p.x,p.y)!:frame;target.dispatchEvent(new PointerEvent(type==='touchStart'?'pointerdown':type==='touchEnd'?'pointerup':'pointermove',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:p.id,isPrimary:i===0,button:0,buttons:type==='touchEnd'?0:1,clientX:p.x,clientY:p.y}));}}, {type,ps});
 };
 await emit('touchStart',0);for(let i=1;i<=6;i++){await emit('touchMove',i/6);}await emit('touchEnd',1);await page.waitForTimeout(80);
}

test('mouse orbit, right-drag pan and Shift wheel still work on the shared scene frame', async ({page,browserName}) => {
 test.skip(browserName !== 'chromium', 'Native wheel input is unavailable in mobile WebKit automation.');
 test.setTimeout(90000);
 await page.setViewportSize({width:1366,height:768});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('./');await expect(page.getByTestId('startup-screen')).toBeHidden({timeout:60000});
 await page.getByTestId('navigator-body-sun').click();await page.getByTestId('system-overview').click();
 const canvas=page.getByTestId('solar-system-canvas');
 const pose=()=>canvas.evaluate(c=>{const p=c.dataset.cameraPosition!.split(',').map(Number),t=c.dataset.cameraWorldTarget!.split(',').map(Number);return{distance:Math.hypot(...p.map((v,i)=>v-t[i]!)),position:c.dataset.cameraPosition,target:c.dataset.cameraWorldTarget};});
 const label=page.getByTestId('body-label-sun');await label.hover();const start=await pose();
 await page.mouse.wheel(0,-120);await page.waitForTimeout(250);const normal=await pose();
 await page.keyboard.down('Shift');await page.mouse.wheel(0,-120);await page.keyboard.up('Shift');await page.waitForTimeout(250);const fast=await pose();
 expect(normal.distance).toBeLessThan(start.distance);expect(Math.log(normal.distance/fast.distance)).toBeGreaterThan(Math.log(start.distance/normal.distance)*2);
 const box=(await canvas.boundingBox())!;const x=box.x+box.width*.25,y=box.y+box.height*.3;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+30,{steps:6});await page.mouse.up();
 await expect.poll(async()=>(await pose()).position).not.toBe(fast.position);
 const beforePan=await pose();await page.mouse.down({button:'right'});await page.mouse.move(x+120,y+40,{steps:6});await page.mouse.up({button:'right'});
 await expect.poll(async()=>(await pose()).target).not.toBe(beforePan.target);
 await expect(canvas).toHaveAttribute('data-camera-target','sun');
});
