import { describe, expect, it } from 'vitest';

import { ISS_MODEL_ASSET } from '../../rendering/spaceobjects';

describe('space-object model catalog', () => {
  it('pins the current NASA/JSC IGOAL ISS asset and its web fidelity contract', () => {
    expect(ISS_MODEL_ASSET).toMatchObject({
      assetId: 'iss-nasa-jsc-igoal-2026-web',
      objectId: 'earth-satellite-25544',
      sourceOrganization: 'NASA/JSC/Integrated Graphics, Operations, and Analysis Laboratory',
      sourcePublishedUtc: '2026-05-20T00:00:00.000Z',
      physicalSpanMeters: 109,
      triangles: 595_180,
      materials: 42,
      lazyLoaded: true,
    });
    expect(ISS_MODEL_ASSET.file).toMatch(/assets\/space-objects\/iss\/iss-nasa-jsc-igoal-web\.glb$/);
    expect(ISS_MODEL_ASSET.sourcePage).toMatch(/^https:\/\/science\.nasa\.gov\//);
  });
});
