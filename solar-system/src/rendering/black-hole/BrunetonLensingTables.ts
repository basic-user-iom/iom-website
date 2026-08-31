/**
 * Loader and CPU-side validation for Eric Bruneton's precomputed black-hole
 * ray tables. The table layout and coordinate mappings are adapted from
 * `black_hole/demo/camera_view/texture_manager.js` and
 * `black_hole/functions.glsl` at commit
 * e72b3f293409893a6fa25528b29572c96fc57f57.
 *
 * Copyright (c) 2020 Eric Bruneton
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

export const BRUNETON_REFERENCE_COMMIT =
  'e72b3f293409893a6fa25528b29572c96fc57f57' as const;

export const BRUNETON_CRITICAL_E_SQUARED = 4 / 27;

export interface BrunetonLookupTableSpec {
  readonly id: 'ray-deflection' | 'ray-inverse-radius';
  readonly fileName: 'deflection.dat' | 'inverse_radius.dat';
  readonly width: number;
  readonly height: number;
  readonly components: 2;
  readonly sha256: string;
}

export const BRUNETON_DEFLECTION_TABLE_SPEC: Readonly<BrunetonLookupTableSpec> =
  Object.freeze({
    id: 'ray-deflection',
    fileName: 'deflection.dat',
    width: 512,
    height: 512,
    components: 2,
    sha256: '1080f45a12fba81321771c2071f4a31795444b110833f61384a9bdf7d057c19d',
  });

export const BRUNETON_INVERSE_RADIUS_TABLE_SPEC: Readonly<BrunetonLookupTableSpec> =
  Object.freeze({
    id: 'ray-inverse-radius',
    fileName: 'inverse_radius.dat',
    width: 64,
    height: 32,
    components: 2,
    sha256: '7fa22a9270e61f2842c97fb1a9398bcb13e1a965ad39b0f73169354a0d608b04',
  });

export interface BrunetonLookupTable {
  readonly spec: Readonly<BrunetonLookupTableSpec>;
  readonly data: Float32Array;
  readonly minimum: number;
  readonly maximum: number;
}

export interface BrunetonLookupTables {
  readonly deflection: Readonly<BrunetonLookupTable>;
  readonly inverseRadius: Readonly<BrunetonLookupTable>;
}

export interface BrunetonLookupTableUrls {
  readonly deflection: string;
  readonly inverseRadius: string;
}

export interface LoadBrunetonLookupTablesOptions {
  readonly signal?: AbortSignal;
  readonly urls?: Readonly<BrunetonLookupTableUrls>;
  readonly fetchImplementation?: typeof fetch;
}

const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/phase10/black-hole/`;

export const DEFAULT_BRUNETON_LOOKUP_TABLE_URLS: Readonly<BrunetonLookupTableUrls> =
  Object.freeze({
    deflection: `${ASSET_ROOT}${BRUNETON_DEFLECTION_TABLE_SPEC.fileName}`,
    inverseRadius: `${ASSET_ROOT}${BRUNETON_INVERSE_RADIUS_TABLE_SPEC.fileName}`,
  });

/**
 * Parses Bruneton's little-endian `.dat` format: two Float32 dimensions,
 * followed by an interleaved RG Float32 payload.
 */
export function parseBrunetonLookupTable(
  buffer: ArrayBuffer,
  spec: Readonly<BrunetonLookupTableSpec>,
): Readonly<BrunetonLookupTable> {
  const expectedFloatCount = 2 + spec.width * spec.height * spec.components;
  const expectedByteLength = expectedFloatCount * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedByteLength) {
    throw new RangeError(
      `${spec.id} table has ${buffer.byteLength} bytes; expected ${expectedByteLength}.`,
    );
  }

  const view = new DataView(buffer);
  const width = view.getFloat32(0, true);
  const height = view.getFloat32(Float32Array.BYTES_PER_ELEMENT, true);
  if (width !== spec.width || height !== spec.height) {
    throw new RangeError(
      `${spec.id} table header is ${width}x${height}; expected ${spec.width}x${spec.height}.`,
    );
  }

  const data = new Float32Array(expectedFloatCount - 2);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < data.length; index += 1) {
    const value = view.getFloat32(
      (index + 2) * Float32Array.BYTES_PER_ELEMENT,
      true,
    );
    if (!Number.isFinite(value)) {
      throw new RangeError(`${spec.id} table contains a non-finite value at ${index}.`);
    }
    data[index] = value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  return Object.freeze({ spec, data, minimum, maximum });
}

