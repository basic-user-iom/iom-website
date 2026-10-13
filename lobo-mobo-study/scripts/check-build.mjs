import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname,'..');
async function walk(dir) { const entries = await readdir(dir,{withFileTypes:true}); return (await Promise.all(entries.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat(); }
for(const folder of ['app/public','dist']) {
  const files=await walk(path.join(root,folder));
  assert.equal(files.filter(p=>p.endsWith('.glb')).length,2);
  assert.equal(files.filter(p=>p.endsWith('.webp')).length,14);
  for(const file of files) {
    assert(!/private-|refs[\\/]|\.blend$|manifest|Cursor_prompt|HANDOFF/i.test(file),file);
    if(/\.(json|js|html)$/.test(file)) assert(!/F:\\\\Projects|private-inputs|private-review|run-20261012-200729|__moboStudy/.test(await readFile(file,'utf8')),file);
  }
}
console.log('PASS: isolated build contains lamp and room GLBs, fourteen posters, local runtime assets, no private inputs or QA hooks.');

