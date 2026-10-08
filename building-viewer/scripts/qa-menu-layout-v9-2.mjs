import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';
const dir='../../evidence/menu-layout-v9-2';fs.mkdirSync(dir,{recursive:true});
const built=process.argv.includes('--built'),before=process.argv.includes('--before'),tag=before?'before':built?'built':'dev';
const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1322,height:800}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{
 await p.goto(built||before?'http://127.0.0.1:5204/demos/icm-building/index.html':'http://127.0.0.1:5204/');
 await p.waitForFunction(()=>document.querySelector('.bv-loading')?.classList.contains('hidden')&&!window.__iomBuildingViewer.orbit.isAnimating(),{},{timeout:180000});
 await p.evaluate(()=>window.__iomBuildingViewer.cancelThumbnailTask());
 await p.getByLabel('Review location',{exact:true}).selectOption('15');
 const results=[];
 const sizes=before?[[1322,800]]:[[1600,900],[1322,800],[1280,720],[1024,768],[900,700],[768,1024],[560,800],[390,844],[320,640],[844,390]];
 for(const[width,height]of sizes){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  const r=await p.evaluate(()=>{
   const panels=['.bv-top','.bv-review-toolbar','.bv-layers-rail','.bv-views-rail','.bv-inspect-rail','.bv-stats-cluster'].flatMap(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return !e.hidden&&r.width&&r.height?[{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}]:[]});
   const overlaps=[];for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){const a=panels[i],b=panels[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5)overlaps.push([a.selector,b.selector])}
   const overflow=panels.filter(r=>r.x<0||r.right>innerWidth+.5);
   const pegman=document.querySelector('.bv-pegman').getBoundingClientRect(),transport=document.querySelector('.bv-transport').getBoundingClientRect();
   const footerOverlap=Math.min(pegman.right,transport.right)>Math.max(pegman.left,transport.left)&&Math.min(pegman.bottom,transport.bottom)>Math.max(pegman.top,transport.top);
   const stackBottom=document.querySelector('.bv-menu-stack')?.getBoundingClientRect().bottom;
   const footerClear=stackBottom<=Math.min(pegman.top,transport.top);
   return{width:innerWidth,height:innerHeight,panels,overlaps,overflow,footerOverlap,footerClear,scrollable:document.querySelector('.bv-menu-stack')?.scrollHeight>document.querySelector('.bv-menu-stack')?.clientHeight};
  });results.push(r);console.log(width,height,'overlap',r.overlaps,'overflow',r.overflow.length,'scrollable',r.scrollable);
  if(!before){assert.deepEqual(r.overlaps,[]);assert.deepEqual(r.overflow,[]);assert.equal(r.footerOverlap,false);assert.equal(r.footerClear,true);}
  if([1322,390,844].includes(width))await p.screenshot({path:`${dir}/${tag}-${width}x${height}.png`});
 }
 if(before)assert.ok(results[0].overlaps.length>0);
 else{
  // In a short window, the menus must be scrollable with a physical wheel gesture.
  await p.locator('.bv-review-title').scrollIntoViewIfNeeded();await p.locator('.bv-review-title').hover();
  const start=await p.locator('.bv-menu-stack').evaluate(e=>e.scrollTop);await p.mouse.wheel(0,350);await p.waitForTimeout(150);
  const end=await p.locator('.bv-menu-stack').evaluate(e=>e.scrollTop);assert.ok(end>start,`Menu wheel scrolling failed: ${start} -> ${end}`);
  // All review menus remain reachable with actual clicks even when scrolled.
  const options=[];
  for(const label of ['Seat LOD','Foot placement','Walking speed','Review location']){
   const select=p.getByLabel(label,{exact:true});await select.click();await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
   assert.equal(await p.evaluate(()=>document.activeElement?.getAttribute('aria-label')),label);
   options.push({label,value:await select.inputValue()});
  }
  await p.setViewportSize({width:1322,height:800});
  await p.getByLabel('Review location',{exact:true}).click();await p.keyboard.press('End');await p.keyboard.press('Enter');
  await p.getByRole('button',{name:'Inspect',exact:true}).click();await p.locator('.bv-fps-chip').click();
  const panelsExpanded=await p.evaluate(()=>{const ss=['.bv-layers-rail','.bv-views-rail','.bv-inspect-rail','.bv-stats-cluster'];const rs=ss.map(s=>({s,r:document.querySelector(s).getBoundingClientRect()}));const overlaps=[];for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i].r,b=rs[j].r;if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))overlaps.push([rs[i].s,rs[j].s])}return overlaps});assert.deepEqual(panelsExpanded,[]);
  await p.screenshot({path:`${dir}/${tag}-expanded.png`});
  await p.getByRole('button',{name:'Inspect',exact:true}).click();await p.locator('.bv-fps-chip').click();
  await p.locator('.bv-menu-stack').evaluate(e=>e.scrollTop=0);
  await p.screenshot({path:`${dir}/${tag}-final.png`});
  results.push({wheelScroll:{start,end},options,panelsExpanded});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/${tag}.json`,JSON.stringify({results,errors},null,2));
}finally{await b.close()}
