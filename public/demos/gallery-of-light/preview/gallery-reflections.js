import * as THREE from 'three';
import { getGalleryQuality } from './gallery-quality.js';

// Planar camera/oblique clipping follows Three.js Reflector (MIT, vendor/LICENSE).
// This is a blurred planar reflection for the flat gallery floor, not WebGPU SSR.
export function createGalleryReflections({ renderer, scene, galleryModel, camera }) {
  const state = { ready: false, enabled: true, intensity: 0.28, roughness: 0.38,
    method: 'Depth-aware planar floor specular (WebGL)', depthAwareBlur: true,
    specularSource: 'Occluded planar capture only; source floor diffuse and direct lighting retained',
    floorShadowNormalBiasCap: 0.005,
    renders: 0, bufferSize: [0, 0],
    floorY: null, floorMeshes: 0, errors: [], disposed: false };
  const floors = [], originals = new Map(), materials = new Map();
  galleryModel.traverse(object => {
    if (/^ai66_Floor_[AB]$/.test(object.name)) object.traverse(mesh => {
      if (mesh.isMesh && !originals.has(mesh)) { floors.push(mesh); originals.set(mesh, mesh.material); }
    });
  });
  const bounds = new THREE.Box3();
  for (const mesh of floors) {
    mesh.updateWorldMatrix(true, false);
    bounds.union(new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position')).applyMatrix4(mesh.matrixWorld));
  }
  if (!floors.length) { state.errors.push('No gallery floor found for reflections.'); state.enabled = false; }
  state.floorY = floors.length ? bounds.max.y : 0; state.floorMeshes = floors.length;
  const planePoint = new THREE.Vector3(0, state.floorY, 0), normal = new THREE.Vector3(0, 1, 0);
  const mirroredCamera = camera.clone(), cameraPosition = new THREE.Vector3();
  const rotation = new THREE.Matrix4(), view = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3();
  const clipPlane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const textureMatrix = new THREE.Matrix4(), viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const size = new THREE.Vector2(), savedViewport = new THREE.Vector4(), savedScissor = new THREE.Vector4();
  let capture = null, ping = null, blurred = null, inCapture = false;
  const uniforms = { iomFloorReflection: { value: null }, iomFloorMatrix: { value: textureMatrix },
    iomFloorIntensity: { value: 0 }, iomFloorRoughness: { value: state.roughness } };
  const blurUniforms = { tInput: { value: null }, tDepth: { value: null },
    uStep: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2() },
    uInverseProjection: { value: mirroredCamera.projectionMatrixInverse } };
  const blurMaterial = new THREE.ShaderMaterial({
    name: 'runtime_floor_reflection_blur', uniforms: blurUniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tInput; uniform sampler2D tDepth;
      uniform vec2 uStep; uniform vec2 uSize; uniform mat4 uInverseProjection; varying vec2 vUv;
      float viewDepth(vec2 uv,float depth){
        // The mirror has an oblique near plane: near/far-only depth formulas are invalid.
        vec4 point=uInverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
        return abs(point.z/point.w);
      }
      void main(){
        vec2 center=(floor(vUv*uSize)+0.5)/uSize;
        float centerDepth=texture2D(tDepth,center).r;
        float centerZ=viewDepth(center,centerDepth);
        vec4 sum=vec4(0.0); float weightSum=0.0;
        for(int i=-4;i<=4;i++){
          // Sample texel centers: bilinear taps would themselves cross silhouettes.
          vec2 uv=(floor(clamp(center+uStep*float(i),vec2(0.0),vec2(0.999999))*uSize)+0.5)/uSize;
          float depth=texture2D(tDepth,uv).r;
          float background=step(0.999999,depth), centerBackground=step(0.999999,centerDepth);
          float sameLayer=1.0-step(0.5,abs(background-centerBackground));
          if(centerBackground<0.5) sameLayer*=1.0-step(max(0.025,centerZ*0.01),abs(viewDepth(uv,depth)-centerZ));
          float weight=exp(-float(i*i)/4.5)*sameLayer;
          sum+=texture2D(tInput,uv)*weight; weightSum+=weight;
        }
        gl_FragColor=sum/max(weightSum,0.00001);
      }`,
  });
  const blurScene = new THREE.Scene(), blurCamera = new THREE.Camera(), blurGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(blurGeometry, blurMaterial); quad.frustumCulled = false; blurScene.add(quad);
  const array = value => Array.isArray(value) ? value : [value];
  function replacement(source) {
    if (materials.has(source)) return materials.get(source);
    const copy = source.clone(); copy.name = `${source.name}_runtime_floor_reflections`;
    copy.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'uniform mat4 iomFloorMatrix; varying vec4 iomFloorUV;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\niomFloorUV = iomFloorMatrix * modelMatrix * vec4(transformed, 1.0);');
      // Flat floor receivers need a smaller normal offset than wall surfaces:
      // at the low HDR sun, a large offset visibly detaches contact shadows.
      shader.vertexShader = shader.vertexShader.replace('#include <shadowmap_vertex>',
        THREE.ShaderChunk.shadowmap_vertex.replaceAll('directionalLightShadows[ i ].shadowNormalBias',
          'min( directionalLightShadows[ i ].shadowNormalBias, 0.005 )'));
      shader.fragmentShader = `uniform sampler2D iomFloorReflection; uniform float iomFloorIntensity;
        uniform float iomFloorRoughness; varying vec4 iomFloorUV;\n` + shader.fragmentShader;
      // Replace only indirect specular radiance before the existing physical BRDF.
      // Mixing outgoingLight would leave the unoccluded HDR highlight underneath
      // while also tinting diffuse/direct light. Sky diffuse illumination is retained.
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', `
        #include <lights_fragment_maps>
        #if defined(RE_IndirectSpecular)
        vec2 iomUV = iomFloorUV.xy / max(iomFloorUV.w, 0.00001);
        vec2 iomEdge = smoothstep(vec2(0.0),vec2(0.035),iomUV) * (1.0-smoothstep(vec2(0.965),vec2(1.0),iomUV));
        float iomWeight = iomFloorIntensity*iomEdge.x*iomEdge.y*step(0.0,iomFloorUV.w);
        radiance = texture2D(iomFloorReflection,clamp(iomUV,0.0,1.0)).rgb*iomWeight;
        #ifdef USE_CLEARCOAT
          clearcoatRadiance = radiance;
        #endif
        #endif`);
      // The physical shader's broad multiple-scattering specular lobe otherwise
      // still uses the unoccluded sky irradiance. Feed it the local planar sample;
      // retain its Fresnel/roughness terms and leave indirect diffuse untouched.
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'indirectSpecular += multiScattering * cosineWeightedIrradiance;',
          'indirectSpecular += multiScattering * radiance;'));
    };
    copy.customProgramCacheKey = () => 'iom-planar-floor-specular-depth-v2';
    materials.set(source, copy); return copy;
  }
  function syncMaterials() {
    const active = state.enabled && state.intensity > 0;
    uniforms.iomFloorIntensity.value = active ? state.intensity : 0;
    uniforms.iomFloorRoughness.value = state.roughness;
    // OFF/zero suppresses floor reflection rather than restoring the leaking HDR
    // specular. Exact imported material references are restored only on disposal.
    for (const [mesh, original] of originals) mesh.material =
      Array.isArray(original) ? array(original).map(replacement) : replacement(original);
  }
  function configure(options = {}) {
    if (state.disposed || !options || typeof options !== 'object') return false;
    if (['intensity','roughness'].some(key => key in options && !Number.isFinite(options[key]))) return false;
    if ('enabled' in options) state.enabled = Boolean(options.enabled);
    for (const key of ['intensity','roughness']) if (key in options) state[key] = THREE.MathUtils.clamp(options[key], 0, 1);
    syncMaterials(); return true;
  }
  function resizeTargets() {
    renderer.getDrawingBufferSize(size);
    const cap = getGalleryQuality(renderer.domElement).reflectionCap;
    const scale = Math.min(0.5, cap / Math.max(size.x, size.y));
    const width = Math.max(1, Math.round(size.x * scale)), height = Math.max(1, Math.round(size.y * scale));
    if (state.bufferSize[0] === width && state.bufferSize[1] === height) return;
    if (!capture) {
      const options = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
      const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
      depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
      capture = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: true, depthTexture });
      ping = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
      blurred = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: false });
    } else for (const rt of [capture,ping,blurred]) rt.setSize(width, height);
    state.bufferSize = [width, height];
    blurUniforms.uSize.value.set(width, height); blurUniforms.tDepth.value = capture.depthTexture;
  }
  function updateCamera(realCamera) {
    realCamera.updateMatrixWorld();
    cameraPosition.setFromMatrixPosition(realCamera.matrixWorld);
    if (cameraPosition.y <= state.floorY + 0.01) return false;
    view.subVectors(planePoint, cameraPosition).reflect(normal).negate().add(planePoint);
    rotation.extractRotation(realCamera.matrixWorld);
    look.set(0,0,-1).applyMatrix4(rotation).add(cameraPosition);
    target.subVectors(planePoint, look).reflect(normal).negate().add(planePoint);
    mirroredCamera.position.copy(view);
    mirroredCamera.up.set(0,1,0).applyMatrix4(rotation).reflect(normal);
    mirroredCamera.lookAt(target); mirroredCamera.far = realCamera.far; mirroredCamera.near = realCamera.near;
    mirroredCamera.layers.mask = realCamera.layers.mask;
    mirroredCamera.updateMatrixWorld(); mirroredCamera.projectionMatrix.copy(realCamera.projectionMatrix);
    textureMatrix.set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1)
      .multiply(mirroredCamera.projectionMatrix).multiply(mirroredCamera.matrixWorldInverse);
    clipPlane.setFromNormalAndCoplanarPoint(normal,planePoint).applyMatrix4(mirroredCamera.matrixWorldInverse);
    clip.set(clipPlane.normal.x,clipPlane.normal.y,clipPlane.normal.z,clipPlane.constant);
    const projection = mirroredCamera.projectionMatrix, p = projection.elements;
    q.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],
      mirroredCamera.isOrthographicCamera ? -realCamera.far : -1,
      mirroredCamera.isOrthographicCamera ? 1 : (1+p[10])/p[14]);
    clip.multiplyScalar(2 / clip.dot(q)); p[2] = clip.x; p[6] = clip.y;
    p[10] = clip.z + (mirroredCamera.isOrthographicCamera ? 0 : 1) - 0.001;
    p[14] = clip.w - (mirroredCamera.isOrthographicCamera ? 1 : 0);
    mirroredCamera.projectionMatrixInverse.copy(projection).invert();
    return true;
  }
  let lastCapture = -Infinity;
  function render(realCamera = camera) {
    if (state.disposed || !state.ready || !state.enabled || state.intensity === 0 || inCapture) return;
    // Keep the old projector matrix with its cached texture between captures.
    // Mobile reflections update at 10 Hz; the main camera remains continuous.
    const now = performance.now();
    if (getGalleryQuality(renderer.domElement).mobile && now - lastCapture < 100) return;
    lastCapture = now;
    realCamera.updateMatrixWorld();
    viewProjection.multiplyMatrices(realCamera.projectionMatrix,realCamera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    if (!frustum.intersectsBox(bounds) || !floors.some(mesh => mesh.visible) || !updateCamera(realCamera)) {
      uniforms.iomFloorIntensity.value = 0; return;
    }
    uniforms.iomFloorIntensity.value = state.intensity;
    resizeTargets(); inCapture = true;
    const previousTarget = renderer.getRenderTarget(), xr = renderer.xr.enabled;
    const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
    const scissorTest = renderer.getScissorTest(); renderer.getViewport(savedViewport); renderer.getScissor(savedScissor);
    const hidden = floors.map(mesh => [mesh,mesh.visible]);
    const caustic = scene.getObjectByName('runtime_F001_caustic_floor_projection'); if (caustic) hidden.push([caustic,caustic.visible]);
    try {
      hidden.forEach(([mesh]) => { mesh.visible = false; });
      renderer.xr.enabled = false;
      // Let pending light maps initialize/update in this first scene pass.
      // Both gallery and study shadows cache per light, so the main view reuses
      // them. Skipping a new map here binds an invalid empty shadow sampler.
      renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.setScissorTest(false); renderer.setRenderTarget(capture); renderer.clear(); renderer.render(scene,mirroredCamera);
      uniforms.iomFloorReflection.value = capture.texture;
      if (state.roughness > 0) {
        const radius = state.roughness * 6;
        blurUniforms.tInput.value = capture.texture; blurUniforms.uStep.value.set(radius / state.bufferSize[0],0);
        renderer.setRenderTarget(ping); renderer.render(blurScene,blurCamera);
        blurUniforms.tInput.value = ping.texture; blurUniforms.uStep.value.set(0,radius / state.bufferSize[1]);
        renderer.setRenderTarget(blurred); renderer.render(blurScene,blurCamera);
        uniforms.iomFloorReflection.value = blurred.texture;
      }
      state.renders++;
    } catch (cause) {
      if (!state.errors.includes(cause.message)) state.errors.push(cause.message);
      state.enabled = false; syncMaterials();
    } finally {
      hidden.forEach(([mesh,visible]) => { mesh.visible = visible; });
      renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
      renderer.setRenderTarget(previousTarget); renderer.setViewport(savedViewport); renderer.setScissor(savedScissor); renderer.setScissorTest(scissorTest);
      inCapture = false;
    }
  }
  function dispose() {
    if (state.disposed) return;
    for (const [mesh,original] of originals) mesh.material = original;
    for (const material of materials.values()) material.dispose();
    for (const rt of [capture,ping,blurred]) rt?.dispose();
    blurMaterial.dispose(); blurGeometry.dispose(); materials.clear();
    state.disposed = true; state.ready = false;
  }
  state.ready = floors.length > 0; syncMaterials();
  return { state, configure, render, dispose };
}
