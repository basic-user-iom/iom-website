export interface SpaceObjectModelAsset {
  readonly assetId: string;
  readonly objectId: string;
  readonly file: string;
  readonly sourceOrganization: string;
  readonly sourcePage: string;
  readonly sourcePublishedUtc: string;
  readonly physicalSpanMeters: number;
  readonly modelBoundsMeters: readonly [number, number, number];
  readonly triangles: number;
  readonly materials: number;
  readonly lazyLoaded: boolean;
}

const SPACE_OBJECT_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/space-objects/`;

export const ISS_MODEL_ASSET: Readonly<SpaceObjectModelAsset> = Object.freeze({
  assetId: 'iss-nasa-jsc-igoal-2026-web',
  objectId: 'earth-satellite-25544',
  file: `${SPACE_OBJECT_ASSET_ROOT}iss/iss-nasa-jsc-igoal-web.glb`,
  sourceOrganization: 'NASA/JSC/Integrated Graphics, Operations, and Analysis Laboratory',
  sourcePage: 'https://science.nasa.gov/3d-resources/international-space-station-iss-d-igoal/',
  sourcePublishedUtc: '2026-05-20T00:00:00.000Z',
  physicalSpanMeters: 109,
  modelBoundsMeters: Object.freeze([73.429, 30.628, 108.273] as const),
  triangles: 595_180,
  materials: 42,
  lazyLoaded: true,
});


export const VOYAGER_MODEL_ASSET = Object.freeze({
  assetId: 'voyager-nasa-carbajal-2025-web',
  objectIds: Object.freeze(['voyager-1', 'voyager-2'] as const),
  file: SPACE_OBJECT_ASSET_ROOT + 'voyager/voyager-nasa-web.glb',
  sourcePage: 'https://science.nasa.gov/3d-resources/voyager-probe-b/',
  sourceOrganization: 'NASA / Michael D. Carbajal',
  triangles: 20_390,
  // Source meters retained; full bounds include the extended magnetometer boom.
  boundingRadiusMeters: 16.1,
  dishRadiusMeters: 1.85,
  lazyLoaded: true,
});

export function isVoyager(id: string | null): boolean {
  return id === 'voyager-1' || id === 'voyager-2';
}
