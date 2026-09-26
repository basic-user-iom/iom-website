export interface EarthSurfaceSample {
  readonly source?: 'local' | 'regional';
  readonly resolutionM?: number;
  readonly kind: 'land' | 'ocean';
  readonly elevationM: number;
  readonly surfaceAltitudeM: number;
  readonly waterDepthM: number;
  readonly coastal: boolean;
}
export type EarthSurfaceSampler = (latitudeDeg: number, longitudeDeg: number) => Readonly<EarthSurfaceSample>;
let revision = 0;
export function getEarthSurfaceRevision(): number { return revision; }
let baseSampler: EarthSurfaceSampler | null = null;
let sampler: EarthSurfaceSampler | null = null;
export function getRegionalEarthSurfaceSampler(): EarthSurfaceSampler | null { return baseSampler; }
export function installLocalEarthSurface(next: EarthSurfaceSampler): void { sampler=next; revision++; }
let loading: Promise<void> | null = null;
export function getEarthSurfaceSampler(): EarthSurfaceSampler | null { return sampler; }

/** NOAA ETOPO1, sampled every five arcminutes; south-to-north rows. */
export function decodeEarthSurface(buffer: ArrayBuffer): EarthSurfaceSampler {
  const view = new DataView(buffer);
  const width = view.getUint32(0, true), height = view.getUint32(4, true);
  const count = width * height;
  if (width < 3 || height < 3 || buffer.byteLength !== 8 + count * 3) throw new Error('Invalid Earth terrain grid');
  const heights = new Int16Array(count), ocean = new Uint8Array(buffer, 8 + count * 2, count);
  for (let i = 0; i < count; i++) heights[i] = view.getInt16(8 + i * 2, true);
  return (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new RangeError('Invalid terrain coordinate');
    const x = ((longitude + 180) % 360 + 360) % 360 / 360 * (width - 1);
    const y = (Math.max(-90, Math.min(90, latitude)) + 90) / 180 * (height - 1);
    const x0 = Math.floor(x), y0 = Math.min(height - 2, Math.floor(y));
    const fx = x - x0, fy = y - y0;
    const ids = [y0 * width + x0, y0 * width + x0 + 1, (y0 + 1) * width + x0, (y0 + 1) * width + x0 + 1];
    const a = heights[ids[0]!]! * (1 - fx) + heights[ids[1]!]! * fx;
    const b = heights[ids[2]!]! * (1 - fx) + heights[ids[3]!]! * fx;
    const elevationM = a * (1 - fy) + b * fy;
    const nearest = Math.round(y) * width + Math.round(x);
    const isOcean = ocean[nearest] === 1 && elevationM < 0;
    return { kind: isOcean ? 'ocean' : 'land', elevationM,
      surfaceAltitudeM: isOcean ? 0 : Math.max(0, elevationM),
      waterDepthM: isOcean ? -elevationM : 0,
      coastal: ids.some(i => ocean[i] !== ocean[ids[0]!]),
    };
  };
}

export function loadEarthSurface(): Promise<void> {
  if (sampler !== null) return Promise.resolve();
  if (loading !== null) return loading;
  loading = (async () => {
    const response = await fetch(import.meta.env.BASE_URL + 'assets/impact/earth-etopo1-5min.bin.gz');
    if (!response.ok || response.body === null) throw new Error('Earth terrain could not be loaded');
    const bytes = await response.arrayBuffer();
    // Vite may send Content-Encoding:gzip, which fetch transparently decodes.
    const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    const buffer = header[0] === 0x1f && header[1] === 0x8b
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : bytes;
    baseSampler = decodeEarthSurface(buffer);
    sampler = baseSampler; revision++;
  })().catch(error => { loading = null; throw error; });
  return loading;
}
