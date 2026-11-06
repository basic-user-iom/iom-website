import assert from 'node:assert/strict'
import fs from 'node:fs'
import {matchesDeployScope,invalidFilesForScope} from './deploy-scope.mjs'
const scope='aqueduct-publication'
const manifest=JSON.parse(fs.readFileSync('docs/AQUEDUCT-PUBLICATION-SCOPE.json','utf8'))
assert.deepEqual(invalidFilesForScope(manifest.files,scope),[])
for(const p of ['api/crm-send-email.js','src/crm/CrmApp.tsx','src/index.css','public/assets/audio/a.mp3','public/demos/roman-aqueduct/index.html','src/seasonal/index.ts'])assert.equal(matchesDeployScope(p,scope),false,p)
assert.equal(matchesDeployScope('src/components/ProjectCard.tsx',scope),true)
const source=fs.readFileSync('scripts/deploy-production.mjs','utf8')
for(const marker of ["const emailEnv", "function writeVerificationAudit", "function deploySnapshot", "function main()"] )assert.ok(source.includes(marker))
const local=source.slice(source.indexOf('function buildSnapshot'),source.indexOf('function demoSlugForScope'))
assert.ok(local.includes("'aqueduct-publication'"));assert.ok(local.includes("IOM_SKIP_BLOG_SYNC: 'true'"))
const remote=source.slice(source.indexOf('function deploySnapshot'),source.indexOf('function main()'))
assert.ok(remote.includes("'aqueduct-publication'"));assert.ok(remote.includes("'IOM_SKIP_BLOG_SYNC=true'"))
assert.match(source,/verifyOnly \|\|[^\n]+aqueduct-publication[^\n]+\? \['--verify-only'\]/)
assert.ok(source.includes("scope === 'aqueduct-publication' ? 'aqueduct-verification'"))
console.log('PASS: exact aqueduct scope, unrelated/CRM exclusions, local+remote blog sync disabled, R2 read-only and isolated audit output.')
