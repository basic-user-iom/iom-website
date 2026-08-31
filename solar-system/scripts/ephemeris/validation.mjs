const SECONDS_PER_DAY = 86_400;

export function createValidationReport(datasets, referenceSet = null, now = new Date()) {
  const datasetChecks = datasets.map(validateDatasetStructure);
  const referenceChecks = referenceSet === null ? [] : compareIndependentReferences(datasets, referenceSet);
  const structuralPassed = datasetChecks.every((check) => check.passed);
  const independentValidationPerformed = referenceSet?.independent === true && referenceChecks.length > 0;
  const referencesPassed = referenceChecks.every((check) => check.passed);
  return {
    schemaVersion: 1,
    generatedAtIso: now.toISOString(),
    passed: structuralPassed && independentValidationPerformed && referencesPassed,
    structuralPassed,
    independentValidationPerformed,
    independentSource: referenceSet?.sourceName ?? null,
    datasetChecks,
    referenceChecks,
    warnings: independentValidationPerformed ? [] : ['No explicitly independent reference set was supplied.'],
  };
}

export function validateDatasetStructure(dataset) {
  const errors = [];
  if (!Number.isFinite(dataset.startJdTdb)) errors.push('startJdTdb is not finite');
  if (!Number.isFinite(dataset.stepSeconds) || dataset.stepSeconds <= 0) errors.push('stepSeconds is invalid');
  if (!Number.isInteger(dataset.sampleCount) || dataset.sampleCount < 2) errors.push('sampleCount must be >= 2');
  if (!(dataset.valuesSi instanceof Float64Array)) errors.push('valuesSi is not Float64Array');
  else {
    if (dataset.valuesSi.length !== dataset.sampleCount * 6) errors.push('state vector length mismatch');
    for (const value of dataset.valuesSi) {
      if (!Number.isFinite(value)) {
        errors.push('state vectors contain non-finite values');
        break;
      }
    }
  }
  return { bodyId: dataset.bodyId, passed: errors.length === 0, errors };
}

export function compareIndependentReferences(datasets, referenceSet) {
  validateReferenceSet(referenceSet);
  const byBody = new Map(datasets.map((dataset) => [dataset.bodyId, dataset]));
  return referenceSet.samples.map((reference, index) => {
    const dataset = byBody.get(reference.bodyId);
    if (dataset === undefined) {
      return failedReference(reference, index, 'Body is absent from generated dataset.');
    }
    try {
      const interpolated = interpolateHermite(dataset, reference.jdTdb);
      const positionErrorM = vectorDistance(interpolated.positionM, reference.positionM);
      const velocityErrorMps = vectorDistance(interpolated.velocityMps, reference.velocityMps);
      const bodyTolerance = referenceSet.tolerancesByBody?.[reference.bodyId];
      const positionToleranceM = reference.positionToleranceM ?? bodyTolerance?.positionToleranceM ?? referenceSet.positionToleranceM;
      const velocityToleranceMps = reference.velocityToleranceMps ?? bodyTolerance?.velocityToleranceMps ?? referenceSet.velocityToleranceMps;
      if (!isNonNegative(positionToleranceM) || !isNonNegative(velocityToleranceMps)) {
        throw new Error(`No valid tolerances are configured for ${reference.bodyId}.`);
      }
      const passed = positionErrorM <= positionToleranceM && velocityErrorMps <= velocityToleranceMps;
      return {
        bodyId: reference.bodyId,
        jdTdb: reference.jdTdb,
        passed,
        positionErrorM,
        velocityErrorMps,
        positionToleranceM,
        velocityToleranceMps,
        error: passed ? null : 'Independent-reference tolerance exceeded.',
      };
    } catch (error) {
      return failedReference(reference, index, error instanceof Error ? error.message : String(error));
    }
  });
}

export function interpolateHermite(dataset, jdTdb) {
  if (!Number.isFinite(jdTdb)) throw new Error('Reference Julian Date is not finite.');
  const secondsFromStart = (jdTdb - dataset.startJdTdb) * SECONDS_PER_DAY;
  const maximumSeconds = (dataset.sampleCount - 1) * dataset.stepSeconds;
  const tolerance = 1e-4;
  if (secondsFromStart < -tolerance || secondsFromStart > maximumSeconds + tolerance) {
    throw new Error('Reference time is outside generated coverage.');
  }
  const boundedSeconds = Math.min(Math.max(secondsFromStart, 0), maximumSeconds);
  const lower = Math.min(Math.floor(boundedSeconds / dataset.stepSeconds), dataset.sampleCount - 2);
  const u = (boundedSeconds - lower * dataset.stepSeconds) / dataset.stepSeconds;
  const h = dataset.stepSeconds;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const dh00 = (6 * u2 - 6 * u) / h;
  const dh10 = 3 * u2 - 4 * u + 1;
  const dh01 = (-6 * u2 + 6 * u) / h;
  const dh11 = 3 * u2 - 2 * u;
  const positionM = [0, 0, 0];
  const velocityMps = [0, 0, 0];
  const lowerOffset = lower * 6;
  const upperOffset = (lower + 1) * 6;
  for (let axis = 0; axis < 3; axis += 1) {
    const p0 = dataset.valuesSi[lowerOffset + axis];
    const v0 = dataset.valuesSi[lowerOffset + axis + 3];
    const p1 = dataset.valuesSi[upperOffset + axis];
    const v1 = dataset.valuesSi[upperOffset + axis + 3];
    positionM[axis] = h00 * p0 + h10 * h * v0 + h01 * p1 + h11 * h * v1;
    velocityMps[axis] = dh00 * p0 + dh10 * v0 + dh01 * p1 + dh11 * v1;
  }
  return { positionM, velocityMps };
}

function validateReferenceSet(referenceSet) {
  if (!Array.isArray(referenceSet?.samples) || referenceSet.samples.length === 0) {
    throw new Error('Reference set must contain samples.');
  }
  for (const sample of referenceSet.samples) {
    if (typeof sample.bodyId !== 'string' || !Number.isFinite(sample.jdTdb)) {
      throw new Error('Every reference sample requires bodyId and finite jdTdb.');
    }
    validateVector(sample.positionM, 'positionM');
    validateVector(sample.velocityMps, 'velocityMps');
  }
}

function validateVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((component) => !Number.isFinite(component))) {
    throw new Error(`Reference ${label} must have three finite components.`);
  }
}

function failedReference(reference, index, error) {
  return {
    bodyId: reference.bodyId ?? `reference-${index}`,
    jdTdb: reference.jdTdb ?? null,
    passed: false,
    positionErrorM: null,
    velocityErrorMps: null,
    positionToleranceM: reference.positionToleranceM ?? null,
    velocityToleranceMps: reference.velocityToleranceMps ?? null,
    error,
  };
}

function vectorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const isNonNegative = (value) => Number.isFinite(value) && value >= 0;
