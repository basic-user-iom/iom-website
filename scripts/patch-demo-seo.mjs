#!/usr/bin/env node
/**
 * Injects title, description, canonical, and Open Graph tags into public/demos index HTML files.
 * Safe to re-run — replaces any previous iom-seo block.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = join(root, 'public', 'demos')
const ORIGIN = 'https://iobjectm.com'
const MARKER_START = '<!-- iom-seo -->'
const MARKER_END = '<!-- /iom-seo -->'

/** @type {Record<string, { title: string; description: string }>} */
const DEMO_SEO = {
  'panorama-360': {
    title: '360° Virtual Tour Editor — IOM',
    description:
      'Free browser 360° virtual tour editor — load equirectangular panoramas, place hotspots, build multi-scene tours, and add WebGPU effects. By Interactive Object Media.',
  },
  'streets-gl': {
    title: 'OpenStreetMap 3D Buildings Viewer — Streets GL — IOM',
    description:
      'OpenStreetMap 3D buildings, roads, and terrain in the browser — Streets GL bridge for geolocated model presentation. Interactive Object Media.',
  },
  'ssr-denoise': {
    title: 'WebGPU SSR + Denoise — Real-time Reflections — IOM',
    description:
      'WebGPU real-time rendering demo: screen-space reflections with spatiotemporal denoise on Three.js. Load models, swap HDRI, walk the gallery. IOM.',
  },
  'raven-path': {
    title: 'Raven Path Animation — WebGPU Curve — IOM',
    description:
      'Animated raven flight along editable spline paths with WebGPU curve modifier. Interactive Object Media experiment.',
  },
  'spline-editor': {
    title: 'Catmull Spline Editor — IOM',
    description:
      'Interactive Catmull-Rom spline path editor for 3D animation and WebGPU curve workflows. Interactive Object Media.',
  },
  'volume-lighting': {
    title: 'WebGPU Volumetric Lighting — Rect Area — IOM',
    description:
      'WebGPU volumetric lighting with rect area lights — import GLB/GLTF/FBX, move lights, record camera views. Interactive Object Media.',
  },
  ocean: {
    title: 'Three.js Ocean Shader — IOM',
    description:
      'Gerstner-wave ocean with procedural sky, glass 3D text, and WebGL export — Three.js water shader demo by IOM.',
  },
  'fft-ocean': {
    title: 'FFT Ocean — Real-time Water — IOM',
    description:
      'FFT-based real-time ocean simulation with WebGL — interactive water surface experiment by Interactive Object Media.',
  },
  'css3d-sprites': {
    title: 'CSS3D Sprites — Three.js Experiment — IOM',
    description:
      '512 HTML sprites in 3D space with CSS3DRenderer — morph between plane, cube, cloud, and sphere. Interactive Object Media.',
  },
  'compute-particles': {
    title: 'WebGPU Compute Shape Particles — IOM',
    description:
      'WebGPU real-time rendering: GPU compute particles form cube, sphere, torus, and more — release under gravity. Interactive Object Media.',
  },
  'webgpu-spotlight': {
    title: 'WebGPU Spotlight Shadows — IOM',
    description:
      'WebGPU real-time spotlight with textured projection, penumbra, and shadows — Three.js WebGPU lighting demo by IOM.',
  },
  'webgpu-compute-birds': {
    title: 'WebGPU Compute Birds Flock — IOM',
    description:
      'WebGPU compute shader bird flock simulation — real-time GPU flocking demo by Interactive Object Media.',
  },
  'webgpu-parallax-uv': {
    title: 'WebGPU Parallax UV Mapping — IOM',
    description:
      'WebGPU parallax UV mapping experiment — real-time depth illusion on textured surfaces. Interactive Object Media.',
  },
  'webgpu-tsl-raging-sea': {
    title: 'WebGPU TSL Raging Sea — IOM',
    description:
      'WebGPU real-time raging sea with Three.js TSL shaders — interactive ocean experiment by Interactive Object Media.',
  },
  'webgpu-tsl-linked-particles': {
    title: 'WebGPU TSL Linked Particles — IOM',
    description:
      'WebGPU TSL linked particle VFX — real-time connected particle system by Interactive Object Media.',
  },
  'webgpu-custom-fog-scattering': {
    title: 'WebGPU Custom Fog Scattering — IOM',
    description:
      'WebGPU custom fog scattering shader — atmospheric real-time rendering experiment by Interactive Object Media.',
  },
  'webgpu-modifier-curve': {
    title: 'WebGPU Curve Modifier — IOM',
    description:
      'WebGPU curve modifier for deforming meshes along paths — real-time geometry experiment by Interactive Object Media.',
  },
  'webgpu-particles': {
    title: 'WebGPU Particles — IOM',
    description:
      'WebGPU real-time particle system demo — GPU-driven particles in the browser. Interactive Object Media.',
  },
  'buffergeometry-drawrange': {
    title: 'BufferGeometry Draw Range — IOM',
    description:
      'Three.js BufferGeometry draw range animation — interactive mesh generation experiment by Interactive Object Media.',
  },
  'terrain-sandbox': {
    title: 'Procedural Terrain Sandbox — IOM',
    description:
      'Procedural 3D terrain from layered noise — place trees, rocks, and markers. Interactive Object Media sandbox.',
  },
  'procedural-gl': {
    title: 'Procedural GL Terrain — IOM',
    description:
      'Procedural WebGL terrain generation — interactive landscape experiment by Interactive Object Media.',
  },
  spout: {
    title: 'Spout Shader — IOM',
    description:
      'Spout raymarching shader demo in the browser — creative WebGL experiment by Interactive Object Media.',
  },
}

function seoBlock(slug, title, description) {
  const url = `${ORIGIN}/demos/${slug}/`
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return `${MARKER_START}
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="IOM — Interactive Object Media" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ORIGIN}/og-image.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ORIGIN}/og-image.svg" />
    ${MARKER_END}`
}

function patchHtml(html, slug, title, description) {
  // Remove previous SEO block
  let out = html.replace(
    new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\s*`, 'g'),
    '',
  )

  // Update or insert title
  if (/<title>[^<]*<\/title>/i.test(out)) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  } else {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n    <title>${title}</title>`)
  }

  const block = seoBlock(slug, title, description)

  // Insert after <title>…</title>
  if (/<\/title>/i.test(out)) {
    out = out.replace(/<\/title>/i, `</title>\n${block}`)
  } else {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n${block}`)
  }

  return out
}

const dirs = readdirSync(demosDir, { withFileTypes: true }).filter((d) => d.isDirectory())
let patched = 0
let skipped = 0

for (const dir of dirs) {
  const slug = dir.name
  const meta = DEMO_SEO[slug]
  const indexPath = join(demosDir, slug, 'index.html')
  try {
    readFileSync(indexPath)
  } catch {
    skipped++
    continue
  }
  if (!meta) {
    console.warn(`⚠ No SEO map for ${slug} — skipped`)
    skipped++
    continue
  }
  const html = readFileSync(indexPath, 'utf8')
  writeFileSync(indexPath, patchHtml(html, slug, meta.title, meta.description), 'utf8')
  console.log(`✓ ${slug}`)
  patched++
}

console.log(`\nPatched ${patched} demo pages (${skipped} skipped).`)
