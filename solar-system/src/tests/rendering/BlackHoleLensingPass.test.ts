import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BRUNETON_DEFLECTION_TABLE_SPEC,
  BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
  BlackHoleLensingPass,
  parseBrunetonLookupTable,
  type BrunetonLookupTables,
} from '../../rendering/black-hole';

describe('BlackHoleLensingPass', () => {
  it('defers the lookup-table request until a high-quality encounter needs it', async () => {
    const tableLoader = vi.fn(loadOfficialTables);
    const pass = new BlackHoleLensingPass({
      initialQuality: 'high',
      highQualitySupported: true,
      tableLoader,
    });

    expect(tableLoader).not.toHaveBeenCalled();
    expect(pass.getTableDiagnostics().status).toBe('deferred');
    pass.update(frame({ active: false }));
    expect(tableLoader).not.toHaveBeenCalled();
    pass.update(frame());
    expect(pass.getTableDiagnostics().status).toBe('loading');
    await expect(pass.whenTablesReady()).resolves.toBe(true);
    expect(tableLoader).toHaveBeenCalledTimes(1);
    pass.dispose();
  });

  it('binds both validated tables before enabling the High/Ultra shader branch', async () => {
    const pass = new BlackHoleLensingPass({
      initialQuality: 'high',
      highQualitySupported: true,
      tableLoader: loadOfficialTables,
    });

    pass.update(frame());
    expect(pass.pass.enabled).toBe(true);
    expect(pass.getDiagnostics()).toMatchObject({
      active: true,
      path: 'simplified',
      quality: 'high',
      highQualitySupported: true,
      finite: true,
    });
    expect(pass.getDiagnostics().eventHorizonRadiusNdc).toBe(0.04);
    expect(pass.getDiagnostics().influenceRadiusNdc).toBeGreaterThan(0.04);
    // Loading is non-blocking. Until both tables validate, the live material
    // renders the Medium branch instead of sampling incomplete GPU data.
    expect(pass.pass.uniforms.mode?.value).toBe(1);
    expect(pass.pass.uniforms.eventHorizonRadius?.value).toBeCloseTo(0.02);
    await expect(pass.whenTablesReady()).resolves.toBe(true);
    expect(pass.pass.uniforms.mode?.value).toBe(2);
    expect(pass.getDiagnostics().path).toBe('schwarzschild');
    expect(pass.getTableDiagnostics()).toMatchObject({
      status: 'ready',
      deflectionDimensions: [512, 512],
      inverseRadiusDimensions: [64, 32],
      error: null,
    });
    expect(pass.pass.uniforms.rayDeflectionTexture?.value.image).toMatchObject({
      width: 512,
      height: 512,
    });
    expect(pass.pass.uniforms.rayInverseRadiusTexture?.value.image).toMatchObject({
      width: 64,
      height: 32,
    });

    pass.setQuality('medium');
    pass.update(frame());
    expect(pass.getDiagnostics().path).toBe('simplified');

    pass.setQuality('low');
    pass.update(frame());
    expect(pass.pass.enabled).toBe(false);
    expect(pass.getDiagnostics().path).toBe('off');

    pass.reset();
    pass.reset();
    expect(pass.getDiagnostics()).toMatchObject({ active: false, path: 'off' });
    pass.dispose();
    pass.dispose();
    expect(() => pass.update(frame())).toThrow(/disposed/i);
  });

  it('falls back to simplified lensing when the high-quality path is unavailable', () => {
    const pass = new BlackHoleLensingPass({
      initialQuality: 'ultra',
      highQualitySupported: false,
      tableLoader: neverLoadingTables,
    });
    pass.update(frame());
    expect(pass.getDiagnostics()).toMatchObject({
      active: true,
      path: 'simplified',
      highQualitySupported: false,
    });
    pass.dispose();
  });

  it('rejects non-finite centers, radii, aspects, and redshift values', () => {
    const pass = new BlackHoleLensingPass({ tableLoader: neverLoadingTables });
    expect(() => pass.update(frame({ centerNdc: [Number.NaN, 0] }))).toThrow(
      /center/i,
    );
    expect(() => pass.update(frame({ eventHorizonRadiusNdc: -1 }))).toThrow(
      /radius/i,
    );
    expect(() => pass.update(frame({ viewportAspect: 0 }))).toThrow(/aspect/i);
    expect(() => pass.update(frame({ redshiftStrength: Number.POSITIVE_INFINITY })))
      .toThrow(/redshift/i);
    pass.dispose();
  });
});

function loadOfficialTables(): Promise<Readonly<BrunetonLookupTables>> {
  const assetDirectory = resolve(
    process.cwd(),
    'public/assets/phase10/black-hole',
  );
  const deflectionBytes = readFileSync(resolve(assetDirectory, 'deflection.dat'));
  const inverseRadiusBytes = readFileSync(
    resolve(assetDirectory, 'inverse_radius.dat'),
  );
  return Promise.resolve(Object.freeze({
    deflection: parseBrunetonLookupTable(
      toArrayBuffer(deflectionBytes),
      BRUNETON_DEFLECTION_TABLE_SPEC,
    ),
    inverseRadius: parseBrunetonLookupTable(
      toArrayBuffer(inverseRadiusBytes),
      BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
    ),
  }));
}

function neverLoadingTables(): Promise<Readonly<BrunetonLookupTables>> {
  return new Promise(() => undefined);
}

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function frame(
  overrides: Partial<Parameters<BlackHoleLensingPass['update']>[0]> = {},
): Parameters<BlackHoleLensingPass['update']>[0] {
  return {
    active: true,
    centerNdc: [0.2, -0.1],
    eventHorizonRadiusNdc: 0.04,
    viewportAspect: 16 / 9,
    redshiftStrength: 0.7,
    ...overrides,
  };
}
