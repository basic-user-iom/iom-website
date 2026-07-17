/** iq Clouds (Shadertoy XslGRr) adapted for ICM exhibition navigation. */

export const ICM_CLOUD_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export function buildIcmCloudFragmentShader(raySteps: number, simpleLighting = false): string {
  const steps = Math.max(16, Math.min(64, Math.round(raySteps)))
  const difExpr = simpleLighting
    ? 'float dif = 0.38;'
    : 'float dif = clamp((col.w - map(pos + 0.3 * sundir).w) / 0.6, 0.0, 1.0);'

  return /* glsl */ `
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform vec3 iNavigate;
uniform float iMood;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(in vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
    f.z);
}

vec4 map(in vec3 p) {
  float d = 0.2 - p.y;
  vec3 q = p - iNavigate;
  float f;
  f  = 0.5000 * noise(q); q *= 2.02;
  f += 0.2500 * noise(q); q *= 2.03;
  f += 0.1250 * noise(q); q *= 2.01;
  f += 0.0625 * noise(q);
  d += 3.0 * f;
  d = clamp(d, 0.0, 1.0);
  vec4 res = vec4(d);
  res.xyz = mix(1.15 * vec3(1.0, 0.98, 0.96), vec3(0.55, 0.58, 0.62), res.x);
  return res;
}

vec4 raymarch(in vec3 ro, in vec3 rd, in vec3 sundir) {
  vec4 sum = vec4(0.0);
  float t = 0.0;

  for (int i = 0; i < ${steps}; i++) {
    if (sum.a > 0.99) continue;
    vec3 pos = ro + t * rd;
    vec4 col = map(pos);
    ${difExpr}
    vec3 lin = vec3(0.65, 0.7, 0.78) * 1.15 + 0.45 * vec3(1.0, 0.85, 0.65) * dif;
    col.xyz *= lin;
    col.a *= 0.4;
    col.rgb *= col.a;
    sum = sum + col * (1.0 - sum.a);
    t += max(0.1, 0.025 * t);
  }

  sum.xyz /= (0.001 + sum.w);
  return clamp(sum, 0.0, 1.0);
}

void main() {
  vec2 q = gl_FragCoord.xy / iResolution.xy;
  vec2 p = -1.0 + 2.0 * q;
  p.x *= iResolution.x / iResolution.y;
  vec2 mo = -1.0 + 2.0 * iMouse / iResolution.xy;
  vec3 sundir = normalize(vec3(-0.6, 0.25 + 0.2 * iMood, 0.45));

  vec3 ro = 4.0 * normalize(vec3(
    cos(2.75 - 3.0 * mo.x),
    0.55 + (mo.y + 1.0) * 0.55,
    sin(2.75 - 3.0 * mo.x)
  ));
  vec3 ta = vec3(0.0, 1.0, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = normalize(cross(ww, uu));
  vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

  vec4 clouds = raymarch(ro, rd, sundir);
  float sun = clamp(dot(sundir, rd), 0.0, 1.0);

  // Mood: 0 dawn rose, 0.33 midday blue, 0.66 storm grey, 1 dusk gold
  vec3 skyDawn = vec3(0.72, 0.62, 0.68);
  vec3 skyDay = vec3(0.45, 0.66, 0.92);
  vec3 skyStorm = vec3(0.38, 0.42, 0.48);
  vec3 skyDusk = vec3(0.78, 0.52, 0.38);
  vec3 sky = mix(skyDawn, skyDay, smoothstep(0.0, 0.33, iMood));
  sky = mix(sky, skyStorm, smoothstep(0.33, 0.66, iMood));
  sky = mix(sky, skyDusk, smoothstep(0.66, 1.0, iMood));
  sky -= rd.y * 0.18 * vec3(0.15, 0.2, 0.28);
  sky += 0.22 * vec3(1.0, 0.9, 0.7) * pow(sun, 8.0);

  vec3 col = mix(sky, clouds.xyz, clouds.w);
  col += 0.08 * vec3(1.0, 0.85, 0.6) * pow(sun, 3.0);
  col = pow(col, vec3(0.95));

  gl_FragColor = vec4(col, 1.0);
}
`
}
