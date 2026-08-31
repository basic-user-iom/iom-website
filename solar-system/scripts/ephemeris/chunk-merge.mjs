export function mergeParsedChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error('No parsed chunks to merge.');
  if (chunks.length === 1) return { ...chunks[0], sourceSolutions: compactSources(chunks) };
  const first = chunks[0];
  let sampleCount = first.sampleCount;
  for (let index = 1; index < chunks.length; index += 1) {
    const previous = chunks[index - 1];
    const current = chunks[index];
    assertSameContract(first, current);
    assertBoundaryMatches(previous, current, index);
    sampleCount += current.sampleCount - 1;
  }

  const sampleJdTdb = new Float64Array(sampleCount);
  const valuesSi = new Float64Array(sampleCount * 6);
  let outputSample = 0;
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const firstSample = chunkIndex === 0 ? 0 : 1;
    for (let sample = firstSample; sample < chunk.sampleCount; sample += 1) {
      sampleJdTdb[outputSample] = chunk.sampleJdTdb[sample];
      valuesSi.set(chunk.valuesSi.subarray(sample * 6, sample * 6 + 6), outputSample * 6);
      outputSample += 1;
    }
  }
  return {
    ...first,
    endJdTdb: sampleJdTdb[sampleCount - 1],
    sampleCount,
    sampleJdTdb,
    valuesSi,
    sourceSolutions: compactSources(chunks),
  };
}

function assertSameContract(first, current) {
  for (const key of ['bodyId', 'targetId', 'centerId', 'stepSeconds']) {
    if (current[key] !== first[key]) throw new Error(`Chunk contract mismatch for ${key}.`);
  }
}

function assertBoundaryMatches(previous, current, index) {
  const previousJd = previous.sampleJdTdb[previous.sampleCount - 1];
  const currentJd = current.sampleJdTdb[0];
  if (Math.abs(previousJd - currentJd) * 86_400 > 0.01) {
    throw new Error(`Chunk ${index} does not overlap the previous boundary epoch.`);
  }
  const previousOffset = (previous.sampleCount - 1) * 6;
  const smallBodySolution =
    typeof previous.targetSource === 'string' && previous.targetSource.startsWith('JPL#');
  for (let component = 0; component < 6; component += 1) {
    const a = previous.valuesSi[previousOffset + component];
    const b = current.valuesSi[component];
    // Long integrated small-body requests can differ by tens of metres when
    // Horizons evaluates adjacent API windows independently. The retained
    // first boundary sample is authoritative; reject differences above 100 m
    // (and 0.2 µm/s), far below the separately withheld validation budgets.
    const absoluteTolerance = smallBodySolution
      ? (component < 3 ? 100 : 2e-7)
      : 1e-6;
    const tolerance = Math.max(absoluteTolerance, Math.abs(a) * 1e-13);
    if (Math.abs(a - b) > tolerance) {
      throw new Error(
        `${String(previous.bodyId)} chunk ${index} boundary state differs at ` +
          `JD ${previousJd}, component ${component}: delta=${Math.abs(a - b)}, ` +
          `tolerance=${tolerance}.`,
      );
    }
  }
}

function compactSources(chunks) {
  return [...new Set(chunks.map((chunk) => chunk.targetSource).filter((source) => source !== null))];
}
