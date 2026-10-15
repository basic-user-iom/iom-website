import * as THREE from 'three';
import { KTX2Loader } from './vendor/loaders/KTX2Loader.js?v=20261015-zstd-fallback-1';

const PREFIX = '../assets/environment/EveningSkyHDRI048B_2K';
const url = suffix => new URL(PREFIX + suffix, import.meta.url).href;

/** Local FastHDR assets, with the same evening panorama as an EXR fallback. */
export async function loadGalleryEnvironment(renderer) {
  const started = performance.now();
  const diagnostics = {
    asset: 'EveningSkyHDRI048B', source: 'https://ambientcg.com/view?id=EveningSkyHDRI048B',
    license: 'CC0', resolution: [2048, 1024], mode: 'FastHDR', warnings: [],
    preparedLighting: true, runtimeSunPixelAnalysis: false, loadMilliseconds: 0,
  };
  const owned = new Set();
  const loader = new KTX2Loader().setTranscoderPath(new URL('./vendor/basis/', import.meta.url).href).setWorkerLimit(1).detectSupport(renderer);
  let texture, skyTexture, sun;
  try {
    const results = await Promise.allSettled([
      loader.loadAsync(url('_panorama.ktx2')),
      loader.loadAsync(url('_sky.pmrem.ktx2')),
      fetch(url('_sun.json')).then(response => {
        if (!response.ok) throw new Error('Prepared HDR metadata is unavailable.');
        return response.json();
      }),
    ]);
    for (const result of results) if (result.status === 'fulfilled' && result.value?.isTexture) owned.add(result.value);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    [texture, skyTexture, sun] = results.map(result => result.value);
    if (sun.schemaVersion !== 1 || typeof sun.hasDirectSun !== 'boolean') throw new Error('Invalid prepared HDR metadata.');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.name = 'runtime_EveningSkyHDRI048B_panorama';
    skyTexture.mapping = THREE.CubeUVReflectionMapping;
    skyTexture.minFilter = skyTexture.magFilter = THREE.LinearFilter;
    skyTexture.isPMREMTexture = true;
    skyTexture.name = 'runtime_EveningSkyHDRI048B_prepared_sky';
    if (sun.sourceId) skyTexture.userData.hdrSourceId = sun.sourceId;
    // KTX2Loader also wraps its RGBA-half fallback in a CompressedTexture object.
    const gpuCompressed = item => Boolean(item.isCompressedTexture && item.format !== THREE.RGBAFormat);
    diagnostics.panorama = { width: texture.image.width, height: texture.image.height, format: texture.format, type: texture.type, compressed: gpuCompressed(texture) };
    diagnostics.lighting = { width: skyTexture.image.width, height: skyTexture.image.height, format: skyTexture.format, type: skyTexture.type, compressed: gpuCompressed(skyTexture), isPMREMTexture: true };
  } catch (error) {
    for (const item of owned) item.dispose();
    owned.clear();
    diagnostics.warnings.push(String(error));
    diagnostics.mode = 'EXR fallback'; diagnostics.preparedLighting = false; diagnostics.runtimeSunPixelAnalysis = true;
    const { EXRLoader } = await import('./vendor/loaders/EXRLoader.js');
    texture = await new EXRLoader().setDataType(THREE.HalfFloatType).loadAsync(url('_HDR.exr'));
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.name = 'runtime_EveningSkyHDRI048B_EXR_fallback';
    owned.add(texture); skyTexture = null; sun = null;
  } finally {
    loader.dispose();
  }
  diagnostics.loadMilliseconds = Math.round(performance.now() - started);
  diagnostics.bytes = performance.getEntriesByType('resource').filter(entry => entry.name.startsWith(url(''))).reduce((total, entry) => total + (entry.decodedBodySize || 0), 0);
  let disposed = false;
  return { texture, skyTexture, sun, diagnostics, dispose() {
    if (disposed) return; disposed = true;
    for (const item of owned) item.dispose();
    owned.clear();
  } };
}
