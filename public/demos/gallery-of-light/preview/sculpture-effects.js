import * as THREE from 'three';
import { createSculptureFog } from './sculpture-fog.js';
import { physicalSurface, materialCrossfade } from './material-transitions.js';
import { createSculptureCaustics } from './sculpture-caustics.js';
import { createSubsurfaceSurface } from './sculpture-subsurface.js';

/**
 * Reversible, browser-only studies. Source GLB materials and geometry are never edited.
 * Inspired by the MIT-licensed three.js refraction, wireframe, modified-material,
 * spotlight and caustics examples: https://threejs.org/examples/ .
 * Caustics use cached geometry-sampled refraction, not full simulated light transport.
 */
export function createSculptureEffects({ renderer, scene, galleryModel, sculptureModel, refractionEnvironment }) {
  if (!renderer || !scene || !galleryModel || !sculptureModel) {
    throw new Error('Sculpture effects require renderer, scene, gallery and sculptures.');
  }
  const names = {
    refraction: 'AI66_002_Sculpture_A',
    wireframe: 'AI66_002_Sculpture_B001',
    subsurface: 'AI66_002_Sculpture_B002',
    deform: 'AI66_002_Sculpture_C001',
    fog: 'Gallery floor',
    spotlight: 'AI66_002_Sculpture_D',
    material: 'AI66_002_Sculpture_E',
    caustics: 'AI66_002_Sculpture_F001',
  };
  const state = {
    ready: false,
    fog: null,
    errors: [],
    enabled: Object.fromEntries(Object.keys(names).map(id => [id, false])),
    strength: Object.fromEntries(Object.keys(names).map(id => [id, 0])),
    settings: {
      refraction: { ratio: 0.92 },
      wireframe: { color: '#247ce5' },
      subsurface: { amount: 1.5, thickness: .45, distortion: .45, power: 2, color: '#ffae70', lightIntensity: 1.8, translucency: .9 },
      deform: { amount: 0.5, speed: 0.25 },
      fog: { density: .75, height: .65, speed: .15, color: '#dce8ed' },
      spotlight: { intensity: 130, color: '#fff1da', angle: 0.48, projected: true },
      caustics: { intensity: 0.7, speed: 0.2, ior: 1.45 },
      material: { color: '#ffffff', roughness: 0.55, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.2, normalStrength: 1, envMapIntensity: 1 },
    },
    targets: { ...names },
    stats: { materialOverrideMeshes: 0, activeLights: 0, shadowMapSize: 0, refractionCubeSize: 0 },
    causticMethod: 'Cached geometry-sampled two-surface refraction, with opaque-pedestal blocking; approximate single-light floor projection.',
    caustics: null,
    deformation: null,
  };
  const runtime = new THREE.Group();
  runtime.name = 'gallery_effects_runtime';
  runtime.userData.runtimeOnly = true;
  scene.add(runtime);
  scene.updateMatrixWorld(true);
  const materials = new Set(), textures = new Set(), geometries = new Set();
  const originals = new Map(), resources = new Map(), targets = new Map();
  const shadowOriginal = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
  const initialEnvironment = refractionEnvironment ?? scene.environment;
  let disposed = false, refractionTarget = null, spotlight = null, caustics = null, fog = null;
  let previousTime = null, deformationPhase = 0, causticPhase = 0;
  const rememberMaterial = material => { materials.add(material); return material; };
  const asArray = value => Array.isArray(value) ? value : [value];
  const isStone = material => /Marble_Carved/i.test(material.name);
  const meshesOf = object => { const list = []; object?.traverse(child => { if (child.isMesh) list.push(child); }); return list; };
  const error = message => { if (!state.errors.includes(message)) state.errors.push(message); return false; };

  // Read bounds without populating/mutating shared BufferGeometry bounds caches.
  function boundsOf(meshes) {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const local = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position'));
      bounds.union(local.applyMatrix4(mesh.matrixWorld));
    }
    return bounds;
  }
  for (const [id, name] of Object.entries(names)) {
    if (id === 'fog') continue;
    const object = sculptureModel.getObjectByName(name);
    const meshes = meshesOf(object);
    if (!object || !meshes.length) { error(`Effect target is missing: ${name}`); continue; }
    targets.set(id, { object, meshes, bounds: boundsOf(meshes) });
    for (const mesh of meshes) if (!originals.has(mesh)) originals.set(mesh, {
      material: mesh.material,
      customDepthMaterial: mesh.customDepthMaterial,
      customDistanceMaterial: mesh.customDistanceMaterial,
      frustumCulled: mesh.frustumCulled,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
    });
  }
  const floorMeshes = [];
  galleryModel.traverse(object => {
    if (/^ai66_Floor_[AB]$/.test(object.name)) floorMeshes.push(...meshesOf(object));
  });
  const floorOriginals = new Map(floorMeshes.map(mesh => [mesh, mesh.receiveShadow]));
  if (floorMeshes.length) targets.set('fog', { object: galleryModel, meshes: [], bounds: boundsOf(floorMeshes) });
  else error('Gallery floor mist requires interior floor meshes.');
  const raycaster = new THREE.Raycaster();
  function floorAt(x, z, fromY = 8) {
    raycaster.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(floorMeshes, false)[0];
    return hit ? { y: hit.point.y, mesh: hit.object } : null;
  }
  function setMaterials(id, transform) {
    for (const mesh of targets.get(id).meshes) {
      const old = originals.get(mesh).material;
      const replacements = asArray(old).map((material, index) => transform(material, mesh, index));
      mesh.material = Array.isArray(old) ? replacements : replacements[0];
    }
  }
  function restoreMeshes(id) {
    for (const mesh of targets.get(id).meshes) {
      const saved = originals.get(mesh);
      mesh.material = saved.material;
      mesh.customDepthMaterial = saved.customDepthMaterial;
      mesh.customDistanceMaterial = saved.customDistanceMaterial;
      mesh.frustumCulled = saved.frustumCulled;
      mesh.castShadow = saved.castShadow;
      mesh.receiveShadow = saved.receiveShadow;
    }
  }
  function updateStats() {
    state.stats.materialOverrideMeshes = [...originals].filter(([mesh, saved]) => mesh.material !== saved.material).length;
    state.stats.activeLights = Number(state.enabled.spotlight) + Number(state.enabled.caustics);
    state.stats.shadowMapSize = state.enabled.spotlight ? 1024 : 0;
    state.stats.refractionCubeSize = refractionTarget ? 256 : 0;
  }

  function ensureRefraction() {
    if (resources.has('refraction')) return true;
    const environment = initialEnvironment ?? scene.environment;
    if (!environment?.isTexture || !environment.image) {
      return error('Refraction requires the loaded HDR environment.');
    }
    // The viewer supplies the original HDR equirectangular texture. Keep the
    // refraction mapping separate from the scene's reflection/lighting texture.
    refractionTarget = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const previousTarget = renderer.getRenderTarget();
    try { refractionTarget.fromEquirectangularTexture(renderer, environment); }
    finally { renderer.setRenderTarget(previousTarget); }
    refractionTarget.texture.mapping = THREE.CubeRefractionMapping;
    const material = rememberMaterial(new THREE.MeshPhongMaterial({
      name: 'runtime_A_environment_refraction',
      color: '#d6eeff',
      envMap: refractionTarget.texture,
      combine: THREE.MixOperation,
      // Keep shadowed direct lighting visible alongside the refracted sky.
      // A near-total environment replacement hid the gallery's roof shadows.
      reflectivity: 0.68,
      refractionRatio: state.settings.refraction.ratio,
      shininess: 95,
      specular: '#ffffff',
      side: THREE.DoubleSide,
    }));
    resources.set('refraction', material);
    return true;
  }
  function ensureWireframe() {
    if (!resources.has('wireframe')) resources.set('wireframe', rememberMaterial(new THREE.MeshBasicMaterial({
      name: 'runtime_B001_wireframe', color: state.settings.wireframe.color,
      wireframe: true, side: THREE.DoubleSide, toneMapped: false,
    })));
  }

  function ensureCrossfade(id) {
    const key = `${id}-transition`;
    if (resources.has(key)) return resources.get(key);
    const records = targets.get(id).meshes.map(mesh => materialCrossfade({
      mesh, original: originals.get(mesh).material, effect: resources.get(id),
      runtime, rememberMaterial, wireframe: id === 'wireframe',
    }));
    resources.set(key, records);
    return records;
  }

  function ensureMaterial() {
    if (resources.has('material')) return;
    const records = new Map();
    for (const mesh of targets.get('material').meshes) {
      const surfaces = asArray(originals.get(mesh).material).map(source => {
        const surface = physicalSurface(source, `${source.name}_runtime_E_material`);
        rememberMaterial(surface.material);
        return surface;
      });
      records.set(mesh, surfaces);
    }
    resources.set('material', records);
  }

  function ensureSubsurface() {
    if (resources.has('subsurface')) return;
    const records = new Map();
    for (const mesh of targets.get('subsurface').meshes) {
      const surfaces = asArray(originals.get(mesh).material).map(source => {
        const surface = createSubsurfaceSurface(source);
        rememberMaterial(surface.material);
        return surface;
      });
      records.set(mesh, surfaces);
    }
    resources.set('subsurface', records);
  }

  const twistDeclarations = `
uniform float iomTwistAmount;
uniform float iomTwistTime;
uniform float iomTwistHeight;
uniform float iomReliefBackX;
uniform float iomReliefFixedDepth;
uniform float iomReliefFullDepth;
uniform float iomTwistScale;
uniform vec3 iomTwistOrigin;
uniform mat4 iomLocalToWorld;
uniform mat4 iomWorldToLocal;
uniform mat3 iomNormalToWorld;
uniform mat3 iomNormalToLocal;
uniform mat3 iomDirectionToWorld;
uniform mat3 iomDirectionToLocal;
void iomTwistData(vec3 worldPosition, out mat3 turn, out vec3 gradient) {
  float h = clamp((worldPosition.y - iomTwistOrigin.y) / iomTwistHeight, 0.0, 1.0);
  float phase = iomTwistTime + h * 3.14159265359;
  float wave = 0.75 + 0.25 * sin(phase);
  // C1 is a fused relief, facing +X. Its backplate and shallow backing detail
  // remain exactly stationary; the protruding figure blends into the twist.
  float t = clamp((worldPosition.x - iomReliefBackX - iomReliefFixedDepth)
    / (iomReliefFullDepth - iomReliefFixedDepth), 0.0, 1.0);
  float mask = t * t * (3.0 - 2.0 * t);
  float maskSlope = 6.0 * t * (1.0 - t) / (iomReliefFullDepth - iomReliefFixedDepth);
  float amplitude = iomTwistAmount * iomTwistScale;
  float baseTheta = amplitude * h * h * wave;
  float theta = baseTheta * mask;
  float slope = amplitude / iomTwistHeight * (2.0 * h * wave + h * h * 0.78539816340 * cos(phase));
  gradient = vec3(baseTheta * maskSlope, slope * mask, 0.0);
  float c = cos(theta), s = sin(theta);
  turn = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
vec3 iomTwistPosition(vec3 localPosition) {
  vec3 worldPosition = (iomLocalToWorld * vec4(localPosition, 1.0)).xyz;
  if (worldPosition.x <= iomReliefBackX + iomReliefFixedDepth || iomTwistAmount == 0.0) return localPosition;
  mat3 turn; vec3 gradient;
  iomTwistData(worldPosition, turn, gradient);
  return (iomWorldToLocal * vec4(turn * (worldPosition - iomTwistOrigin) + iomTwistOrigin, 1.0)).xyz;
}
`;
  function patchTwist(material, uniforms, withNormals) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = twistDeclarations + shader.vertexShader;
      if (withNormals) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
