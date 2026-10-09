import { Vector3, type MeshStandardMaterial } from 'three';

export interface MoonSunlight {
  readonly directionWorld: { value: Vector3 };
  readonly visibility: { value: number };
}

/**
 * Exposure-normalized sunlight, as for the planets. AU/render-unit distances
 * must not attenuate a moon's surface material. Direction and eclipses still
 * come from the physical ephemeris; this is not a photometric exposure model.
 * Keep Three's PBR textures, normal maps, BRDF and output color management.
 */
export function attachMoonSunlight(material: MeshStandardMaterial): MoonSunlight {
  const light: MoonSunlight = {
    directionWorld: { value: new Vector3(1, 0, 0) },
    visibility: { value: 0 },
  };
  material.onBeforeCompile = shader => {
    shader.uniforms.uMoonSunDirection = light.directionWorld;
    shader.uniforms.uMoonSunVisibility = light.visibility;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uMoonSunDirection;
        uniform float uMoonSunVisibility;`)
      .replace('#include <lights_fragment_begin>', `
        vec3 geometryPosition = -vViewPosition;
        vec3 geometryNormal = normal;
        vec3 geometryViewDir = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        vec3 geometryClearcoatNormal = vec3(0.0);
        IncidentLight directLight;
        directLight.direction = normalize(mat3(viewMatrix) * uMoonSunDirection);
        directLight.color = vec3(3.4) * uMoonSunVisibility;
        directLight.visible = true;
        RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir,
          geometryClearcoatNormal, material, reflectedLight);
        vec3 irradiance = vec3(0.0);
        vec3 iblIrradiance = vec3(0.0);
        vec3 radiance = vec3(0.0);
        vec3 clearcoatRadiance = vec3(0.0);
      `);
  };
  material.customProgramCacheKey = () => 'moon-physical-sun-direction-v1';
  return light;
}

/** Physical inertial coordinates -> the same Y-up scene basis as the planets. */
export function updateMoonSunlight(light: MoonSunlight,
  sunwardM: Readonly<{ x: number; y: number; z: number }>, eclipsed: boolean): void {
  light.directionWorld.value.set(sunwardM.x, sunwardM.z, -sunwardM.y);
  const length = light.directionWorld.value.length();
  light.visibility.value = length > 0 && !eclipsed ? 1 : 0;
  if (length > 0) light.directionWorld.value.multiplyScalar(1 / length);
  else light.directionWorld.value.set(1, 0, 0);
}
