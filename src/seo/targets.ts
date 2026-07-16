import { PROJECTS, SECTIONS } from '../data/projects'
import type { SeoTarget } from './types'

/**
 * Keyword / topic targets derived from site content.
 * Extend this file when adding projects or new landing sections.
 */
export const SEO_TARGETS: SeoTarget[] = [
  {
    id: 'brand-iom',
    phrase: 'Interactive Object Media',
    intent: 'brand',
    pages: ['/'],
    priority: 'high',
    notes: 'Primary brand term — homepage H1 and title.',
  },
  {
    id: 'product-3d-viewer',
    phrase: 'browser 3D model viewer',
    intent: 'product',
    pages: ['/', 'https://3dbviewer.com/'],
    priority: 'high',
    notes: 'Featured product — GLTF, FBX, path tracing.',
  },
  {
    id: 'product-panorama-tour',
    phrase: '360 virtual tour editor',
    intent: 'product',
    pages: ['/demos/panorama-360/'],
    priority: 'high',
  },
  {
    id: 'topic-webgpu',
    phrase: 'WebGPU real-time rendering',
    intent: 'topic',
    pages: ['/#experiments'],
    priority: 'high',
    notes: 'Multiple WebGPU demos — strong technical differentiator.',
  },
  {
    id: 'topic-threejs',
    phrase: 'Three.js interactive experiences',
    intent: 'topic',
    pages: ['/#3d', '/#experiments'],
    priority: 'medium',
  },
  {
    id: 'topic-360-architecture',
    phrase: '360 panorama architecture tour',
    intent: 'long-tail',
    pages: ['/#360', '/demos/panorama-360/'],
    priority: 'medium',
  },
  {
    id: 'topic-osm-3d',
    phrase: 'OpenStreetMap 3D buildings viewer',
    intent: 'long-tail',
    pages: ['/demos/streets-gl/'],
    priority: 'medium',
  },
  {
    id: 'topic-ssr-denoise',
    phrase: 'WebGPU screen space reflections denoise',
    intent: 'long-tail',
    pages: ['/demos/ssr-denoise/'],
    priority: 'medium',
  },
  {
    id: 'service-studio',
    phrase: 'interactive media studio',
    intent: 'brand',
    pages: ['/', '/#contact'],
    priority: 'high',
  },
]

/** Section-level content inventory for the SEO dashboard. */
export function contentInventory() {
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    blurb: section.blurb,
    projectCount: PROJECTS.filter((p) => p.section === section.id).length,
    anchor: `/#${section.id}`,
  }))
}
