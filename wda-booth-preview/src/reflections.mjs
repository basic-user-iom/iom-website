import * as THREE from 'three';

// Adapted from internal IOM Gallery of Light gallery-reflections.js (2026-10-28).
// Mirrored camera and oblique clipping derive from Three.js Reflector, MIT;
// see public/vendor/three/LICENSE. No Gallery scene or media assets are used.
// A low-resolution planar capture, not SSR, ray tracing, or full GI.

export function reflectionBufferSize(width, height, mobile = false) {
  width = Math.max(1, Number(width) || 1); height = Math.max(1, Number(height) || 1);
  const scale = Math.min(0.5, (mobile ? 256 : 512) / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

// OrbitControls can round-trip a stationary camera by ~1e-15 on every update.
// Keep the last captured pose as the reference; real accumulated motion still
// invalidates. A nanometre-scale matrix tolerance has no visible effect here.
function sameCaptureMatrix(a, b) {
  return a.elements.every((value, index) => Number.isFinite(value) && Number.isFinite(b.elements[index]) && Math.abs(value - b.elements[index]) <= 1e-9);
}

export function createBoothReflections({ renderer, scene, camera, floors = [] }) {
  if (!renderer || !scene || !camera?.isPerspectiveCamera) {
    throw new TypeError('Booth reflections require renderer, scene, and perspective camera.');
  }
  const state = {
    ready: false, enabled: false, intensity: 0.22, roughness: 0.55,
    method: 'Depth-aware blurred planar floor specular', depthAwareBlur: true,
    specularSource: 'Planar capture replaces floor indirect specular; diffuse/direct light retained',
    renders: 0, passes: 0, skippedUnchanged: 0, targetAllocations: 0,
    bufferSize: [0, 0], floorY: null, floorMeshes: 0, errors: [], disposed: false,
  };
  const originals = new Map(), materials = new Map(), bounds = new THREE.Box3();
  // Only explicit caller-supplied floor meshes are eligible. Never discover an
  // arbitrary plane or a booth wall by name in the whole scene.
  for (const mesh of new Set(floors)) {
    if (!mesh?.isMesh || !mesh.geometry?.getAttribute('position')) continue;
    const array = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!array.every(m => m?.isMeshStandardMaterial || m?.isMeshPhysicalMaterial)) continue;
    mesh.updateWorldMatrix(true, false);
    const b = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position')).applyMatrix4(mesh.matrixWorld);
    if (b.max.y - b.min.y > 0.025) {
      state.errors.push(`Rejected non-horizontal floor: ${mesh.name || mesh.uuid}`); continue;
    }
    bounds.union(b); originals.set(mesh, mesh.material);
  }
  const floorMeshes = [...originals.keys()];
  if (!floorMeshes.length) state.errors.push('No valid explicit horizontal PBR floor meshes.');
  state.floorMeshes = floorMeshes.length; state.floorY = floorMeshes.length ? bounds.max.y : 0;
  const planePoint = new THREE.Vector3(0, state.floorY, 0), normal = new THREE.Vector3(0, 1, 0);
  const mirroredCamera = camera.clone(), cameraPosition = new THREE.Vector3();
  const rotation = new THREE.Matrix4(), view = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3();
  const clipPlane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const textureMatrix = new THREE.Matrix4(), viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const size = new THREE.Vector2(), savedViewport = new THREE.Vector4(), savedScissor = new THREE.Vector4();
  const lastWorld = new THREE.Matrix4(), lastProjection = new THREE.Matrix4();
  let capture = null, ping = null, blurred = null, inCapture = false, dirty = true, captured = false, lastVisibility = '';
  const uniforms = {
    wdaFloorReflection: { value: null }, wdaFloorMatrix: { value: textureMatrix },
    wdaFloorIntensity: { value: 0 },
  };
  const blurUniforms = {
    tInput: { value: null }, tDepth: { value: null }, uStep: { value: new THREE.Vector2() },
    uSize: { value: new THREE.Vector2() }, uInverseProjection: { value: mirroredCamera.projectionMatrixInverse },
  };
  const blurMaterial = new THREE.ShaderMaterial({
    name: 'WDA_planar_depth_blur', uniforms: blurUniforms,
    depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `uniform sampler2D tInput; uniform sampler2D tDepth;
      uniform vec2 uStep; uniform vec2 uSize; uniform mat4 uInverseProjection; varying vec2 vUv;
      float viewDepth(vec2 uv,float depth){
        vec4 point=uInverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
        return abs(point.z/point.w);
      }
      void main(){
        vec2 center=(floor(vUv*uSize)+0.5)/uSize;
        float centerDepth=texture2D(tDepth,center).r;
        float centerZ=viewDepth(center,centerDepth);
        vec4 sum=vec4(0.0); float weightSum=0.0;
        for(int i=-4;i<=4;i++){
          vec2 uv=(floor(clamp(center+uStep*float(i),vec2(0.0),vec2(0.999999))*uSize)+0.5)/uSize;
          float depth=texture2D(tDepth,uv).r;
          float background=step(0.999999,depth), centerBackground=step(0.999999,centerDepth);
          float sameLayer=1.0-step(0.5,abs(background-centerBackground));
          if(centerBackground<0.5) sameLayer*=1.0-step(max(0.025,centerZ*0.01),abs(viewDepth(uv,depth)-centerZ));
          float weight=exp(-float(i*i)/4.5)*sameLayer;
          sum+=texture2D(tInput,uv)*weight;weightSum+=weight;
        }
        gl_FragColor=sum/max(weightSum,0.00001);
      }`,
  });
  const blurScene = new THREE.Scene(), blurCamera = new THREE.Camera(), blurGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(blurGeometry, blurMaterial); quad.frustumCulled = false; blurScene.add(quad);

  function replacement(source) {
    if (materials.has(source)) return materials.get(source);
    const copy = source.clone(); copy.name = `${source.name}_WDA_planar`;
    const priorCompile = source.onBeforeCompile, priorKey = source.customProgramCacheKey;
    copy.onBeforeCompile = (shader, activeRenderer) => {
      priorCompile.call(copy, shader, activeRenderer);
      for (const [stage, needle] of [
        ['vertexShader', '#include <project_vertex>'], ['vertexShader', '#include <shadowmap_vertex>'],
        ['fragmentShader', '#include <lights_fragment_maps>'], ['fragmentShader', '#include <lights_physical_pars_fragment>'],
      ]) if (!shader[stage].includes(needle)) throw new Error(`Unsupported floor shader hook: ${needle}`);
      if (!THREE.ShaderChunk.lights_physical_pars_fragment.includes('indirectSpecular += multiScattering * cosineWeightedIrradiance;')) {
        throw new Error('Unsupported Three.js floor multi-scattering shader.');
      }
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'uniform mat4 wdaFloorMatrix; varying vec4 wdaFloorUV;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nwdaFloorUV=wdaFloorMatrix*modelMatrix*vec4(transformed,1.0);');
      shader.vertexShader = shader.vertexShader.replace('#include <shadowmap_vertex>',
        THREE.ShaderChunk.shadowmap_vertex.replaceAll('directionalLightShadows[ i ].shadowNormalBias',
          'min(directionalLightShadows[ i ].shadowNormalBias,0.005)'));
      shader.fragmentShader = 'uniform sampler2D wdaFloorReflection; uniform float wdaFloorIntensity; varying vec4 wdaFloorUV;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', `
        #include <lights_fragment_maps>
        #if defined(RE_IndirectSpecular)
          vec2 wdaUV=wdaFloorUV.xy/max(wdaFloorUV.w,0.00001);
          vec2 wdaEdge=smoothstep(vec2(0.0),vec2(0.035),wdaUV)*(1.0-smoothstep(vec2(0.965),vec2(1.0),wdaUV));
          float wdaWeight=wdaFloorIntensity*wdaEdge.x*wdaEdge.y*step(0.0,wdaFloorUV.w);
          radiance=texture2D(wdaFloorReflection,clamp(wdaUV,0.0,1.0)).rgb*wdaWeight;
          #ifdef USE_CLEARCOAT
            clearcoatRadiance=radiance;
          #endif
        #endif`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'indirectSpecular += multiScattering * cosineWeightedIrradiance;',
          'indirectSpecular += multiScattering * radiance;'));
    };
    copy.customProgramCacheKey = () => `${priorKey.call(source)}|wda-planar-r180-v1`;
    materials.set(source, copy); return copy;
  }
  function syncMaterials() {
    const active = state.ready && state.enabled && state.intensity > 0;
    uniforms.wdaFloorIntensity.value = active && captured ? state.intensity : 0;
    for (const [mesh, original] of originals) mesh.material = active
      ? (Array.isArray(original) ? original.map(replacement) : replacement(original)) : original;
  }
  // A floor selector updates the stable source material held in `originals`
  // (the contact-shaded material when that effect is installed). Keep already
  // allocated reflection clones in step without replacing their shader hooks,
  // creating new materials, or taking ownership of the caller's textures.
  function syncSurface() {
    if (state.disposed || !state.ready) return false;
    let changed = false;
    const values = [
      'map', 'normalMap', 'normalMapType', 'roughnessMap', 'metalnessMap',
      'aoMap', 'aoMapIntensity', 'bumpMap', 'bumpScale', 'emissiveMap',
      'roughness', 'metalness', 'emissiveIntensity', 'envMapIntensity',
      'specularIntensityMap', 'specularColorMap', 'specularIntensity', 'ior',
      'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap',
      'clearcoat', 'clearcoatRoughness',
    ];
    const vectors = ['color', 'emissive', 'specularColor', 'normalScale', 'clearcoatNormalScale'];
    for (const [source, copy] of materials) {
      let materialChanged = false, programChanged = false;
      for (const field of values) if (field in source && field in copy && copy[field] !== source[field]) {
        if (field === 'map' || field.endsWith('Map')) {
          programChanged ||= Boolean(copy[field]) !== Boolean(source[field]) || copy[field]?.channel !== source[field]?.channel;
        } else if (field === 'normalMapType' || (field === 'clearcoat' && Boolean(copy[field]) !== Boolean(source[field]))) programChanged = true;
        copy[field] = source[field]; materialChanged = true;
      }
      for (const field of vectors) if (source[field]?.equals && copy[field]?.copy && !copy[field].equals(source[field])) {
        copy[field].copy(source[field]); materialChanged = true;
      }
      // Texture presence/channels and physical features may change the program.
      // Keep both the contact and reflection callbacks/cache keys intact.
      if (materialChanged) { if(programChanged) copy.needsUpdate = true; changed = true; }
    }
    // Floor meshes are hidden during the capture. Their surface change does not
    // invalidate the mirrored scene; the caller only schedules a main frame.
    return changed;
  }
  function set(options = {}) {
    if (state.disposed || !options || typeof options !== 'object') return false;
    for (const key of ['intensity', 'roughness']) if (key in options && !Number.isFinite(options[key])) return false;
    if ('enabled' in options) state.enabled = Boolean(options.enabled) && state.ready;
    for (const key of ['intensity', 'roughness']) if (key in options) state[key] = THREE.MathUtils.clamp(options[key], 0, 1);
    dirty = true; syncMaterials(); return true;
  }
  function mobile() {
    const width = renderer.domElement?.clientWidth;
    return typeof width === 'number' && width > 0 && width <= 700;
  }
  function resize() {
    if (state.disposed) return false;
    dirty = true;
    // Lazy allocation: OFF never allocates render targets.
    if (!state.ready || !state.enabled || state.intensity <= 0) return false;
    renderer.getDrawingBufferSize(size);
    const [width, height] = reflectionBufferSize(size.x, size.y, mobile());
    if (state.bufferSize[0] === width && state.bufferSize[1] === height) return false;
    if (!capture) {
      const options = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        generateMipmaps: false, samples: 0 };
      const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
      depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
      capture = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: true, depthTexture });
      ping = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
      blurred = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
      state.targetAllocations += 3;
    } else for (const rt of [capture, ping, blurred]) rt.setSize(width, height);
    state.bufferSize = [width, height]; blurUniforms.uSize.value.set(width, height); blurUniforms.tDepth.value = capture.depthTexture;
    return true;
  }
  function updateCamera() {
    camera.updateMatrixWorld(); cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    if (cameraPosition.y <= state.floorY + 0.01) return false;
    view.subVectors(planePoint, cameraPosition).reflect(normal).negate().add(planePoint);
    rotation.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rotation).add(cameraPosition);
    target.subVectors(planePoint, look).reflect(normal).negate().add(planePoint);
    mirroredCamera.position.copy(view); mirroredCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    mirroredCamera.lookAt(target); mirroredCamera.far = camera.far; mirroredCamera.near = camera.near;
    mirroredCamera.layers.mask = camera.layers.mask; mirroredCamera.updateMatrixWorld();
    mirroredCamera.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1)
      .multiply(mirroredCamera.projectionMatrix).multiply(mirroredCamera.matrixWorldInverse);
    clipPlane.setFromNormalAndCoplanarPoint(normal, planePoint).applyMatrix4(mirroredCamera.matrixWorldInverse);
    clip.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
    const projection = mirroredCamera.projectionMatrix, p = projection.elements;
    q.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    const denominator = clip.dot(q);
    if (Math.abs(denominator) < 1e-8) return false;
    clip.multiplyScalar(2 / denominator); p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1 - 0.001; p[14] = clip.w;
    mirroredCamera.projectionMatrixInverse.copy(projection).invert(); return true;
  }
  function update(force = false) {
    if (state.disposed || !state.ready || !state.enabled || state.intensity <= 0 || inCapture) return false;
    camera.updateMatrixWorld();
    const visibility = floorMeshes.map(m => String(m.visible)).join(',');
    if (!force && !dirty && captured && visibility === lastVisibility && sameCaptureMatrix(lastWorld,camera.matrixWorld) && sameCaptureMatrix(lastProjection,camera.projectionMatrix)) {
      state.skippedUnchanged++; return false;
    }
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(viewProjection);
    if (!frustum.intersectsBox(bounds) || !floorMeshes.some(m => m.visible) || !updateCamera()) {
      uniforms.wdaFloorIntensity.value = 0; return false;
    }
    resize(); inCapture = true;
    const previousTarget = renderer.getRenderTarget(), xr = renderer.xr.enabled;
    const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
    const scissorTest = renderer.getScissorTest(); renderer.getViewport(savedViewport); renderer.getScissor(savedScissor);
    const hidden = floorMeshes.map(mesh => [mesh, mesh.visible]); let success = false;
    try {
      hidden.forEach(([mesh]) => { mesh.visible = false; }); renderer.xr.enabled = false;
      renderer.setScissorTest(false); renderer.setRenderTarget(capture); renderer.clear(); renderer.render(scene, mirroredCamera);
      uniforms.wdaFloorReflection.value = capture.texture; state.passes++;
      if (state.roughness > 0) {
        const radius = state.roughness * 6;
        blurUniforms.tInput.value = capture.texture; blurUniforms.uStep.value.set(radius / state.bufferSize[0], 0);
        renderer.setRenderTarget(ping); renderer.render(blurScene, blurCamera);
        blurUniforms.tInput.value = ping.texture; blurUniforms.uStep.value.set(0, radius / state.bufferSize[1]);
        renderer.setRenderTarget(blurred); renderer.render(blurScene, blurCamera);
        uniforms.wdaFloorReflection.value = blurred.texture; state.passes += 2;
      }
      state.renders++; captured = true; dirty = false; success = true;
      lastWorld.copy(camera.matrixWorld); lastProjection.copy(camera.projectionMatrix); lastVisibility = visibility;
      uniforms.wdaFloorIntensity.value = state.intensity;
    } catch (cause) {
      state.errors.push(String(cause?.message || cause)); state.enabled = false; syncMaterials();
    } finally {
      hidden.forEach(([mesh, visible]) => { mesh.visible = visible; });
      renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadowAuto;
      // A successful first capture may have consumed pending shadow invalidation.
      // Do not restore it to true and regenerate the same maps in the main view.
      if (!success) renderer.shadowMap.needsUpdate = shadowNeeds;
      renderer.setRenderTarget(previousTarget); renderer.setViewport(savedViewport); renderer.setScissor(savedScissor); renderer.setScissorTest(scissorTest);
      inCapture = false;
    }
    return success;
  }
  function dispose() {
    if (state.disposed) return;
    for (const [mesh, original] of originals) mesh.material = original;
    for (const mat of materials.values()) mat.dispose();
    capture?.depthTexture?.dispose();
    for (const rt of [capture, ping, blurred]) rt?.dispose();
    blurMaterial.dispose(); blurGeometry.dispose(); materials.clear();
    state.disposed = true; state.ready = false; state.enabled = false;
  }
  state.ready = floorMeshes.length > 0;
  return { state, update, set, resize, syncSurface, dispose };
}
