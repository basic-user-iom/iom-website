/** Smooth, seeded spatial noise shared by impact dust and thermal effects. */
export const IMPACT_NOISE_GLSL = `
  float impactHash3(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.3, 0.7));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float impactNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(impactHash3(i), impactHash3(i + vec3(1,0,0)), f.x),
          mix(impactHash3(i + vec3(0,1,0)), impactHash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(impactHash3(i + vec3(0,0,1)), impactHash3(i + vec3(1,0,1)), f.x),
          mix(impactHash3(i + vec3(0,1,1)), impactHash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float impactFbm(vec3 p) {
    return impactNoise(p) * 0.57 + impactNoise(p * 2.03 + 7.1) * 0.29
      + impactNoise(p * 4.07 + 19.3) * 0.14;
  }
`;
