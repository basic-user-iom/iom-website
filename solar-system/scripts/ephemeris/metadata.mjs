export const GENERATOR_VERSION = 'iom-ephemeris-generator/1.0.0';

export function createEphemerisManifest({
  catalog,
  datasets,
  datasetId,
  binaryFile,
  binarySha256,
  generatedAtIso,
}) {
  const byId = new Map(catalog.bodies.map((body) => [body.id, body]));
  return {
    schemaVersion: 1,
    datasetId,
    binaryFile,
    binarySha256,
    format: {
      id: 'IOMEPH',
      versionMajor: 1,
      versionMinor: 0,
      byteOrder: 'little-endian',
      scalarType: 'float64',
      componentOrder: ['px', 'py', 'pz', 'vx', 'vy', 'vz'],
      units: ['m', 'm', 'm', 'm/s', 'm/s', 'm/s'],
    },
    generatedAtIso,
    bodies: datasets.map((dataset) => {
      const body = byId.get(dataset.bodyId);
      if (body === undefined) throw new Error(`Manifest body ${dataset.bodyId} is absent from catalog.`);
      return {
        bodyId: body.id,
        displayName: body.displayName,
        provenance: {
          provider: 'JPL_HORIZONS',
          sourceName: 'NASA/JPL Horizons vector ephemeris',
          targetId: body.targetId,
          centerId: catalog.centerId,
          referenceFrame: catalog.referenceFrame,
          referencePlane: catalog.referencePlane,
          timeScale: catalog.timeScale,
          units: 'm and m/s',
          startJd: dataset.startJdTdb,
          endJd: dataset.endJdTdb,
          sampleStepSeconds: dataset.stepSeconds,
          retrievedAtIso: dataset.retrievedAtIso,
          generatorVersion: GENERATOR_VERSION,
          sourceHash: dataset.sourceHash,
          notes: [
            `Source response units ${catalog.sourceUnits}; converted to SI exactly once during parsing.`,
            `Geometric states relative to Horizons center ${catalog.centerCommand}; no aberration correction.`,
            `Horizons response signature ${dataset.sourceSignature.source} ${dataset.sourceSignature.version}.`,
            `Horizons source solution(s): ${dataset.sourceSolutions.length > 0 ? dataset.sourceSolutions.join(', ') : 'not declared'}.`,
          ],
        },
      };
    }),
  };
}
