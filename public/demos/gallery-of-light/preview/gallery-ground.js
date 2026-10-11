import * as THREE from 'three';

// Reconstructed from the original ground's outer bounds, below its source height.
// Source FBX has a bridged polygon hole that the earlier Blender import discarded.
const MIN_X = -27.45209312438965, MAX_X = 26.769662857055664;
const MIN_Z = -25.238378524780273, MAX_Z = 24.496112823486328;
const TOP_Y = -0.30414;
// Grade only the grass albedo in linear light; keep the panorama and PBR data intact.
const COLOR_GRADE = { saturation: 0.55, brightness: 0.88, tintLinear: [1.03, 1, 0.92] };
const UV_U = [0.5000000393946131, -1.2669335698946493e-7, 0.6706076323366507];
const UV_V = [-1.214855959796074e-7, -0.5000000300470563, 0.31443363215613696];
const MAPS = [
  { key: 'baseColor', slot: 'map', file: 'Grass005_Color_1024.jpg', size: 1024, bytes: 356383 },
  { key: 'normal', slot: 'normalMap', file: 'Grass005_NormalGL_512.png', size: 512, bytes: 634214 },
  { key: 'roughness', slot: 'roughnessMap', file: 'Grass005_Roughness_512.jpg', size: 512, bytes: 86192 },
];

// Three overlapping, randomly offset samples share the same triangle weights for
// every PBR map. Shared vertex seeds join continuously at cell boundaries. Explicit
// gradients keep the mip level stable when the random offsets change between cells.
// Offsets do not rotate tangent-space normals, so the OpenGL normal axes stay valid.
const GRASS_SAMPLING = /* glsl */`
vec2 grassOffset(vec2 cell) {
  vec3 p = fract(vec3(cell.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xx + p.yz) * p.zy);
}
vec4 grassSample(sampler2D grassMap, vec2 uv) {
  vec2 skewed = vec2(uv.x - 0.57735026919 * uv.y, 1.15470053838 * uv.y);
  vec2 cell = floor(skewed), f = fract(skewed);
  vec2 a, b = cell + vec2(1.0, 0.0), c = cell + vec2(0.0, 1.0);
  vec3 weights;
  if (f.x + f.y < 1.0) {
    a = cell;
    weights = vec3(1.0 - f.x - f.y, f.x, f.y);
  } else {
    a = cell + vec2(1.0);
    weights = vec3(f.x + f.y - 1.0, 1.0 - f.y, 1.0 - f.x);
  }
  weights = weights * weights * weights;
  weights /= dot(weights, vec3(1.0));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  return textureGrad(grassMap, uv + grassOffset(a), dx, dy) * weights.x
       + textureGrad(grassMap, uv + grassOffset(b), dx, dy) * weights.y
       + textureGrad(grassMap, uv + grassOffset(c), dx, dy) * weights.z;
}
`;