#include <beginnormal_vertex>
vec3 iomWorldPosition = (iomLocalToWorld * vec4(position, 1.0)).xyz;
vec3 iomRadius = iomWorldPosition - iomTwistOrigin;
mat3 iomTurn; vec3 iomGradient;
iomTwistData(iomWorldPosition, iomTurn, iomGradient);
vec3 iomWorldNormal = iomNormalToWorld * objectNormal;
// Full inverse-transpose Jacobian includes BOTH height and mask derivatives.
// Using only the old vertical derivative would distort lighting at the join.
vec3 iomAngularDirection = vec3(iomRadius.z, 0.0, -iomRadius.x);
float iomDeterminant = 1.0 + dot(iomGradient, iomAngularDirection);
iomWorldNormal -= iomGradient * dot(iomAngularDirection, iomWorldNormal) / max(iomDeterminant, 0.05);
objectNormal = normalize(iomNormalToLocal * (iomTurn * iomWorldNormal));
#ifdef USE_TANGENT
  vec3 iomWorldTangent = iomDirectionToWorld * objectTangent;
  vec3 iomBentTangent = iomTurn * (iomWorldTangent + iomAngularDirection * dot(iomGradient, iomWorldTangent));
  objectTangent = normalize(iomDirectionToLocal * iomBentTangent);
