#!/usr/bin/env node
/**
 * Points demo "← IOM" back links at the homepage *card* (project id).
 * Injects shared /demos/iom-back.js. Safe to re-run.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = join(root, 'public', 'demos')

const SCRIPT_TAG = '<script src="/demos/iom-back.js"></script>'

/** Demo folder slug → homepage project card id (hash). Never music. */
const DEMO_CARD = {
  'streets-gl': 'streets-gl-bridge',
  'panorama-360': 'panorama-360-tour',
  'iom-studio': 'iom-studio',
  'raven-path': 'raven-path',
  'ssr-denoise': 'ssr-denoise',
  'dreams-iom': 'iom-three',
  'volume-lighting': 'volume-lighting',
  ocean: 'threejs-ocean',
  'message-in-a-bottle': 'message-in-a-bottle',
  'fft-ocean': 'fft-ocean',
  'css3d-sprites': 'css3d-sprites',
  'custom-cursor-labelled': 'custom-cursor-labelled',
  'compute-particles': 'compute-particles',
  'webgpu-spotlight': 'webgpu-spotlight',
  'webgpu-compute-birds': 'webgpu-compute-birds',
  'webgpu-parallax-uv': 'webgpu-parallax-uv',
  'webgpu-tsl-raging-sea': 'webgpu-tsl-raging-sea',
  'webgpu-tsl-linked-particles': 'webgpu-tsl-linked-particles',
  'webgpu-tsl-attractors-particles': 'webgpu-tsl-attractors-particles',
  'webgpu-custom-fog-scattering': 'webgpu-custom-fog-scattering',
  'webgpu-modifier-curve': 'webgpu-modifier-curve',
  'webgpu-particles': 'webgpu-particles',
  'buffergeometry-drawrange': 'buffergeometry-drawrange',
  'spline-editor': 'spline-editor',
  'terrain-sandbox': 'terrain-sandbox',
  'procedural-gl': 'procedural-gl',
  spout: 'spout',
  'dj-linked-particles': 'webgpu-tsl-linked-particles',
  'iom-studio-app': 'iom-studio',
}

function setHref(tag, href) {
  if (/\bhref=/i.test(tag)) {
    return tag.replace(/\bhref=(["'])[^"']*\1/i, `href=$1${href}$1`)
  }
  return tag.replace(/<a\b/i, `<a href="${href}"`)
}

function patchBackHrefs(html, cardId) {
  const href = `/#${cardId}`
  let out = html

  out = out.replace(/<a\b[^>]*\b(?:back-link|dream-back-link|intro-logo-link)\b[^>]*>/gi, (tag) =>
    setHref(tag, href),
  )

  out = out.replace(/<a\b([^>]*)>(\s*←\s*(?:IOM|Back to IOM)\s*)<\/a>/gi, (_full, attrs) => {
    const open = setHref(`<a${attrs}>`, href)
    return `${open}← Back to IOM</a>`
  })

  return out
}

function ensureBackScript(html) {
  if (html.includes('/demos/iom-back.js')) return html
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}\n    ${SCRIPT_TAG}`)
  }
  return html.replace(/<\/body>/i, `    ${SCRIPT_TAG}\n  </body>`)
}

/**
 * Panorama SPA used to own ← IOM. We still inject iom-back.js so the
 * start-gate has a Back to IOM control (z-index above the overlay).
 * Strip only legacy duplicate anchors, not the shared script.
 */
function stripPanoramaInjectedBack(html) {
  let out = html
  out = out.replace(
    /\s*<a\b[^>]*\bid=["']iom-back["'][^>]*>\s*←\s*(?:IOM|Back to IOM)\s*<\/a>\s*/gi,
    '\n',
  )
  out = out.replace(
    /\s*<script>\s*\(function\s*\(\)\s*\{\s*var a = document\.getElementById\('iom-back'\);[\s\S]*?<\/script>\s*/gi,
    '\n',
  )
  return out
}

const dirs = readdirSync(demosDir, { withFileTypes: true }).filter((d) => d.isDirectory())
let patched = 0
let skipped = 0

for (const dir of dirs) {
  const slug = dir.name
  const cardId = DEMO_CARD[slug]
  const indexPath = join(demosDir, slug, 'index.html')
  let html
  try {
    html = readFileSync(indexPath, 'utf8')
  } catch {
    skipped++
    continue
  }

  let next = html
  if (slug === 'panorama-360') {
    next = stripPanoramaInjectedBack(next)
  }
  if (cardId) {
    next = patchBackHrefs(next, cardId)
  }
  next = ensureBackScript(next)

  if (next !== html) {
    writeFileSync(indexPath, next, 'utf8')
    console.log(cardId ? `✓ ${slug} → /#${cardId}` : `✓ ${slug} — injected iom-back.js`)
    patched++
  } else {
    console.log(`· ${slug} unchanged`)
    skipped++
  }
}

console.log(`\nUpdated ${patched} demo page(s) (${skipped} unchanged/skipped).`)
