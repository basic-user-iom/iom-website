/** Bounded clear-sky reflection for Earth water, in linear color.
 * The albedo map contains nearly black deep ocean; it is not reflected sky.
 * Shared by the globe and the displaced impact water to avoid a dark seam. */
export const EARTH_OCEAN_REFLECTION_GLSL = /* glsl */ `
  vec3 earthOceanSkyReflection(vec3 normal, vec3 eye, float solarCosine, float occlusion, float irradiance) {
    float mu = clamp(dot(normal, eye), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - mu, 5.0);
    vec3 reflected = reflect(-eye, normal);
    float skyHeight = clamp(dot(reflected, normal), 0.0, 1.0);
    vec3 sky = mix(vec3(0.36, 0.43, 0.50), vec3(0.08, 0.20, 0.38), sqrt(skyHeight));
    float daylight = smoothstep(-0.08, 0.12, solarCosine) * (0.12 + 0.88 * max(solarCosine, 0.0));
    return sky * fresnel * daylight * clamp(occlusion, 0.0, 1.0) * irradiance;
  }
`;