export function createGalleryGround({ renderer, scene }) {
  const state = {
    ready: false, status: 'loading', disposed: false, errors: [],
    name: 'runtime_AI66_002_Ground', triangles: 2, vertices: 4,
    bounds: { min: [MIN_X, TOP_Y, MIN_Z], max: [MAX_X, TOP_Y, MAX_Z] },
    dimensions: [MAX_X - MIN_X, 0, MAX_Z - MIN_Z],
    textureTileMetres: [2, 2], uvCoefficients: { u: [...UV_U], v: [...UV_V] },
    assetBytes: MAPS.reduce((total, map) => total + map.bytes, 0), loadedBytes: 0, maps: {},
    source: { file: 'gallery/AI66_002.fbx', object: 'AI66_002_Ground', material: 'AI66_002_Ground_001',
      originalTextureFolder: 'gallery/tex', originalTextureAppearance: 'Brown soil with dry leaves and twigs',
      originalTextureBytes: 6432867, originalVertices: 16, originalPolygonCorners: 18,
      adaptation: 'Two-triangle rectangle at the original outer extent; fills the building opening below the floors.',
      heightOffsetMetres: -0.004, audit: '../qa-gallery-exterior-ground/ORIGINAL_GROUND_AUDIT.md' },
    texture: { asset: 'Grass005', provider: 'ambientCG', url: 'https://ambientcg.com/view?id=Grass005',
      license: 'CC0-1.0', appearance: 'Muted natural olive-green grass', normalConvention: 'OpenGL +Y',
      colorGrade: COLOR_GRADE,
      provenance: '../assets/grass/provenance.json',
      antiTiling: { enabled: true, method: 'Three-sample stochastic triangular blending',
        samplesPerMap: 3, synchronizedPBR: true, explicitMipGradients: true,
        textureTileMetres: [2, 2], extraTriangles: 0 } },
    metalness: 0, normalStrength: 0.5, directionalShadowNormalBiasCap: 0.005,
    castShadow: false, receiveShadow: true,
  };
  const positions = [MIN_X, TOP_Y, MIN_Z, MIN_X, TOP_Y, MAX_Z,
    MAX_X, TOP_Y, MAX_Z, MAX_X, TOP_Y, MIN_Z];
  const uv = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2];
    uv.push(UV_U[0] * x + UV_U[1] * z + UV_U[2], UV_V[0] * x + UV_V[1] * z + UV_V[2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    name: 'runtime_AI66_002_Grass005', color: '#4b6334', metalness: 0,
    roughness: 0.95, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.FrontSide,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.grassSaturation = { value: COLOR_GRADE.saturation };
    shader.uniforms.grassBrightness = { value: COLOR_GRADE.brightness };
    shader.uniforms.grassTint = { value: new THREE.Vector3(...COLOR_GRADE.tintLinear) };
    shader.vertexShader = shader.vertexShader.replace('#include <shadowmap_vertex>',
      THREE.ShaderChunk.shadowmap_vertex.replaceAll('directionalLightShadows[ i ].shadowNormalBias',
        'min( directionalLightShadows[ i ].shadowNormalBias, 0.005 )'));
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      `#include <common>\nuniform float grassSaturation;\nuniform float grassBrightness;\nuniform vec3 grassTint;\n${GRASS_SAMPLING}`);
    for (const [chunk, sampler, uv] of [
      ['map_fragment', 'map', 'vMapUv'],
      ['normal_fragment_maps', 'normalMap', 'vNormalMapUv'],
      ['roughnessmap_fragment', 'roughnessMap', 'vRoughnessMapUv'],
    ]) {
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`,
        THREE.ShaderChunk[chunk].replaceAll(`texture2D( ${sampler}, ${uv} )`, `grassSample( ${sampler}, ${uv} )`)
        + (chunk === 'map_fragment' ? `
          #ifdef USE_MAP
            float grassLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = mix(vec3(grassLuminance), diffuseColor.rgb, grassSaturation)
              * grassBrightness * grassTint;
          #endif
        ` : ''));
    }
  };
  material.customProgramCacheKey = () => 'iom-grass005-natural-stochastic-directional-receiver-v2';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = state.name; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.source_object = 'AI66_002_Ground';
  mesh.userData.runtimeExteriorGround = true;
  scene.add(mesh);

  const loader = new THREE.TextureLoader(), ownedTextures = new Set();
  const anisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  function release(texture) { if (ownedTextures.delete(texture)) texture.dispose(); }
  function loadMap(definition) {
    const url = new URL(`../assets/grass/${definition.file}`, import.meta.url).href;
    const entry = state.maps[definition.key] = { url, file: definition.file, status: 'loading',
      width: definition.size, height: definition.size, bytes: definition.bytes, error: null,
      colorSpace: definition.key === 'baseColor' ? 'sRGB' : 'linear', anisotropy };
    return new Promise(resolve => {
      let pending;
      try {
        pending = loader.load(url, texture => {
          if (state.disposed) { release(texture); entry.status = 'disposed'; resolve(false); return; }
          texture.name = definition.file;
          texture.colorSpace = definition.key === 'baseColor' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = anisotropy;
          material[definition.slot] = texture;
          if (definition.key === 'baseColor') material.color.set('#ffffff');
          if (definition.key === 'roughness') material.roughness = 1;
          material.needsUpdate = true;
          entry.width = texture.image.width; entry.height = texture.image.height;
          entry.status = 'loaded'; state.loadedBytes += definition.bytes;
          resolve(true);
        }, undefined, () => {
          if (pending) release(pending);
          entry.status = state.disposed ? 'disposed' : 'error';
          if (!state.disposed) {
            entry.error = `Could not load ${definition.file}; the ground keeps its available maps and grass-color fallback.`;
            state.errors.push(entry.error);
          }
          resolve(false);
        });
        ownedTextures.add(pending);
      } catch (error) {
        if (pending) release(pending);
        entry.status = state.disposed ? 'disposed' : 'error';
        if (!state.disposed) { entry.error = String(error); state.errors.push(entry.error); }
        resolve(false);
      }
    });
  }
  const ready = Promise.all(MAPS.map(loadMap)).then(results => {
    if (state.disposed) return state;
    state.ready = true;
    const loaded = results.filter(Boolean).length;
    state.status = loaded === MAPS.length ? 'ready' : loaded ? 'partial' : 'fallback';
    return state;
  });
  function dispose() {
    if (state.disposed) return;
    state.disposed = true; state.ready = false; state.status = 'disposed';
    mesh.removeFromParent();
    for (const texture of [...ownedTextures]) release(texture);
    for (const definition of MAPS) {
      material[definition.slot] = null;
      state.maps[definition.key].status = 'disposed';
    }
    geometry.dispose(); material.dispose();
  }
  return { mesh, state, ready, dispose };
}
