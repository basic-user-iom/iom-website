import { Vector2, Vector3, type Texture } from 'three';

/** Shared only by the local Impact Lab passes. No per-frame texture allocation. */
export const impactDepthUniforms = {
  uImpactDepth: { value: null as Texture | null },
  uImpactColor: { value: null as Texture | null },
  uImpactDepthEnabled: { value: 0 },
  uImpactSkyVisibility: { value: 1 },
  uImpactViewport: { value: new Vector2(1, 1) },
  uImpactNear: { value: 0.1 },
  uImpactFar: { value: 1000 },
  uImpactSunView: { value: new Vector3(0, 1, 0) },
  uImpactSunWorld: { value: new Vector3(0, 1, 0) },
};
export const IMPACT_DEPTH_GLSL = `
  uniform sampler2D uImpactDepth;
  uniform sampler2D uImpactColor;
  uniform float uImpactDepthEnabled;
  uniform vec2 uImpactViewport;
  uniform float uImpactNear;
  uniform float uImpactFar;
  uniform vec3 uImpactSunView;
  uniform vec3 uImpactSunWorld;
  float impactViewDepth(float d) {
    // Positive form avoids catastrophic far-near cancellation in AU scenes.
    return uImpactNear*uImpactFar / ((1.0-d)*uImpactFar+d*uImpactNear);
  }
  float impactSceneDepth() {
    return impactViewDepth(texture2D(uImpactDepth,gl_FragCoord.xy/uImpactViewport).r);
  }
`;
