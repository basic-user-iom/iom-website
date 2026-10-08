import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { Vector3 } from 'three';
import { createNucleusGeometry, decodeNavcamGeometry, loadNavcamGeometry, COMET_SHAPE_SOURCE } from '../../rendering/comets/CometNucleus';

const asset = readFileSync('src/data/generated/comet-shapes/67p-navcam.bin');
const buffer = (): ArrayBuffer => Uint8Array.from(asset).buffer;

describe('comet nucleus integrity', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([1, 675036, 395104, 142006, 202003])('keeps illustrative seed %i closed, smooth and deterministic', seed => {
    const geometry = createNucleusGeometry(seed);
    const repeat = createNucleusGeometry(seed);
    expect(geometry.getAttribute('position').array).toEqual(repeat.getAttribute('position').array);
    checkClosed(geometry);
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
      expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5);
    }
    expect(geometry.boundingSphere!.radius).toBeLessThan(1.3);
    geometry.dispose(); repeat.dispose();
  });

  it('ships the credited, watertight two-lobed NAVCAM shape at unit volume', () => {
    expect(createHash('sha256').update(asset).digest('hex')).toBe(COMET_SHAPE_SOURCE.outputSha256);
    const geometry = decodeNavcamGeometry(buffer());
    checkClosed(geometry);
    const p = geometry.getAttribute('position'), indices = geometry.index!;
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    let volume = 0;
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(p, indices.getX(i)); b.fromBufferAttribute(p, indices.getX(i + 1)); c.fromBufferAttribute(p, indices.getX(i + 2));
      volume += a.dot(b.cross(c)) / 6;
    }
    expect(volume).toBeCloseTo(4 * Math.PI / 3, 4);
    expect(geometry.index!.count / 3).toBe(24000);
    expect(COMET_SHAPE_SOURCE.license).toBe('CC BY-SA 3.0 IGO');
    geometry.dispose();
  });

  it('rejects truncated, invalid-index and non-finite asset data', () => {
    expect(() => decodeNavcamGeometry(new ArrayBuffer(3))).toThrow();
    const invalid = buffer(); new Float32Array(invalid, 12, 1)[0] = NaN;
    expect(() => decodeNavcamGeometry(invalid)).toThrow();
    const badIndex = buffer(); new DataView(badIndex).setUint32(12 + COMET_SHAPE_SOURCE.vertices * 12, 999999, true);
    expect(() => decodeNavcamGeometry(badIndex)).toThrow();
  });

  it('checks the downloaded hash and propagates network errors for the fallback', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const fetchMock = vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>buffer()});
    vi.stubGlobal('fetch',fetchMock);
    const signal = new AbortController().signal;
    const geometry = await loadNavcamGeometry(signal);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String),{signal});
    geometry.dispose();
    fetchMock.mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(asset.byteLength)});
    await expect(loadNavcamGeometry(signal)).rejects.toThrow('checksum');
    fetchMock.mockResolvedValue({ok:false,status:503});
    await expect(loadNavcamGeometry(signal)).rejects.toThrow('503');
  });
});

function checkClosed(geometry: ReturnType<typeof createNucleusGeometry>): void {
  const indices = geometry.index!;
  const edges = new Map<string, number>();
  const balance = new Map<string, number>();
  for (let i = 0; i < indices.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices.getX(i + j), b = indices.getX(i + (j + 1) % 3);
    expect(a).not.toBe(b);
    const key = `${Math.min(a,b)}:${Math.max(a,b)}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
    balance.set(key, (balance.get(key) ?? 0) + (a < b ? 1 : -1));
  }
  expect([...edges.values()].every(n => n === 2)).toBe(true);
  expect([...balance.values()].every(n => n === 0)).toBe(true);
}