export async function loadBrunetonLookupTables(
  options: Readonly<LoadBrunetonLookupTablesOptions> = {},
): Promise<Readonly<BrunetonLookupTables>> {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error('Fetch is unavailable; Bruneton lensing tables cannot be loaded.');
  }
  const urls = options.urls ?? DEFAULT_BRUNETON_LOOKUP_TABLE_URLS;
  const [deflectionBuffer, inverseRadiusBuffer] = await Promise.all([
    fetchTable(fetchImplementation, urls.deflection, options.signal),
    fetchTable(fetchImplementation, urls.inverseRadius, options.signal),
  ]);
  return Object.freeze({
    deflection: parseBrunetonLookupTable(
      deflectionBuffer,
      BRUNETON_DEFLECTION_TABLE_SPEC,
    ),
    inverseRadius: parseBrunetonLookupTable(
      inverseRadiusBuffer,
      BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
    ),
  });
}

async function fetchTable(
  fetchImplementation: typeof fetch,
  url: string,
  signal: AbortSignal | undefined,
): Promise<ArrayBuffer> {
  const response = await fetchImplementation(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load Bruneton lensing table ${url}: HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
}

/** Exact TypeScript port of Bruneton's Appendix-A deflection e² mapping. */
export function brunetonDeflectionTextureUFromESquared(eSquared: number): number {
  if (eSquared < BRUNETON_CRITICAL_E_SQUARED) {
    return 0.5 - Math.sqrt(
      -Math.log(1 - eSquared / BRUNETON_CRITICAL_E_SQUARED) / 50,
    );
  }
  return 0.5 + Math.sqrt(
    -Math.log(1 - BRUNETON_CRITICAL_E_SQUARED / eSquared) / 50,
  );
}

/** Exact TypeScript port of Bruneton's Eq. 9 apsis solution. */
export function brunetonUAtApsisFromESquared(eSquared: number): number {
  const x = (2 / BRUNETON_CRITICAL_E_SQUARED) * eSquared - 1;
  return 1 / 3 + (2 / 3) * Math.sin(Math.asin(x) / 3);
}

/** Exact TypeScript port of Bruneton's Appendix-A deflection-u mapping. */
export function brunetonDeflectionTextureVFromESquaredAndU(
  eSquared: number,
  u: number,
): number {
  if (eSquared > BRUNETON_CRITICAL_E_SQUARED) {
    const x = u < 2 / 3 ? -Math.sqrt(2 / 3 - u) : Math.sqrt(u - 2 / 3);
    return (Math.sqrt(2 / 3) + x) / (Math.sqrt(2 / 3) + Math.sqrt(1 / 3));
  }
  return 1 - Math.sqrt(
    Math.max(1 - u / brunetonUAtApsisFromESquared(eSquared), 0),
  );
}

/** Exact TypeScript port of Bruneton's inverse-radius e² mapping. */
export function brunetonInverseRadiusTextureUFromESquared(eSquared: number): number {
  return 1 / (1 + 6 * eSquared);
}

/** Exact TypeScript port of Bruneton's inverse-radius angular upper bound. */
export function brunetonPhiUpperBoundFromESquared(eSquared: number): number {
  return (1 + eSquared) / (1 / 3 + 2 * eSquared * Math.sqrt(eSquared));
}

export function brunetonTextureCoordFromUnitRange(x: number, textureSize: number): number {
  return 0.5 / textureSize + x * (1 - 1 / textureSize);
}

/** CPU equivalent of the shader's extension-independent bilinear RG lookup. */
export function sampleBrunetonLookupTable(
  table: Readonly<BrunetonLookupTable>,
  textureU: number,
  textureV: number,
): readonly [number, number] {
  const width = table.spec.width;
  const height = table.spec.height;
  const x = clamp(textureU * width - 0.5, 0, width - 1);
  const y = clamp(textureV * height - 0.5, 0, height - 1);
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fractionX = clamp(x - Math.floor(x), 0, 1);
  const fractionY = clamp(y - Math.floor(y), 0, 1);

  const a = tableValue(table, x0, y0);
  const b = tableValue(table, x1, y0);
  const c = tableValue(table, x0, y1);
  const d = tableValue(table, x1, y1);
  return Object.freeze([
    mix(mix(a[0], b[0], fractionX), mix(c[0], d[0], fractionX), fractionY),
    mix(mix(a[1], b[1], fractionX), mix(c[1], d[1], fractionX), fractionY),
  ] as const);
}

function tableValue(
  table: Readonly<BrunetonLookupTable>,
  x: number,
  y: number,
): readonly [number, number] {
  const index = (y * table.spec.width + x) * table.spec.components;
  return [table.data[index] ?? 0, table.data[index + 1] ?? 0];
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
