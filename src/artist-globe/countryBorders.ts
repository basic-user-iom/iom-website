import * as THREE from 'three'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'

const COUNTRIES_TOPO =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

/** Map our seed country labels → Natural Earth ADMIN names */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States of America',
  'united states': 'United States of America',
  'united states of america': 'United States of America',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'south korea': 'South Korea',
  korea: 'South Korea',
  russia: 'Russia',
  vietnam: 'Vietnam',
  bolivia: 'Bolivia',
  tanzania: 'United Republic of Tanzania',
  'czech republic': 'Czechia',
  czechia: 'Czechia',
  syria: 'Syria',
  iran: 'Iran',
  venezuela: 'Venezuela',
  moldova: 'Moldova',
  macedonia: 'North Macedonia',
  swaziland: 'eSwatini',
  'ivory coast': "Côte d'Ivoire",
  laos: 'Laos',
  brunei: 'Brunei',
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'republic of the congo': 'Congo',
  'south sudan': 'S. Sudan',
  'central african republic': 'Central African Rep.',
  'dominican republic': 'Dominican Rep.',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'solomon islands': 'Solomon Is.',
}

export function normalizeCountryKey(name: string): string {
  return name.trim().toLowerCase()
}

export function resolveCountryName(name: string): string {
  const key = normalizeCountryKey(name)
  return COUNTRY_ALIASES[key] || name.trim()
}

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

type Ring = [number, number][]

function ringsFromGeometry(geom: GeoJSON.Geometry): Ring[] {
  if (geom.type === 'Polygon') return geom.coordinates as Ring[]
  if (geom.type === 'MultiPolygon') {
    const out: Ring[] = []
    for (const poly of geom.coordinates) out.push(...(poly as Ring[]))
    return out
  }
  return []
}

function ringToLine(
  ring: Ring,
  radius: number,
  color: number,
  opacity: number,
): THREE.Line {
  const pts: THREE.Vector3[] = []
  for (const [lon, lat] of ring) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    pts.push(latLonToVec3(lat, lon, radius))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  })
  return new THREE.Line(geo, mat)
}

export interface CountryBordersHandle {
  group: THREE.Group
  setHighlight: (countryName: string | null) => void
  dispose: () => void
}

export async function loadCountryBorders(
  radius: number,
): Promise<CountryBordersHandle> {
  const group = new THREE.Group()
  group.name = 'country-borders'
  const byName = new Map<string, THREE.Object3D[]>()

  const res = await fetch(COUNTRIES_TOPO)
  if (!res.ok) throw new Error(`Failed to load countries (${res.status})`)
  const topo = (await res.json()) as Topology<{
    countries: GeometryCollection
  }>

  const collection = feature(topo, topo.objects.countries) as GeoJSON.FeatureCollection

  for (const f of collection.features) {
    const props = f.properties as { name?: string; NAME?: string } | null
    const name = String(props?.name || props?.NAME || '').trim()
    if (!name || !f.geometry) continue

    const lines: THREE.Object3D[] = []
    for (const ring of ringsFromGeometry(f.geometry)) {
      if (ring.length < 2) continue
      const line = ringToLine(ring, radius, 0x6b7c93, 0.22)
      line.userData.countryName = name
      group.add(line)
      lines.push(line)
    }
    if (lines.length) {
      byName.set(normalizeCountryKey(name), lines)
      // Also index without punctuation variants
      byName.set(normalizeCountryKey(resolveCountryName(name)), lines)
    }
  }

  let highlighted: THREE.Object3D[] = []

  const clearHighlight = () => {
    for (const obj of highlighted) {
      const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
      mat.color.setHex(0x6b7c93)
      mat.opacity = 0.22
    }
    highlighted = []
  }

  const setHighlight = (countryName: string | null) => {
    clearHighlight()
    if (!countryName) return
    const resolved = resolveCountryName(countryName)
    const lines =
      byName.get(normalizeCountryKey(resolved)) ||
      byName.get(normalizeCountryKey(countryName))
    if (!lines) return
    highlighted = lines
    for (const obj of lines) {
      const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial
      mat.color.setHex(0x00e5ff)
      mat.opacity = 0.85
    }
  }

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
  }

  return { group, setHighlight, dispose }
}
