// Adapted from IOM src/demo/precision-object/ModelLoader.ts.
// Preserve its streamed loading progress, using the model's own base URL.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadGltf(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model request failed: HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length')) || 0;
  const reader = response.body?.getReader();
  let buffer;
  if (!reader) {
    buffer = await response.arrayBuffer();
  } else {
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(declared ? Math.min(.92, loaded / declared * .92) : null, loaded);
    }
    const combined = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    buffer = combined.buffer;
  }
  onProgress(.95, buffer.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', url).href);
  return gltf;
}
