/**

 * iq "Clouds" — Shadertoy XslGRr (https://www.shadertoy.com/view/XslGRr)

 * Adapted for Three.js fullscreen quad with dark cinematic / cyan accent grading.

 */



/** Shader-space cloud altitude band (map() uses 0.2 - p.y; target ~1.0). */

export const HERO_CLOUD_LAYER_Y_MIN = 0.85

export const HERO_CLOUD_LAYER_Y_MAX = 2.0



/** Raven world Y that maps into the cloud band above. */

export const HERO_RAVEN_CLOUD_Y_CENTER = 0.14

export const HERO_RAVEN_CLOUD_Y_SPREAD = 0.1



/** Shared orbit wobble for flock (small oscillation on top of linear travel). */

export const HERO_ORBIT_SPEED = 0.28

export const HERO_ORBIT_RADIUS_X = 0.34

export const HERO_ORBIT_RADIUS_Y = 0.09

export const HERO_ORBIT_RADIUS_Z = 0.2



/** Mouse parallax angle shared with shader ro and raven orbit drift. */

export const HERO_PARALLAX_ANGLE_BASE = 2.75

export const HERO_PARALLAX_ANGLE_MOUSE = 3.0



/**

 * Shared travel direction: flock + clouds move left → right on screen.

 * Ravens advance in world +X; shader noise uses negated X (camera sits on -X).

 */

export const HERO_TRAVEL_SPEED = 0.11

export const HERO_TRAVEL_DIR_X = 1

export const HERO_TRAVEL_DIR_Y = 0.02

export const HERO_TRAVEL_DIR_Z = -0.12



/**

 * Raven travel is a smooth ping-pong (not unbounded linear, not raw sin).

 * AMPLITUDE = peak world-unit offset from orbit center on each side.

 * Kept small enough that orbit (±0.34 X) + parallax + drift stay inside the

 * desktop frustum (FOV 42°, z=3.6 → half-height ~1.38, half-width ~1.38·aspect).

 */

export const HERO_TRAVEL_AMPLITUDE = 0.55



/** Pre-scaled drift for iq noise space (matches HERO_TRAVEL_SPEED visually). */

export const HERO_CLOUD_TRAVEL_X = -HERO_TRAVEL_DIR_X * HERO_TRAVEL_SPEED * 3.2

export const HERO_CLOUD_TRAVEL_Y = HERO_TRAVEL_DIR_Y * HERO_TRAVEL_SPEED * 3.2

export const HERO_CLOUD_TRAVEL_Z = HERO_TRAVEL_DIR_Z * HERO_TRAVEL_SPEED * 3.2



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


