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
  'iom-studio': 'software',
  'raven-path': '3d',
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

/**
 * Panorama SPA owns its ← IOM control. Strip any HTML-injected duplicate
 * left by older patch runs (id=iom-back / body-level .back-link).
 */
function stripPanoramaInjectedBack(html) {
  let out = html
  out = out.replace(
    /\s*<a\b[^>]*\bid=["']iom-back["'][^>]*>\s*←\s*IOM\s*<\/a>\s*/gi,
    '\n',
  )
  out = out.replace(
    /\s*<script>\s*\(function\s*\(\)\s*\{\s*var a = document\.getElementById\('iom-back'\);[\s\S]*?<\/script>\s*/gi,
    '\n',
  )
  // Remove injected .back-link CSS block if present
  out = out.replace(
    /\n\s*\.back-link\s*\{[\s\S]*?\.back-link:hover\s*\{[\s\S]*?\}\s*/i,
    '\n',
  )
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

  const next =
    slug === 'panorama-360' ? stripPanoramaInjectedBack(html) : patchBackHrefs(html, section)

  if (next !== html) {
    writeFileSync(indexPath, next, 'utf8')
    console.log(
      slug === 'panorama-360'
        ? `✓ ${slug} — removed HTML duplicate (app owns ← IOM)`
        : `✓ ${slug} → /#${section}`,
    )
    patched++
  } else {
    console.log(`· ${slug} unchanged`)
    skipped++
  }
}

console.log(`\nUpdated ${patched} demo back link(s) (${skipped} unchanged/skipped).`)
