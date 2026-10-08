import { readFile } from 'node:fs/promises';
import { decodeEphemerisBinary, sha256Hex } from './binary-format.mjs';
import { createValidationReport } from './validation.mjs';
const directory = new URL('../../src/data/generated/neptune-orbit/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, directory), 'utf8'));
const manifest = await json('solar-system-ephemeris.manifest.json');
const references = await json('validation-references.json');
const committed = await json('solar-system-ephemeris.validation.json');
const binary = await readFile(new URL(manifest.binaryFile, directory));
const body = manifest.bodies[0];
if (manifest.bodies.length !== 1 || body.bodyId !== 'neptune' || body.provenance.targetId !== '899'
  || body.provenance.centerId !== '10' || body.provenance.timeScale !== 'TDB'
  || body.provenance.referencePlane !== 'ECLIPTIC' || body.provenance.sampleStepSeconds !== 86400
  || sha256Hex(binary) !== manifest.binarySha256
  || references.datasetId !== manifest.datasetId || !references.independent
  || references.samples.length !== 24 || committed.binarySha256 !== manifest.binarySha256
  || !committed.passed) throw new Error('Neptune display orbit provenance/integrity failed.');
const decoded = decodeEphemerisBinary(binary);
const report = createValidationReport(decoded.bodies, references);
if (!report.passed || !report.independentValidationPerformed) throw new Error('Neptune display orbit accuracy failed.');
console.log(`Neptune display orbit verified: ${report.referenceChecks.length} independent JPL checks.`);
