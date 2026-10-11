import * as THREE from 'three';

/**
 * Split the dominant HDR sun from a private lighting copy. The removed radiance,
 * integrated over pixel solid angle, becomes a shadowable directional light.
 * The original panorama remains available for background/refraction. The sky
 * still uses unoccluded image-based lighting; this is not full light transport.
 */
export function analyzeHDRSun(texture) {
  const started = performance.now();
  const image = texture?.image, input = image?.data;
  if (!input || !image.width || !image.height) {
    throw new Error('HDR analysis requires a decoded panorama.');
  }
  const { width, height } = image, channels = input.length / (width * height);
  const half = texture.type === THREE.HalfFloatType;
  if (channels < 3 || !Number.isInteger(channels) || (!half && texture.type !== THREE.FloatType)) {
    throw new Error('HDR lighting requires an RGB/RGBA half-float or float panorama.');
  }
  const halfValues = half ? new Float32Array(65536) : null;
  if (half) for (let i = 0; i < 65536; i++) halfValues[i] = THREE.DataUtils.fromHalfFloat(i);
  const read = offset => half ? halfValues[input[offset]] : input[offset];
  const rowSin = new Float64Array(height), rowCos = new Float64Array(height);
  const colSin = new Float64Array(width), colCos = new Float64Array(width);
  const pixelArea = 2 * Math.PI * Math.PI / (width * height);
  for (let y = 0; y < height; y++) {
    const v = texture.flipY ? 1 - (y + .5) / height : (y + .5) / height;
    const latitude = (v - .5) * Math.PI;
    rowSin[y] = Math.sin(latitude); rowCos[y] = Math.cos(latitude);
  }
  for (let x = 0; x < width; x++) {
    const longitude = ((x + .5) / width - .5) * 2 * Math.PI;
    colSin[x] = Math.sin(longitude); colCos[x] = Math.cos(longitude);
  }
  const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
  let peak = -Infinity, peakX = 0, peakY = 0, fullEnergy = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels, value = luminance(read(i), read(i + 1), read(i + 2));
    if (!Number.isFinite(value)) throw new Error('HDR panorama contains a non-finite radiance value.');
    fullEnergy += value * rowCos[y] * pixelArea;
    if (value > peak) { peak = value; peakX = x; peakY = y; }
  }
  const peakToMean = fullEnergy > 0 ? peak / (fullEnergy / (4 * Math.PI)) : 0;
  if (!(peakToMean > 100)) {
    // An overcast/evening sky can contain no distinct solar disc. Preserve all
    // of its radiance and record the absence of an extracted source explicitly.
    const skyTexture = copySkyTexture(texture, input.slice(), 'runtime_HDR_unmodified_sky');
    return { skyTexture, sun: {
      schemaVersion: 1, hasDirectSun: false,
      textureSize: [width, height], copiedBytes: input.byteLength, sourceFlipY: texture.flipY,
      peakPixel: [peakX, peakY], peakLuminance: peak, peakToMean,
      hotPixels: 0, editedPixels: 0, sourceDirection: null,
      defaultAzimuth: null, defaultElevation: null,
      integratedRGB: [0, 0, 0], normalizedSunColor: [0, 0, 0], radianceFractionRemoved: 0,
      skyFillRGB: null, coreRadiusDegrees: 0, outerRadiusDegrees: 0,
      analysisMilliseconds: Math.round((performance.now() - started) * 10) / 10,
    } };
  }
  const directionAt = (x, y, output = new THREE.Vector3()) => output.set(rowCos[y] * colCos[x], rowSin[y], rowCos[y] * colSin[x]);
  const peakDirection = directionAt(peakX, peakY), sourceDirection = new THREE.Vector3(), point = new THREE.Vector3();
  const hotPixels = [], nearby = Math.cos(THREE.MathUtils.degToRad(10));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels, value = luminance(read(i), read(i + 1), read(i + 2));
    if (value < peak * .01) continue;
    directionAt(x, y, point);
    if (point.dot(peakDirection) < nearby) continue;
    sourceDirection.addScaledVector(point, value * rowCos[y]); hotPixels.push([x, y]);
  }
  sourceDirection.normalize();
  const defaultAzimuth = THREE.MathUtils.radToDeg(Math.atan2(sourceDirection.z, sourceDirection.x));
  const defaultElevation = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sourceDirection.y, -1, 1)));
  let angularRadius = 0;
  for (const [x, y] of hotPixels) angularRadius = Math.max(angularRadius, Math.acos(THREE.MathUtils.clamp(directionAt(x, y, point).dot(sourceDirection), -1, 1)));
  const radians = THREE.MathUtils.degToRad;
  const coreRadius = THREE.MathUtils.clamp(angularRadius + 2 * Math.PI / height, radians(.75), radians(2));
  const outerRadius = coreRadius + 2 * Math.PI / height;
  const ringInner = Math.max(outerRadius + radians(.5), radians(1.8));
  const ringOuter = Math.max(ringInner + radians(1), radians(3));
  const ringMinimum = Math.cos(ringOuter), ringMaximum = Math.cos(ringInner), ring = [[], [], []];
  const affected = [], cutoff = Math.cos(outerRadius);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dot = rowCos[y] * (colCos[x] * sourceDirection.x + colSin[x] * sourceDirection.z) + rowSin[y] * sourceDirection.y;
    if (dot >= cutoff) affected.push({ x, y, angle: Math.acos(THREE.MathUtils.clamp(dot, -1, 1)) });
    if (dot >= ringMinimum && dot <= ringMaximum) {
      const i = (y * width + x) * channels;
      for (let c = 0; c < 3; c++) ring[c].push(read(i + c));
    }
  }
  if (!ring[0].length) throw new Error('Cannot sample the sky around the HDR sun.');
  const skyFill = ring.map(values => { values.sort((a, b) => a - b); return values[Math.floor(values.length / 2)]; });
  const output = input.slice(), integratedRGB = [0, 0, 0];
  for (const { x, y, angle } of affected) {
    const t = THREE.MathUtils.clamp((angle - coreRadius) / (outerRadius - coreRadius), 0, 1);
    const opacity = 1 - t * t * (3 - 2 * t), i = (y * width + x) * channels, solidAngle = rowCos[y] * pixelArea;
    for (let c = 0; c < 3; c++) {
      const original = read(i + c), value = THREE.MathUtils.lerp(original, skyFill[c], opacity);
      output[i + c] = half ? THREE.DataUtils.toHalfFloat(value) : value;
      const stored = half ? halfValues[output[i + c]] : output[i + c];
      integratedRGB[c] += (original - stored) * solidAngle;
    }
  }
  for (let c = 0; c < 3; c++) integratedRGB[c] = Math.max(0, integratedRGB[c]);
  const peakIntegrated = Math.max(...integratedRGB);
  if (!(peakIntegrated > 0)) throw new Error('The HDR sun has no removable radiance.');
  const skyTexture = copySkyTexture(texture, output, 'runtime_HDR_sky_without_sun');
  return { skyTexture, sun: {
    schemaVersion: 1, hasDirectSun: true,
    textureSize: [width, height], copiedBytes: output.byteLength, sourceFlipY: texture.flipY,
    peakPixel: [peakX, peakY], peakLuminance: peak, peakToMean,
    hotPixels: hotPixels.length, editedPixels: affected.length,
    sourceDirection: sourceDirection.toArray(), defaultAzimuth, defaultElevation,
    integratedRGB, normalizedSunColor: integratedRGB.map(value => value / peakIntegrated),
    radianceFractionRemoved: luminance(...integratedRGB) / fullEnergy,
    skyFillRGB: skyFill, coreRadiusDegrees: THREE.MathUtils.radToDeg(coreRadius),
    outerRadiusDegrees: THREE.MathUtils.radToDeg(outerRadius),
    analysisMilliseconds: Math.round((performance.now() - started) * 10) / 10,
  } };
}

