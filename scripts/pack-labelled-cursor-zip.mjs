/**
 * Rebuild public/demos/custom-cursor-labelled/labelled-custom-cursor.zip
 * from the live demo + parked React module snapshot.
 *
 *   node scripts/pack-labelled-cursor-zip.mjs
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demoDir = join(root, 'public/demos/custom-cursor-labelled')
const parkedDir = join(root, 'parked/custom-cursor-labelled-v1')
const zipPath = join(demoDir, 'labelled-custom-cursor.zip')
const stage = join(tmpdir(), `labelled-custom-cursor-pack-${Date.now()}`)
const packRoot = join(stage, 'labelled-custom-cursor')

const readme = `# Labelled custom cursor — complete code pack

IOM experiment: precision tip + inertial ring with labelled modes
(VIEW, PLAY, LOOK, EXPLORE / ENTER 3D, START, DRAG, …).

## Contents

- \`demo/\` — standalone lab (open via a local static server)
- \`react-module/\` — parked React/TypeScript module snapshot (labelled v1)

## Live

- Lab: https://iobjectm.com/demos/custom-cursor-labelled/
- Case study: https://iobjectm.com/case-studies/labelled-custom-cursor/

## Quick start (demo)

\`\`\`bash
npx serve demo
\`\`\`

Hover playground targets; the usage panel updates to the active \`data-cursor\` mode.

## Markup

\`\`\`html
<a href="/path" data-cursor="explore" data-cursor-label="ENTER 3D">Enter</a>
<article data-cursor="view">…</article>
<button type="button" data-cursor="play">Play</button>
\`\`\`

Modes: \`view | play | pause | explore | look | drag | start | external | link | native\`

## License note

Code from Interactive Object Media (iobjectm.com). Use as reference for your own projects;
keep attribution if you redistribute the pack.
`

mkdirSync(join(packRoot, 'demo'), { recursive: true })
mkdirSync(join(packRoot, 'react-module'), { recursive: true })
for (const name of ['index.html', 'labelled-cursor.css', 'labelled-cursor.js']) {
  cpSync(join(demoDir, name), join(packRoot, 'demo', name))
}
cpSync(parkedDir, join(packRoot, 'react-module'), { recursive: true })
writeFileSync(join(packRoot, 'README.md'), readme, 'utf8')

if (existsSync(zipPath)) rmSync(zipPath)

// Prefer PowerShell Compress-Archive on Windows; fall back to tar if available.
try {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${packRoot.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' },
  )
} catch {
  execFileSync('tar', ['-a', '-cf', zipPath, '-C', stage, 'labelled-custom-cursor'], {
    stdio: 'inherit',
  })
}

rmSync(stage, { recursive: true, force: true })
console.log(`✓ ${zipPath}`)
