import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, ShaderMaterial, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import navcamUrl from '../../data/generated/comet-shapes/67p-navcam.bin?url';
import { COMET_SHAPE_SOURCE as navcamSource } from './CometNucleusSources';
export { ROSETTA_BODY_ID, COMET_SHAPE_SOURCE } from './CometNucleusSources';

export type NucleusShapeState = 'illustrative' | 'loading' | 'navcam' | 'fallback';

/** Coordinate-based relief on a welded mesh: duplicate corners never separate. */
export function createNucleusGeometry(seed: number, bilobed = false): BufferGeometry {
  const base = new IcosahedronGeometry(1, 24);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geometry = mergeVertices(base, 1e-5);
  base.dispose();
  const position = geometry.getAttribute('position');
  const offset = (seed % 65521) / 7919;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const p = [x * 3.2 + offset, y * 3.2 - offset, z * 3.2];
    const broad = noise(...p as [number, number, number]);
    const ridges = noise(x * 13 + offset, y * 13, z * 13);
    const grit = noise(x * 38, y * 38 + offset, z * 38);
    const radius = 0.95 + broad * 0.16 + ridges * 0.042 + grit * 0.014;
    // Only used while the measured 67P asset loads or is unavailable.
    const neck = bilobed ? 0.60 + 0.4 * Math.abs(x) : 1;
    position.setXYZ(i, x * radius, y * radius * neck, z * radius * neck);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = `closed-illustrative-comet-${seed}`;
  return geometry;
}

function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (v: number): number => v * v * (3 - 2 * v);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const hash = (a: number, b: number, c: number): number => {
    const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  let result = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    result += hash(ix + a, iy + b, iz + c) * (a ? fx : 1 - fx) * (b ? fy : 1 - fy) * (c ? fz : 1 - fz);
  return result;
}

export function decodeNavcamGeometry(buffer: ArrayBuffer): BufferGeometry {
  if (buffer.byteLength < 12) throw new Error('Truncated comet shape');
  const header = new DataView(buffer);
  const vertices = header.getUint32(4, true), indices = header.getUint32(8, true);
  if (header.getUint32(0, true) !== 0x31304e43 || vertices !== navcamSource.vertices ||
    indices !== navcamSource.triangles * 3 || buffer.byteLength !== 12 + vertices * 12 + indices * 4)
    throw new Error('Invalid comet shape header');
  const positions = new Float32Array(buffer, 12, vertices * 3);
  const faces = new Uint32Array(buffer, 12 + vertices * 12, indices);
  if (positions.some(v => !Number.isFinite(v) || Math.abs(v) > 4) || faces.some(v => v >= vertices))
    throw new Error('Invalid comet shape coordinates');
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(Array.from(faces));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = 'esa-rosetta-navcam-mtp019';
  return geometry;
}

export async function loadNavcamGeometry(signal: AbortSignal): Promise<BufferGeometry> {
  const response = await fetch(navcamUrl, { signal });
  if (!response.ok) throw new Error(`NAVCAM model: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  if (Array.from(digest, n => n.toString(16).padStart(2, '0')).join('') !== navcamSource.outputSha256)
    throw new Error('NAVCAM model checksum mismatch');
  return decodeNavcamGeometry(buffer);
}

/** Exposure-enhanced inspection material, not calibrated radiometry or a surface map. */
export function createNucleusMaterial(seed: number): ShaderMaterial {
  return new ShaderMaterial({
    name: 'comet-dust-relief-inspection',
    uniforms: {
      uSunDirection: { value: new Vector3(-1, 0, 0) },
      uRenderRadius: { value: 1 },
      uSeed: { value: (seed % 65521) / 7919 },
    },
    vertexShader: `
      uniform float uRenderRadius;
      varying vec3 vSurface;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      #include <logdepthbuf_pars_vertex>
      void main() {
        vSurface = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mvPosition.xyz / max(uRenderRadius, 1e-20);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uSeed;
      varying vec3 vSurface;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      #include <logdepthbuf_pars_fragment>
      float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 p = vSurface + vec3(uSeed);
        float broad = noise(p*5.0);
        float middle = noise(p*22.0);
        float fine = noise(p*85.0);
        // Fade grain below its pixel footprint to prevent shimmering at a distance.
        float grainVisibility = 1.0-smoothstep(0.004,0.026,length(fwidth(vSurface)));
        float grain = mix(0.5,noise(p*220.0),grainVisibility);
        float height = middle*0.009 + fine*0.0025 + grain*0.0007;
        vec3 n = normalize(vNormal);
        vec3 dx = dFdx(vViewPosition), dy = dFdy(vViewPosition);
        vec3 r1 = cross(dy,n), r2 = cross(n,dx);
        float determinant = dot(dx,r1);
        vec3 gradient = sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
        vec3 bumped = abs(determinant)*n-gradient;
        float bumpedLengthSq = dot(bumped,bumped);
        // Subpixel triangles can have zero screen derivatives (notably ANGLE/WebKit).
        // Never normalize zero: NaNs would spread through the bloom pyramid.
        if (bumpedLengthSq > 1e-12) n = bumped * inversesqrt(bumpedLengthSq);
        vec3 sun = normalize(mat3(viewMatrix)*uSunDirection);
        float diffuse = max(dot(n,sun),0.0);
        float inspection = max(dot(n,normalize(vec3(-0.45,0.65,1.0))),0.0);
        float variation = 0.60 + broad*0.36 + middle*0.25 + fine*0.12;
        vec3 dust = mix(vec3(0.070,0.065,0.059),vec3(0.115,0.106,0.095),broad) * variation;
        // View-facing inspection fill retains readable relief even opposite the Sun.
        float facing = max(dot(n,normalize(-vViewPosition)),0.0);
        vec3 color = dust * (0.16 + 1.25*diffuse + 0.65*facing + 0.25*inspection);
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
