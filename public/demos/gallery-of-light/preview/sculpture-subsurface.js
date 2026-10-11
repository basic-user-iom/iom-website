import * as THREE from 'three';
import { physicalSurface } from './material-transitions.js';

/**
 * Fast, local subsurface study adapted from the MIT-licensed Three.js example:
 * https://threejs.org/examples/webgl_materials_subsurface_scattering.html
 * Distorted-light backscatter is evaluated after the normal light shadow test.
 * Physical transmission shows the actual scene behind the relief, with opaque
 * depth writing (no alpha overlay). A local shader backlight makes the warm
 * scatter legible without changing lighting anywhere else in the gallery.
 * Thickness and the local backlight are artistic approximations, not a measured
 * thickness map or path-traced volume. Source shadow casting remains unchanged;
 * WebGL's shadow map does not model colored transmitted shadows.
 * Only this private material is changed; source maps, geometry and UVs are borrowed.
 */
export function createSubsurfaceSurface(source) {
  const surface = physicalSurface(source, `${source.name}_runtime_B002_subsurface`);
  const material = surface.material;
  const preparePhysicalShader = material.onBeforeCompile;
  material.opacity = 1;
  material.transparent = false;
  material.depthWrite = true;
  const uniforms = {
    iomSubsurfaceBlend: { value: 0 },
    iomSubsurfaceAmount: { value: 1 },
    iomSubsurfaceThickness: { value: .65 },
    iomSubsurfaceDistortion: { value: .35 },
    iomSubsurfacePower: { value: 2 },
    iomSubsurfaceColor: { value: new THREE.Color('#ff985c') },
    iomSubsurfaceLight: { value: 1.8 },
  };
  const declarations = `
uniform float iomSubsurfaceBlend;
uniform float iomSubsurfaceAmount;
uniform float iomSubsurfaceThickness;
uniform float iomSubsurfaceDistortion;
uniform float iomSubsurfacePower;
uniform vec3 iomSubsurfaceColor;
uniform float iomSubsurfaceLight;
float iomOpticalTransmission(vec3 normal, vec3 viewDir) {
  float edge = 1.0 - abs(dot(normal, viewDir));
  return exp(-iomSubsurfaceThickness * mix(1.6, 0.55, edge * edge));
}
void iomDirectScattering(const in IncidentLight light, const in vec3 normal,
  const in vec3 viewDir, inout ReflectedLight reflectedLight) {
  vec3 distortedDirection = normalize(light.direction + normal * iomSubsurfaceDistortion);
  float backscatter = pow(saturate(dot(viewDir, -distortedDirection)), iomSubsurfacePower);
  float wrappedLight = saturate((dot(normal, light.direction) + iomSubsurfaceDistortion) / (1.0 + iomSubsurfaceDistortion));
  float transmission = iomOpticalTransmission(normal, viewDir);
  vec3 scattered = iomSubsurfaceColor * transmission * (backscatter * 3.0 + wrappedLight * 0.3);
  reflectedLight.directDiffuse += scattered * light.color * iomSubsurfaceBlend * iomSubsurfaceAmount * RECIPROCAL_PI;
}
`;
  material.onBeforeCompile = shader => {
    preparePhysicalShader(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_pars_begin>', '#include <lights_pars_begin>\n' + declarations);
    const directCall = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
    const lighting = THREE.ShaderChunk.lights_fragment_begin.replaceAll(directCall,
      directCall + '\n iomDirectScattering(directLight, geometryNormal, geometryViewDir, reflectedLight);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lighting);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      float iomTransmission = iomOpticalTransmission(geometryNormal, geometryViewDir);
      float iomAmount = iomSubsurfaceBlend * iomSubsurfaceAmount;
      // Redistribute a fraction of diffuse light through the warm medium.
      reflectedLight.indirectDiffuse *= mix(vec3(1.0), mix(vec3(1.0), iomSubsurfaceColor * 2.0, 0.7), saturate(iomAmount * 0.3));
      #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
        vec3 iomBackIrradiance = getIBLIrradiance(-geometryNormal);
        float iomEdge = 1.0 - abs(dot(geometryNormal, geometryViewDir));
        float iomEdgeFocus = pow(saturate(iomEdge + iomSubsurfaceDistortion * 0.4), iomSubsurfacePower);
        reflectedLight.indirectDiffuse += iomBackIrradiance * iomSubsurfaceColor * iomTransmission * iomAmount * (0.12 + 1.1 * iomEdgeFocus) * RECIPROCAL_PI;
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', `#include <transmission_fragment>
      // A fixed world-space soft backlight evaluated on B2 only. Keep it after
      // transmission so optical transparency does not erase the scattered light.
      vec3 iomLocalLight = normalize((viewMatrix * vec4(-0.9, 0.55, 0.35, 0.0)).xyz);
      vec3 iomLocalDistorted = normalize(iomLocalLight + geometryNormal * iomSubsurfaceDistortion);
      float iomLocalBackscatter = pow(saturate(dot(geometryViewDir, -iomLocalDistorted)), iomSubsurfacePower);
      float iomLocalEdge = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 1.4);
      vec3 iomGlow = iomSubsurfaceColor * iomOpticalTransmission(geometryNormal, geometryViewDir)
        * (0.025 + 0.25 * iomLocalBackscatter + 0.85 * iomLocalEdge);
      totalDiffuse += iomGlow * iomSubsurfaceBlend * iomSubsurfaceAmount * iomSubsurfaceLight;
    `);
  };
  material.customProgramCacheKey = () => 'iom-B002-transmissive-subsurface-v2';
  return {
    material,
    uniforms,
    apply(strength, options) {
      uniforms.iomSubsurfaceBlend.value = strength;
      uniforms.iomSubsurfaceAmount.value = options.amount;
      uniforms.iomSubsurfaceThickness.value = options.thickness;
      uniforms.iomSubsurfaceDistortion.value = options.distortion;
      uniforms.iomSubsurfacePower.value = options.power;
      uniforms.iomSubsurfaceColor.value.set(options.color);
      uniforms.iomSubsurfaceLight.value = options.lightIntensity;
      surface.apply(strength, { color: '#fff3e6', roughness: .18, metalness: 0,
        envMapIntensity: 1.2, normalStrength: .35,
        transmission: options.translucency, ior: 1.32 });
      material.thickness = .04 + options.thickness * .08;
      material.attenuationColor.set('#ffe7cd');
      material.attenuationDistance = 2.5;
    },
  };
}
