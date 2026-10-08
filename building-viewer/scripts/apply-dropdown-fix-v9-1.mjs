import fs from 'node:fs';
const main='src/main.ts',css='src/ui/styles.css';
let s=fs.readFileSync(main,'utf8');
if(!s.includes("  const review = document.createElement('div')"))throw Error('review missing');
s=s.replace("  const review = document.createElement('div')", "  const review = document.createElement('div')\n  review.className = 'bv-review-toolbar'").replace('Blender v9 - floors and stairs','Blender v9.1 - floors and stairs');
fs.writeFileSync(main,s);
s=fs.readFileSync(css,'utf8');if(!s.includes('.bv-top,'))throw Error('selectors missing');
s=s.replace('.bv-top,','.bv-top,\n.bv-review-toolbar,');fs.writeFileSync(css,s);