function copySkyTexture(texture, output, name) {
  // Texture.copy/clone share a Source and increment its upload version. Use a
  // fresh DataTexture without touching the source panorama or its upload state.
  const skyTexture = new THREE.DataTexture(output, texture.image.width, texture.image.height, texture.format, texture.type);
  for (const property of ['mapping', 'channel', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy',
    'internalFormat', 'normalized', 'rotation', 'matrixAutoUpdate', 'generateMipmaps',
    'premultiplyAlpha', 'flipY', 'unpackAlignment', 'colorSpace']) skyTexture[property] = texture[property];
  for (const property of ['offset', 'repeat', 'center', 'matrix']) skyTexture[property].copy(texture[property]);
  skyTexture.name = name; skyTexture.needsUpdate = true;
  return skyTexture;
}

function copySunMetadata(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.hasDirectSun !== 'boolean') {
    throw new Error('Prepared HDR sun metadata has an unsupported schema.');
  }
  const sun = structuredClone(value);
  const finiteArray = (array, length) => Array.isArray(array) && array.length === length && array.every(Number.isFinite);
  if (!finiteArray(sun.textureSize, 2) || sun.textureSize.some(n => !Number.isInteger(n) || n < 1) ||
      !finiteArray(sun.integratedRGB, 3) || sun.integratedRGB.some(n => n < 0)) {
    throw new Error('Prepared HDR sun metadata contains invalid dimensions or radiance.');
  }
  if (sun.hasDirectSun) {
    if (!finiteArray(sun.sourceDirection, 3) || Math.abs(Math.hypot(...sun.sourceDirection) - 1) > 0.001 ||
        !Number.isFinite(sun.defaultAzimuth) || !Number.isFinite(sun.defaultElevation) ||
        !sun.integratedRGB.some(n => n > 0)) throw new Error('Prepared HDR sun direction is invalid.');
  } else if (sun.sourceDirection !== null || sun.integratedRGB.some(n => n !== 0)) {
    throw new Error('An HDR without a solar lobe cannot contain an extracted direct-light direction or radiance.');
  }
  return sun;
}

