#!/usr/bin/env node
/**
 * Points demo "← IOM" back links at the homepage section where the card lives.
 * Safe to re-run. Also injects a back link into panorama-360 when missing.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = join(root, 'public', 'demos')

/** Demo folder slug → homepage section id */
const DEMO_SECTION = {
  'streets-gl': 'software',
  'panorama-360': 'software',
  'raven-path': 'software',
  'ssr-denoise': '3d',
  'dreams-iom': '3d',
  'volume-lighting': '3d',
  ocean: '3d',
  'fft-ocean': '3d',
  'css3d-sprites': 'experiments',
  'compute-particles': 'experiments',
  'webgpu-spotlight': 'experiments',
  'webgpu-compute-birds': 'experiments',
  'webgpu-parallax-uv': 'experiments',
  'webgpu-tsl-raging-sea': 'experiments',
  'webgpu-tsl-linked-particles': 'experiments',
  'webgpu-custom-fog-scattering': 'experiments',
  'webgpu-modifier-curve': 'experiments',
  'webgpu-particles': 'experiments',
  'buffergeometry-drawrange': 'experiments',
  'spline-editor': 'experiments',
  'terrain-sandbox': 'experiments',
  'procedural-gl': 'experiments',
  spout: 'experiments',
}

const BACK_STYLE = `
      .back-link {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 10050;
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        font: 13px/1.2 system-ui, -apple-system, sans-serif;
        letter-spacing: 0.04em;
        padding: 6px 10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(6px);
      }
      .back-link:hover {
        color: #fff;
        border-color: rgba(255, 255, 255, 0.45);
      }`

const PANORAMA_SCRIPT = `
    <script>
      (function () {
        var a = document.getElementById('iom-back');
        if (!a) return;
        if (/[?&]mode=preview(?:&|$)/.test(location.search)) a.href = '/#360';
      })();
    </script>`

function setHref(tag, href) {
  if (/\bhref=/i.test(tag)) {
    return tag.replace(/\bhref=(["'])[^"']*\1/i, `href=$1${href}$1`)
  }
  return tag.replace(/<a\b/i, `<a href="${href}"`)
}

function patchBackHrefs(html, section) {
  const href = `/#${section}`
  let out = html

  // Opening <a> tags that carry a back-link class
  out = out.replace(/<a\b[^>]*\b(?:back-link|dream-back-link|intro-logo-link)\b[^>]*>/gi, (tag) =>
    setHref(tag, href),
  )

  // Any remaining "← IOM" / "← Back to IOM" anchors
  out = out.replace(/<a\b([^>]*)>(\s*←\s*(?:IOM|Back to IOM)\s*)<\/a>/gi, (_full, attrs, label) => {
    const open = setHref(`<a${attrs}>`, href)
    return `${open}${label}</a>`
  })

  return out
}

function ensurePanoramaBack(html) {
  if (/id=["']iom-back["']/.test(html) || /\bclass=["'][^"']*\bback-link\b/.test(html)) {
    return patchBackHrefs(html, 'software')
  }

  let out = html
  if (!/\.back-link\s*\{/.test(out)) {
    out = out.replace(/<\/style>/i, `${BACK_STYLE}\n    </style>`)
  }

  const link = `<a class="back-link" id="iom-back" href="/#software" aria-label="Back to Software section">← IOM</a>`
  if (/<div id="root"><\/div>/i.test(out)) {
    out = out.replace(
      /<div id="root"><\/div>/i,
      `${link}\n    <div id="root"></div>${PANORAMA_SCRIPT}`,
    )
  } else {
    out = out.replace(/<body([^>]*)>/i, `<body$1>\n    ${link}${PANORAMA_SCRIPT}`)
  }

  return out
}

const dirs = readdirSync(demosDir, { withFileTypes: true }).filter((d) => d.isDirectory())
let patched = 0
let skipped = 0

for (const dir of dirs) {
  const slug = dir.name
  const section = DEMO_SECTION[slug]
  const indexPath = join(demosDir, slug, 'index.html')
  let html
  try {
    html = readFileSync(indexPath, 'utf8')
  } catch {
    skipped++
    continue
  }

  if (!section) {
    console.warn(`⚠ No section map for ${slug} — skipped`)
    skipped++
    continue
  }

  const next = slug === 'panorama-360' ? ensurePanoramaBack(html) : patchBackHrefs(html, section)

  if (next !== html) {
    writeFileSync(indexPath, next, 'utf8')
    console.log(`✓ ${slug} → /#${section}`)
    patched++
  } else {
    console.log(`· ${slug} unchanged`)
    skipped++
  }
}

console.log(`\nUpdated ${patched} demo back link(s) (${skipped} unchanged/skipped).`)
