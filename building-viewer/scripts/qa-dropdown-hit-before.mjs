import {chromium} from 'playwright';
const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1400,height:900}});
await p.addInitScript(()=>sessionStorage.setItem('building-viewer-demo-unlocked','1'));
try{
 await p.goto('http://127.0.0.1:5204/');await p.locator('select[aria-label="Seat LOD"]').waitFor();
 const hits=await p.locator('#viewer-ui select').evaluateAll(ss=>ss.slice(0,4).map(s=>{const r=s.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:s.getAttribute('aria-label'),pointerEvents:getComputedStyle(s).pointerEvents,hit:hit?.tagName,hitId:hit?.id,reachable:hit===s}}));
 console.log(JSON.stringify(hits,null,2));
}finally{await b.close()}