/**
 * Prepared sky PMREM textures are borrowed and remain owned by their loader.
 * Without prepared data, this helper owns and disposes the analyzed sky copy.
 * An HDR without a solar disc keeps its sky unchanged and uses the existing key
 * as an explicitly supplemental light; no direction is invented for that HDR.
 */
export function createHDRLighting({ scene, texture, key, galleryModel, fallbackIntensity = key?.intensity,
  preparedSun = null, preparedSkyTexture = null }) {
  const started = performance.now();
  if (!scene || !key?.isDirectionalLight || !galleryModel) {
    throw new Error('HDR lighting requires a gallery, scene and existing directional key.');
  }
  if (!Number.isFinite(fallbackIntensity)) throw new Error('Invalid fallback key intensity.');
  const prepared = preparedSun !== null || preparedSkyTexture !== null;
  if (prepared && (!preparedSun || !preparedSkyTexture?.isTexture)) {
    throw new Error('Prepared HDR lighting requires matching sun metadata and sky texture.');
  }
  const analysis = prepared ? null : analyzeHDRSun(texture);
  const sun = copySunMetadata(prepared ? preparedSun : analysis.sun);
  const skyTexture = prepared ? preparedSkyTexture : analysis.skyTexture;
  const ownsSkyTexture = !prepared;
  // Loader-provided identifiers permit an additional pairing check without
  // requiring the prepared CubeUV texture to retain decoded panorama pixels.
  if (prepared && sun.sourceId && preparedSkyTexture.userData?.hdrSourceId &&
      sun.sourceId !== preparedSkyTexture.userData.hdrSourceId) {
    throw new Error('Prepared HDR sky texture and sun metadata do not match.');
  }
  const radians = THREE.MathUtils.degToRad;

  galleryModel.updateWorldMatrix(true, true); key.updateWorldMatrix(true, false); key.target.updateWorldMatrix(true, false);
  const galleryBounds = new THREE.Box3(), localBounds = new THREE.Box3(), transformed = new THREE.Box3();
  const instance = new THREE.Matrix4(), world = new THREE.Matrix4();
  galleryModel.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    localBounds.setFromBufferAttribute(mesh.geometry.attributes.position);
    if (mesh.isInstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, instance); world.multiplyMatrices(mesh.matrixWorld, instance);
        galleryBounds.union(transformed.copy(localBounds).applyMatrix4(world));
      }
    } else galleryBounds.union(transformed.copy(localBounds).applyMatrix4(mesh.matrixWorld));
  });
  if (galleryBounds.isEmpty()) { if (ownsSkyTexture) skyTexture.dispose(); throw new Error('Gallery bounds are empty.'); }
  const center = galleryBounds.getCenter(new THREE.Vector3()), diagonal = galleryBounds.getSize(new THREE.Vector3()).length();
  const original = {
    position: key.position.clone(), color: key.color.clone(), intensity: fallbackIntensity,
    target: key.target, targetParent: key.target.parent, targetPosition: key.target.position.clone(),
    worldPosition: key.getWorldPosition(new THREE.Vector3()), worldTarget: key.target.getWorldPosition(new THREE.Vector3()),
  };
  const fallbackDirection = original.worldPosition.clone().sub(original.worldTarget).normalize();
  const sourceDirection = sun.hasDirectSun ? new THREE.Vector3().fromArray(sun.sourceDirection) : fallbackDirection.clone();
  const defaultAzimuth = sun.hasDirectSun ? sun.defaultAzimuth : THREE.MathUtils.radToDeg(Math.atan2(sourceDirection.z, sourceDirection.x));
  const defaultElevation = sun.hasDirectSun ? sun.defaultElevation : THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sourceDirection.y, -1, 1)));
  const directRGB = sun.hasDirectSun ? [...sun.integratedRGB] : [original.color.r, original.color.g, original.color.b].map(value => value * fallbackIntensity);
  const peakIntegrated = Math.max(...directRGB);
  const fallbackDistance = original.worldPosition.distanceTo(original.worldTarget), distance = Math.max(diagonal * 1.5 + 10, fallbackDistance);
  const target = new THREE.Object3D(); target.name = 'runtime_HDR_sun_target'; scene.add(target);
  const rotation = new THREE.Matrix4(), towardSun = new THREE.Vector3(), direction = new THREE.Vector3(), position = new THREE.Vector3();
  const keyRGB = new THREE.Vector3(), fallbackRGB = new THREE.Vector3(original.color.r, original.color.g, original.color.b).multiplyScalar(fallbackIntensity);
  const state = {
    ready: true, disposed: false, enabled: false, intensity: 0, blend: 0,
    ...sun,
    prepared, ownsSkyTexture, copiedBytes: prepared ? 0 : sun.copiedBytes,
    sunSource: sun.hasDirectSun ? 'HDR' : 'supplemental',
    method: sun.hasDirectSun
      ? 'Dominant HDR sun removed from the lighting sky and replaced by a shadowed directional light; remaining sky uses image-based lighting.'
      : 'This HDR has no distinct direct sun. Its complete sky lights the environment, with an additional controllable directional light.',
    sourceDirection: Object.freeze(sourceDirection.toArray()), worldDirection: sourceDirection.toArray(),
    defaultAzimuth, defaultElevation, azimuth: defaultAzimuth, elevation: defaultElevation,
    directLightRGB: directRGB,
    galleryBounds: { min: galleryBounds.min.toArray(), max: galleryBounds.max.toArray() },
    target: center.toArray(), lightDistance: distance, sunIntensity: 0,
    buildMilliseconds: Math.round((performance.now() - started) * 10) / 10,
  };
  function configure({ enabled = state.enabled, intensity = state.intensity, blend = state.blend,
    azimuth = state.azimuth, elevation = state.elevation } = {}) {
    if (state.disposed) return false;
    if (![intensity, blend, azimuth, elevation].every(Number.isFinite)) throw new Error('HDR intensity, blend and sun angles must be finite.');
    state.enabled = Boolean(enabled); state.intensity = Math.max(0, intensity); state.blend = THREE.MathUtils.clamp(blend, 0, 1);
    state.azimuth = THREE.MathUtils.clamp(azimuth, -180, 180);
    state.elevation = THREE.MathUtils.clamp(elevation, 1, 89);
    const amount = state.enabled ? state.blend : 0;
    const azimuthRadians = radians(state.azimuth), elevationRadians = radians(state.elevation), horizontal = Math.cos(elevationRadians);
    towardSun.set(horizontal * Math.cos(azimuthRadians), Math.sin(elevationRadians), horizontal * Math.sin(azimuthRadians))
      .applyMatrix4(rotation.makeRotationFromEuler(scene.environmentRotation)).normalize();
    state.worldDirection = towardSun.toArray(); state.sunIntensity = peakIntegrated * state.intensity * amount;
    if (amount === 0) {
      key.position.copy(original.position); key.color.copy(original.color); key.intensity = original.intensity; key.target = original.target;
    } else {
      direction.lerpVectors(fallbackDirection, towardSun, amount).normalize();
      target.position.lerpVectors(original.worldTarget, center, amount); target.updateWorldMatrix(true, false);
      position.copy(target.position).addScaledVector(direction, THREE.MathUtils.lerp(fallbackDistance, distance, amount));
      if (key.parent) key.parent.worldToLocal(position);
      key.position.copy(position); key.target = target;
      keyRGB.set(...directRGB).multiplyScalar(state.intensity * amount).addScaledVector(fallbackRGB, 1 - amount);
      key.intensity = Math.max(keyRGB.x, keyRGB.y, keyRGB.z);
      if (key.intensity > 0) key.color.setRGB(keyRGB.x / key.intensity, keyRGB.y / key.intensity, keyRGB.z / key.intensity, THREE.LinearSRGBColorSpace);
      else key.color.copy(original.color);
    }
    key.updateWorldMatrix(true, false); key.target.updateWorldMatrix(true, false);
    return true;
  }
  function dispose() {
    if (state.disposed) return;
    key.position.copy(original.position); key.color.copy(original.color); key.intensity = original.intensity; key.target = original.target;
    // The original target was never reparented or moved by this helper.
    original.target.position.copy(original.targetPosition); original.target.updateWorldMatrix(true, false);
    key.updateWorldMatrix(true, false); target.removeFromParent(); if (ownsSkyTexture) skyTexture.dispose();
    state.disposed = true; state.ready = false;
  }
  return { state, sourceTexture: texture, skyTexture, configure, dispose };
}
