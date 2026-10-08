import fs from 'node:fs';
const path='scripts/qa-menu-layout-v9-2.mjs';let s=fs.readFileSync(path,'utf8');
s=s.replace("return{width:innerWidth,height:innerHeight,panels,overlaps,overflow,scrollable:",`const pegman=document.querySelector('.bv-pegman').getBoundingClientRect(),transport=document.querySelector('.bv-transport').getBoundingClientRect();
   const footerOverlap=Math.min(pegman.right,transport.right)>Math.max(pegman.left,transport.left)&&Math.min(pegman.bottom,transport.bottom)>Math.max(pegman.top,transport.top);
   const stackBottom=document.querySelector('.bv-menu-stack')?.getBoundingClientRect().bottom;
   const footerClear=stackBottom<=Math.min(pegman.top,transport.top);
   return{width:innerWidth,height:innerHeight,panels,overlaps,overflow,footerOverlap,footerClear,scrollable:`);
s=s.replace('assert.deepEqual(r.overlaps,[]);assert.deepEqual(r.overflow,[]);','assert.deepEqual(r.overlaps,[]);assert.deepEqual(r.overflow,[]);assert.equal(r.footerOverlap,false);assert.equal(r.footerClear,true);');
fs.writeFileSync(path,s);
