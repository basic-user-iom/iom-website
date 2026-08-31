import smallBodyManifest from '../../data/generated/small-body-ephemeris.manifest.json';
import smallBodyRouting from '../../data/generated/small-body-segments.json';
import smallBodyValidation from '../../data/generated/small-body-ephemeris.validation.json';
import {
  canonicalJsonSha256,
  parseSmallBodyValidationIdentity,
  verifySmallBodyBundleIntegrity,
} from '../../simulation/ephemeris/SmallBodyBundleIntegrity';

describe('small-body runtime bundle integrity', () => {
  it('accepts the committed manifest, validation report, and canonical routing JSON', async () => {
    await expect(
      verifySmallBodyBundleIntegrity(
        smallBodyManifest,
        smallBodyValidation,
        smallBodyRouting,
      ),
    ).resolves.toMatchObject({
      passed: true,
      structuralPassed: true,
      independentValidationPerformed: true,
      datasetId: smallBodyManifest.datasetId,
      binarySha256: smallBodyManifest.binarySha256,
      routingSha256: smallBodyValidation.routingSha256,
    });
  });

  it('uses the generator compact JSON.stringify encoding for routing hashes', async () => {
    await expect(canonicalJsonSha256({ b: 2, a: 1 })).resolves.toBe(
      '3fb75453225c732a76b7899ea2096dda1455189c89817239732182f73fe5a09f',
    );
  });

  it.each([
    ['passed', { passed: false }],
    ['structuralPassed', { structuralPassed: false }],
    ['independentValidationPerformed', { independentValidationPerformed: false }],
  ])('rejects a validation report when %s is not true', (_label, override) => {
    expect(() =>
      parseSmallBodyValidationIdentity({ ...smallBodyValidation, ...override }),
    ).toThrow(/must pass structural and independent checks/i);
  });

  it('rejects manifest identity mismatches', async () => {
    await expect(
      verifySmallBodyBundleIntegrity(
        { ...smallBodyManifest, datasetId: 'wrong-dataset' },
        smallBodyValidation,
        smallBodyRouting,
      ),
    ).rejects.toThrow(/datasetId does not match/i);

    await expect(
      verifySmallBodyBundleIntegrity(
        {
          ...smallBodyManifest,
          binarySha256: '0'.repeat(64),
        },
        smallBodyValidation,
        smallBodyRouting,
      ),
    ).rejects.toThrow(/binary SHA-256 does not match/i);
  });

  it('rejects structurally valid routing whose canonical content changed', async () => {
    await expect(
      verifySmallBodyBundleIntegrity(
        smallBodyManifest,
        smallBodyValidation,
        { ...smallBodyRouting, datasetId: 'stale-or-tampered-routing' },
      ),
    ).rejects.toThrow(/routing does not match.*SHA-256/i);
  });
});
