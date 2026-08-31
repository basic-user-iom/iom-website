export function createSolarFateRunSignature(
  namespace: string,
  serializedConfiguration: string,
): string {
  let hash = 0x811c_9dc5;
  const input = `${namespace}\n${serializedConfiguration}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return `${namespace}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
