import fs from 'node:fs';
const path='src/main.ts';let s=fs.readFileSync(path,'utf8');
s=s.replace("      if (p.stage === 'ready') loading.hide()", "      if (p.stage === 'ready') {\n        // Model loads reset controller defaults; keep the selected pace in sync.\n        engine.controller.params.walkSpeed = Number(pace.value)\n        loading.hide()\n      }");fs.writeFileSync(path,s);
const qa='scripts/qa-dropdown-access-v9-1.mjs';s=fs.readFileSync(qa,'utf8');s=s.replace("assert.ok(hits.every(h=>h.reachable&&h.pointerEvents==='auto'));", "assert.ok(hits.every(h=>h.reachable&&h.pointerEvents==='auto'));\n assert.equal(await p.evaluate(()=>window.__iomBuildingViewer.controller.params.walkSpeed),1.6);");fs.writeFileSync(qa,s);
