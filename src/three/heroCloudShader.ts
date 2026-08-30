/**

 * iq "Clouds" — Shadertoy XslGRr (https://www.shadertoy.com/view/XslGRr)

 * Adapted for Three.js fullscreen quad with dark cinematic / cyan accent grading.

 */



/** Shader-space cloud altitude band (map() uses 0.2 - p.y; target ~1.0). */

export const HERO_CLOUD_LAYER_Y_MIN = 0.85

export const HERO_CLOUD_LAYER_Y_MAX = 2.0



/** Shared camera used by both the raymarched clouds and Three.js ravens. */
export const HERO_CAMERA_RADIUS = 4
export const HERO_CAMERA_INPUT_Y_BASE = 1.7
export const HERO_CAMERA_TARGET_Y = 1
export const HERO_CAMERA_FOCAL_LENGTH = 1.5



export const HERO_CLOUD_VERTEX_SHADER = /* glsl */ `

varying vec2 vUv;



void main() {

  vUv = uv;

  gl_Position = vec4(position.xy, 0.0, 1.0);

}

`



import { buildHeroCloudFragmentShader } from './buildCloudFragmentShader'

/** Desktop default — mobile uses fewer steps via buildHeroCloudFragmentShader(). */
export const HERO_CLOUD_FRAGMENT_SHADER = buildHeroCloudFragmentShader(40)