#endif
`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = iomTwistPosition(position);');
    };
    material.customProgramCacheKey = () => `iom-anchored-relief-twist-v2-${withNormals ? 'surface' : 'depth'}`;
    material.needsUpdate = true;
    return material;
  }
  function ensureDeform() {
    if (resources.has('deform')) return;
    const target = targets.get('deform'), size = target.bounds.getSize(new THREE.Vector3());
    const center = target.bounds.getCenter(new THREE.Vector3());
    const origin = new THREE.Vector3(center.x, target.bounds.min.y, center.z);
    // Measured C001 backing is 13–18cm deep. A 20cm fixed region protects its
    // rectangular support and edges, with a broad smooth join into the body.
    // This conservative angular gain keeps the mask Jacobian positive over
    // every source vertex at both +/-1.5 slider limits and every wave phase.
    const mask = { backPlaneX: target.bounds.min.x, fixedDepth: .20, fullDepth: .55, angleScale: .32 };
    state.deformation = { method: 'Depth-masked figure twist with a fixed relief backing', ...mask,
      vertices: 0, anchoredVertices: 0, movingVertices: 0, extraGeometryBytes: 0, extraDrawCalls: 0 };
    const records = new Map();
    for (const mesh of target.meshes) {
      const position = mesh.geometry.getAttribute('position'), vertex = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        state.deformation.vertices++;
        if (vertex.x <= mask.backPlaneX + mask.fixedDepth) state.deformation.anchoredVertices++;
        else state.deformation.movingVertices++;
      }
      const normalToWorld = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const directionToWorld = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
      const uniforms = {
        iomTwistAmount: { value: state.settings.deform.amount },
        iomTwistTime: { value: deformationPhase },
        iomTwistHeight: { value: Math.max(size.y, 0.01) },
        iomReliefBackX: { value: mask.backPlaneX },
        iomReliefFixedDepth: { value: mask.fixedDepth },
        iomReliefFullDepth: { value: mask.fullDepth },
        iomTwistScale: { value: mask.angleScale },
        iomTwistOrigin: { value: origin },
        iomLocalToWorld: { value: mesh.matrixWorld.clone() },
        iomWorldToLocal: { value: mesh.matrixWorld.clone().invert() },
        iomNormalToWorld: { value: normalToWorld },
        iomNormalToLocal: { value: normalToWorld.clone().invert() },
        iomDirectionToWorld: { value: directionToWorld },
        iomDirectionToLocal: { value: directionToWorld.clone().invert() },
      };
      const replacements = asArray(originals.get(mesh).material).map(source => {
        const material = source.clone();
        material.name = `${source.name}_runtime_C001_twist`;
        return patchTwist(rememberMaterial(material), uniforms, true);
      });
      const depth = patchTwist(rememberMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })), uniforms, false);
      const distance = patchTwist(rememberMaterial(new THREE.MeshDistanceMaterial()), uniforms, false);
      records.set(mesh, { replacements, depth, distance, uniforms });
    }
    resources.set('deform', records);
  }

  function createGobo() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 128, 128);
    // Soft window-like stripes, generated locally and needing no external image.
    for (let x = -80; x < 200; x += 38) {
      const gradient = context.createLinearGradient(x, 0, x + 28, 0);
      gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.45, '#656565'); gradient.addColorStop(1, '#ffffff');
      context.fillStyle = gradient; context.fillRect(x, 0, 28, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; textures.add(texture);
    return texture;
  }
  function ensureSpotlight() {
    if (spotlight) return;
    const target = targets.get('spotlight'), center = target.bounds.getCenter(new THREE.Vector3());
    const height = target.bounds.max.y - target.bounds.min.y;
    const light = new THREE.SpotLight(state.settings.spotlight.color, state.settings.spotlight.intensity);
    light.name = 'runtime_D_spotlight';
    light.position.copy(center).add(new THREE.Vector3(-height * 0.65, height * 1.5, height * 0.95));
    light.target.position.copy(center).add(new THREE.Vector3(0, -height * 0.08, 0));
    light.angle = state.settings.spotlight.angle; light.penumbra = 0.65;
    light.decay = 2; light.distance = height * 5;
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 0.15; light.shadow.camera.far = height * 5;
    light.shadow.normalBias = 0.016; light.shadow.bias = -0.00008;
    light.shadow.autoUpdate = false; light.shadow.needsUpdate = true;
    light.visible = false;
    const map = createGobo(); light.map = state.settings.spotlight.projected ? map : null;
    runtime.add(light, light.target);
    const floor = floorAt(center.x, center.z, target.bounds.max.y + 2);
    spotlight = { light, map, floor };
  }

  function ensureCaustics() {
    if (caustics) return;
    const target = targets.get('caustics');
    // F001's second primitive is its red plinth, which remains opaque and intact.
    const stoneMeshes = target.meshes.filter(mesh => asArray(originals.get(mesh).material).some(isStone));
    if (!stoneMeshes.length) throw new Error('F001 marble surface is missing.');
    const bounds = boundsOf(stoneMeshes), center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const source = asArray(originals.get(stoneMeshes[0]).material).find(isStone);
    const surface = physicalSurface(source, 'runtime_F001_glass');
    const glass = rememberMaterial(surface.material);
    glass.thickness = Math.max(0.16, Math.min(size.x, size.z) * 0.65);
    glass.attenuationColor.set('#a8def4'); glass.attenuationDistance = 2;
    const light = new THREE.SpotLight('#eef8ff', 180 * state.settings.caustics.intensity);
    light.name = 'runtime_F001_caustic_light';
    light.position.copy(center).add(new THREE.Vector3(-1.4, 2.8, -1.6));
    light.target.position.copy(center);
    light.angle = 0.58; light.penumbra = 1; light.distance = 9; light.decay = 2;
    light.castShadow = false; light.visible = false;
    runtime.add(light, light.target);
    const beneath = floorAt(center.x, center.z, bounds.max.y + 2);
    if (!beneath) throw new Error('No gallery floor found for the caustic projection.');
    const opaqueMeshes = target.meshes.filter(mesh => !asArray(originals.get(mesh).material).some(isStone));
    const projectionEffect = createSculptureCaustics({
      stoneMeshes, opaqueMeshes, floorY: beneath.y,
      floorBounds: boundsOf(floorMeshes), light, runtime, ior: state.settings.caustics.ior,
    });
    state.caustics = projectionEffect.state;
    const { projection, uniforms } = projectionEffect;
    caustics = { glass, surface, light, projection, uniforms, projectionEffect, floor: beneath };
  }

  function ensureFog() {
    if (fog) return;
    const target = targets.get('fog');
    if (!target) throw new Error('No interior gallery floors found for floor mist.');
    fog = createSculptureFog({ renderer, floorMeshes, bounds: target.bounds, floorY: target.bounds.max.y, settings: state.settings.fog });
    state.fog = fog.state;
  }

  function checkID(id) {
    if (disposed) throw new Error('Sculpture effects are disposed.');
    if (!(id in names)) throw new Error(`Unknown sculpture effect: ${id}`);
    return targets.has(id);
  }
  function activate(id, enabled) {
    if (!checkID(id)) return error(`Effect target unavailable: ${id}`);
    enabled = Boolean(enabled);
    if (state.enabled[id] === enabled) return true;
    try {
      if (enabled) {
        if (id === 'refraction') {
          if (!ensureRefraction()) return false;
          setMaterials(id, () => resources.get('refraction'));
        } else if (id === 'wireframe') {
          ensureWireframe(); setMaterials(id, () => resources.get('wireframe'));
        } else if (id === 'deform') {
          ensureDeform();
          for (const [mesh, record] of resources.get(id)) {
            mesh.material = Array.isArray(originals.get(mesh).material) ? record.replacements : record.replacements[0];
            mesh.customDepthMaterial = record.depth; mesh.customDistanceMaterial = record.distance;
            // The shader can move vertices outside source bounds. Disabling culling
            // for this one mesh prevents pop-out without editing shared geometry.
            mesh.frustumCulled = false;
          }
        } else if (id === 'fog') {
          ensureFog();
        } else if (id === 'material' || id === 'subsurface') {
          if (id === 'material') ensureMaterial(); else ensureSubsurface();
          for (const [mesh, surfaces] of resources.get(id)) {
            const replacements = surfaces.map(surface => surface.material);
            mesh.material = Array.isArray(originals.get(mesh).material) ? replacements : replacements[0];
          }
        } else if (id === 'spotlight') {
          ensureSpotlight();
          renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
          for (const mesh of targets.get(id).meshes) { mesh.castShadow = true; mesh.receiveShadow = true; }
          if (spotlight.floor) spotlight.floor.mesh.receiveShadow = true;
          spotlight.light.visible = true; spotlight.light.shadow.needsUpdate = true;
        } else if (id === 'caustics') {
          ensureCaustics();
          setMaterials(id, material => isStone(material) ? caustics.glass : material);
          // WebGL does not calculate transmitted shadows; its opaque shadow would
          // contradict the glass study. The explicit projected pattern is the approximation.
          for (const mesh of targets.get(id).meshes) if (asArray(originals.get(mesh).material).some(isStone)) mesh.castShadow = false;
          caustics.light.visible = true; caustics.projection.visible = true;
        }
      } else {
        restoreMeshes(id);
        if (id === 'spotlight' && spotlight) {
          spotlight.light.visible = false;
          for (const [mesh, receiveShadow] of floorOriginals) mesh.receiveShadow = receiveShadow;
          renderer.shadowMap.enabled = shadowOriginal.enabled; renderer.shadowMap.type = shadowOriginal.type;
        }
        if (id === 'caustics' && caustics) { caustics.light.visible = false; caustics.projection.visible = false; }
      }
      state.enabled[id] = enabled; updateStats(); return true;
    } catch (cause) {
      restoreMeshes(id);
      return error(`${id}: ${cause.message}`);
    }
  }
  const ranges = {
    refraction: { ratio: [0.75, 1] }, deform: { amount: [-1.5, 1.5], speed: [0, 1] },
    subsurface: { amount: [0, 2], thickness: [.1, 3], distortion: [.05, 1], power: [1, 8], lightIntensity: [0, 4], translucency: [0, 1] },
    spotlight: { intensity: [0, 1500], angle: [0.15, 0.9] },
    caustics: { intensity: [0, 2], speed: [0, 1], ior: [1, 2] },
    fog: { density: [0, 2], height: [.15, 1.2], speed: [0, 1] },
    material: { roughness: [0, 1], metalness: [0, 1], clearcoat: [0, 1], clearcoatRoughness: [0, 1], normalStrength: [0, 2], envMapIntensity: [0, 3] },
  };
  function applyStrength(id) {
    const amount = state.strength[id], options = state.settings[id];
    if (id === 'refraction' || id === 'wireframe') {
      if (resources.has(id)) ensureCrossfade(id).forEach(record => record.apply(amount));
    } else if ((id === 'material' || id === 'subsurface') && resources.has(id)) {
      for (const surfaces of resources.get(id).values()) surfaces.forEach(surface => surface.apply(amount, options));
    } else if (id === 'deform' && resources.has(id)) {
      for (const record of resources.get(id).values()) record.uniforms.iomTwistAmount.value = options.amount * amount;
    } else if (id === 'fog' && fog) {
      fog.configure({ ...options, density: options.density * amount });
    } else if (id === 'spotlight' && spotlight) {
      spotlight.light.intensity = options.intensity * amount;
    } else if (id === 'caustics' && caustics) {
      caustics.surface.apply(amount, { color: '#e6f7ff', roughness: 0.065, metalness: 0,
        envMapIntensity: 1.5, normalStrength: 0, transmission: 1, ior: options.ior });
      caustics.uniforms.uIntensity.value = options.intensity * amount;
      caustics.light.intensity = 180 * options.intensity * amount;
      caustics.light.visible = state.enabled.caustics && options.intensity * amount > 0;
      caustics.projection.visible = caustics.light.visible && options.ior > 1;
    }
  }
  function setStrength(id, amount) {
    if (!checkID(id)) return false;
    if (!Number.isFinite(amount)) throw new Error(`Effect amount must be finite: ${id}`);
    amount = THREE.MathUtils.clamp(amount, 0, 1);
    if (amount === state.strength[id]) return true;
    if (!activate(id, amount > 0)) return false;
    state.strength[id] = amount;
    applyStrength(id);
    updateStats();
    return true;
  }
  function setEnabled(id, enabled) { return setStrength(id, enabled ? 1 : 0); }
  function configure(id, settings) {
    if (!checkID(id)) return false;
    for (const [key, value] of Object.entries(settings)) {
      if (!(key in state.settings[id])) throw new Error(`Unknown setting: ${id}.${key}`);
      const range = ranges[id]?.[key];
      if (range) {
        if (!Number.isFinite(value)) throw new Error(`Setting must be finite: ${id}.${key}`);
        state.settings[id][key] = THREE.MathUtils.clamp(value, range[0], range[1]);
      } else if (key === 'projected') state.settings[id][key] = Boolean(value);
      else if (key === 'color') {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Use a six-digit hex color for ${id}.${key}`);
        state.settings[id][key] = value;
      }
    }
    if (id === 'refraction' && resources.has(id)) resources.get(id).refractionRatio = state.settings[id].ratio;
    if (id === 'fog' && fog) fog.configure(state.settings.fog);
    if (id === 'wireframe' && resources.has(id)) resources.get(id).color.set(state.settings[id].color);
    if (id === 'deform' && resources.has(id)) {
      for (const record of resources.get(id).values()) record.uniforms.iomTwistAmount.value = state.settings[id].amount;
    }
    if (id === 'spotlight' && spotlight) {
      const options = state.settings[id], light = spotlight.light;
      light.color.set(options.color); light.intensity = options.intensity; light.angle = options.angle;
      light.map = options.projected ? spotlight.map : null; light.shadow.needsUpdate = true;
    }
    if (id === 'caustics' && caustics) {
      caustics.glass.ior = state.settings[id].ior;
      caustics.projectionEffect.configure(state.settings[id].ior);
      caustics.uniforms.uIntensity.value = state.settings[id].intensity;
      caustics.light.intensity = 180 * state.settings[id].intensity;
    }
    applyStrength(id);
    return true;
  }
  function update(seconds) {
    if (disposed || !Number.isFinite(seconds)) return;
    const delta = previousTime === null ? 0 : THREE.MathUtils.clamp(seconds - previousTime, 0, 0.1);
    previousTime = seconds;
    if (state.enabled.fog && fog) fog.update(delta, state.settings.fog.speed);
    if (state.enabled.deform) {
      deformationPhase += delta * state.settings.deform.speed;
      for (const record of resources.get('deform').values()) record.uniforms.iomTwistTime.value = deformationPhase;
    }
    if (state.enabled.caustics) {
      causticPhase += delta * state.settings.caustics.speed;
      caustics.uniforms.uTime.value = causticPhase;
    }
  }
  function dispose() {
    if (disposed) return;
    for (const id of Object.keys(names)) if (state.enabled[id]) setEnabled(id, false);
    scene.remove(runtime);
    spotlight?.light.shadow.map?.dispose();
    spotlight?.light.shadow.mapPass?.dispose();
    refractionTarget?.dispose();
    fog?.dispose();
    caustics?.projectionEffect.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    resources.clear(); disposed = true; state.ready = false;
  }
  state.ready = targets.size === Object.keys(names).length;
  return { state, setEnabled, setStrength, configure, update, dispose, render(camera) { return !disposed && state.enabled.fog ? fog.render(scene, camera) : false; } };
}
