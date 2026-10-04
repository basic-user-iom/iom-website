/* global HTMLCanvasElement, document, innerWidth, innerHeight */
import{chromium,webkit}from'playwright';import{writeFile,mkdir}from'node:fs/promises';
// WebKit drawing-buffer preservation is a screenshot-only test override.
const baseUrl=process.env.SOLAR_SYSTEM_REVIEW_URL??'http://127.0.0.1:5198/demos/solar-system/';
await mkdir('tmp/learning',{recursive:true});
const rows=[];
for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
 for(const blocked of[false,true])for(const [width,height]of[[1366,768],[768,1024],[360,800],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({blocked,preserve})=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,options){if(type==='webgl2'){if(blocked)return null;if(preserve)options={...options,preserveDrawingBuffer:true}}return original.call(this,type,options)}},{blocked,preserve:name==='webkit'});
  const start=performance.now();await page.goto(baseUrl);
  await page.waitForFunction(()=>{const b=document.querySelector('[data-testid="learn-start"]');return b&&!b.disabled},null,{timeout:90000});
  await page.getByTestId('startup-screen').waitFor({state:'hidden'});const loadMs=performance.now()-start;
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Initial horizontal overflow');
  if(blocked)await page.screenshot({path:`tmp/learning/${name}-fallback-${width}x${height}.png`});
  await page.getByTestId('learn-start').click();await page.getByTestId('learn-sizes').click();await page.getByTestId('lesson-panel').waitFor();
  const issues=()=>page.evaluate(()=>{const panel=document.querySelector('.lesson-panel'),box=panel.getBoundingClientRect();const buttons=[...document.querySelectorAll('.lesson-navigation button,[data-testid="lesson-exit"]')];return{overflow:document.documentElement.scrollWidth>innerWidth,bounds:box.toJSON(),badButtons:buttons.flatMap(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44||r.x<0||r.right>innerWidth+1||r.y<0||r.bottom>innerHeight+1?[{text:b.textContent,rect:r.toJSON()}]:[]}),canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()}});
  let audit=await issues();if(audit.overflow||audit.badButtons.length)throw Error(JSON.stringify({name,blocked,width,height,audit}));
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.waitForTimeout(500);
  await page.screenshot({path:`tmp/learning/${name}-${blocked?'text':'3d'}-${width}x${height}.png`});
  if(name==='webkit'&&!blocked){const encoded=await page.locator('canvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);await writeFile(`tmp/learning/webkit-canvas-${width}x${height}.png`,Buffer.from(encoded,'base64'));}
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByTestId('lesson-answer-0-1').click();await page.getByTestId('lesson-answer-1-0').click();
  await page.getByTestId('viewport-fullscreen-toggle').click();audit=await issues();if(audit.overflow||audit.badButtons.length)throw Error('Fullscreen '+JSON.stringify(audit));
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  await page.getByTestId('lesson-exit').click();await page.getByTestId('lesson-panel').waitFor({state:'hidden'});await page.getByTestId('viewport-fullscreen-toggle').click();
  await page.getByTestId('learn-start').click();await page.getByTestId('learn-sizes').click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();
  await page.setViewportSize({width:width===360?390:width-20,height});audit=await issues();if(audit.overflow||audit.badButtons.length)throw Error('Resize '+JSON.stringify(audit));
  await page.getByTestId('lesson-exit').click();
  const telemetry=await page.locator('canvas').evaluate(c=>({median:c.dataset.performanceMedianFrameMs,p95:c.dataset.performanceP95FrameMs,drawCalls:c.dataset.drawCalls,triangles:c.dataset.renderedTriangles,gpu:c.dataset.gpuGeometries}));
  const row={browser:name,blocked,width,height,loadMs:Math.round(loadMs),preservedDrawingBuffer:name==='webkit',telemetry,errors};rows.push(row);console.log(JSON.stringify(row));if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
 }finally{await browser.close()}
}
await writeFile('tmp/learning/browser-matrix.json',JSON.stringify(rows,null,2));
