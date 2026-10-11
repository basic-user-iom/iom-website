import * as THREE from 'three';

// Runtime copies only: source materials, texture objects and geometry stay intact.
export function physicalSurface(source, name) {
  const material = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(material, source);
  material.defines = { STANDARD: '', PHYSICAL: '' };
  material.name = name;
  const blend = { value: 0 };
  const reflectionStrength = { value: 1 };
  material.onBeforeCompile = shader => {
    shader.uniforms.iomSurfaceBlend = blend;
    shader.uniforms.iomReflectionStrength = reflectionStrength;
    shader.fragmentShader = 'uniform float iomSurfaceBlend;\nuniform float iomReflectionStrength;\n' + shader.fragmentShader;
    // Three substitutes scene.environmentIntensity when envMap is inherited.
    // Multiply the inherited lighting in the shader so this local control works
    // without taking the sculpture out of the global HDR lighting transition.
    shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
      THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('envMapIntensity', '(envMapIntensity * iomReflectionStrength)'));
    // Fade the imported texture modulation continuously, so the control values
    // describe the final surface instead of fighting its baked marble texture.
    for (const [chunk, expression] of [
      ['map_fragment', 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuse, iomSurfaceBlend);'],
      ['roughnessmap_fragment', 'roughnessFactor = mix(roughnessFactor, roughness, iomSurfaceBlend);'],
      ['metalnessmap_fragment', 'metalnessFactor = mix(metalnessFactor, metalness, iomSurfaceBlend);'],
    ]) shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, `#include <${chunk}>\n${expression}`);
  };
  material.customProgramCacheKey = () => 'iom-continuous-physical-surface-v2';
  const targetColor = new THREE.Color();
  return {
    material,
    apply(amount, options) {
      blend.value = amount;
      material.color.copy(source.color).lerp(targetColor.set(options.color), amount);
      material.roughness = THREE.MathUtils.lerp(source.roughness, options.roughness, amount);
      material.metalness = THREE.MathUtils.lerp(source.metalness, options.metalness, amount);
      material.envMapIntensity = THREE.MathUtils.lerp(source.envMapIntensity, options.envMapIntensity, amount);
      reflectionStrength.value = material.envMap === null ? material.envMapIntensity : 1;
      material.normalScale.copy(source.normalScale).multiplyScalar(THREE.MathUtils.lerp(1, options.normalStrength, amount));
      material.clearcoat = (options.clearcoat ?? 0) * amount;
      material.clearcoatRoughness = options.clearcoatRoughness ?? 0.2;
      material.transmission = (options.transmission ?? 0) * amount;
      material.ior = THREE.MathUtils.lerp(1.5, options.ior ?? 1.5, amount);
    },
  };
}

export function materialCrossfade({ mesh, original, effect, runtime, rememberMaterial, wireframe = false }) {
  const array = Array.isArray(original);
  const sources = array ? original : [original];
  const faded = wireframe ? sources.map(source => {
    const copy = rememberMaterial(source.clone());
    // Hashed coverage preserves self-occlusion at the start, then gradually
    // reveals rear wires without an invisible solid depth mask at the endpoint.
    copy.transparent = false; copy.depthWrite = true; copy.alphaHash = true;
    return copy;
  }) : sources;
  const top = rememberMaterial(effect.clone());
  top.transparent = true; top.depthWrite = false; top.forceSinglePass = true;
  // The solid refraction overlay shares exact surface depth. Pulling it forward
  // exposes hidden relief triangles and creates a pop at the opaque endpoint.
  top.polygonOffset = wireframe; top.polygonOffsetFactor = -1; top.polygonOffsetUnits = -1;
  // Geometry is borrowed, never put in the runtime geometry disposal list.
  const overlay = new THREE.Mesh(mesh.geometry, array ? sources.map(() => top) : top);
  overlay.name = `${mesh.name}_runtime_transition`;
  // The lit refraction layer must receive active light shadows throughout its
  // fade. The original mesh alone casts; the overlay must not duplicate it.
  overlay.receiveShadow = !wireframe;
  overlay.castShadow = false;
  overlay.matrixAutoUpdate = false; overlay.matrix.copy(mesh.matrixWorld);
  overlay.layers.mask = mesh.layers.mask; overlay.renderOrder = mesh.renderOrder + 2;
  overlay.visible = false; runtime.add(overlay);
  return {
    apply(amount) {
      overlay.visible = amount > 0 && amount < 1;
      if (overlay.visible) {
        overlay.matrix.copy(mesh.matrixWorld);
        top.opacity = amount;
        top.color.copy(effect.color);
        if ('refractionRatio' in effect) top.refractionRatio = effect.refractionRatio;
        if (wireframe) faded.forEach((material, index) => { material.opacity = sources[index].opacity * (1 - amount); });
        mesh.material = array ? faded : faded[0];
      } else mesh.material = amount === 1 ? (array ? sources.map(() => effect) : effect) : original;
    },
  };
}
