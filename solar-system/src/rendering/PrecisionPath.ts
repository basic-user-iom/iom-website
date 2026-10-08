import { BufferAttribute, BufferGeometry, type Camera, type LineBasicMaterial, LineSegments, type Object3D, PerspectiveCamera, Vector3 } from 'three';

/** CPU doubles survive until after camera subtraction AND frustum clipping.
 * Uploading AU-sized segments first loses metre-sized spacecraft and makes GPU
 * near-plane intersections jump while the camera is damping toward its target.
 */
export class PrecisionPath {
  readonly anchor = new Vector3();
  readonly positions: Float64Array;
  readonly colors: Float32Array;
  readonly segments: Float32Array;
  readonly segmentColors: Float32Array;
  pointCount: number;
  /** Optional display-only gap inside a solid comet nucleus. */
  exclusionSphere: { readonly center: Readonly<Vector3>; readonly radius: number } | null = null;
  private readonly exclusionView = new Vector3();
  private readonly view: Float64Array;
  private readonly planes = new Float64Array(24);

  constructor(capacity: number, private readonly topology: 'strip' | 'segments' = 'strip') {
    this.positions = new Float64Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.view = new Float64Array(capacity * 3);
    this.segments = new Float32Array(Math.max(1, capacity - 1) * 12);
    this.segmentColors = new Float32Array(this.segments.length);
    this.pointCount = capacity;
  }

  /** Returns the number of disjoint, clipped segments in camera/view space. */
  prepare(camera: Camera): number {
    if (!(camera instanceof PerspectiveCamera)) return 0;
    const e = camera.matrixWorldInverse.elements;
    const world = camera.matrixWorld.elements;
    const dx = this.anchor.x - world[12]!;
    const dy = this.anchor.y - world[13]!;
    const dz = this.anchor.z - world[14]!;
    for (let i = 0; i < this.pointCount * 3; i += 3) {
      const x = dx + this.positions[i]!;
      const y = dy + this.positions[i + 1]!;
      const z = dz + this.positions[i + 2]!;
      this.view[i] = e[0]! * x + e[4]! * y + e[8]! * z;
      this.view[i + 1] = e[1]! * x + e[5]! * y + e[9]! * z;
      this.view[i + 2] = e[2]! * x + e[6]! * y + e[10]! * z;
    }
    const p = camera.projectionMatrix.elements;
    // A small lateral margin keeps a wide stroke visible at the viewport edge.
    this.planes.set([
      0, 0, -1, -camera.near, 0, 0, 1, camera.far,
      p[0]!, 0, p[8]! - 1.01, 0, -p[0]!, 0, -p[8]! - 1.01, 0,
      0, p[5]!, p[9]! - 1.01, 0, 0, -p[5]!, -p[9]! - 1.01, 0,
    ]);
    const exclusion = this.exclusionSphere;
    if (exclusion !== null) this.exclusionView.copy(exclusion.center).applyMatrix4(camera.matrixWorldInverse);
    let count = 0;
    for (let i = 3; i < this.pointCount * 3; i += this.topology === 'segments' ? 6 : 3) {
      const a = i - 3;
      let start = 0;
      let end = 1;
      if (!Number.isFinite(this.view[a]! + this.view[a + 1]! + this.view[a + 2]!
        + this.view[i]! + this.view[i + 1]! + this.view[i + 2]!)) continue;
      for (let plane = 0; plane < 24; plane += 4) {
        const x = this.planes[plane]!;
        const y = this.planes[plane + 1]!;
        const z = this.planes[plane + 2]!;
        const w = this.planes[plane + 3]!;
        const da = x * this.view[a]! + y * this.view[a + 1]! + z * this.view[a + 2]! + w;
        const db = x * this.view[i]! + y * this.view[i + 1]! + z * this.view[i + 2]! + w;
        if (da < 0 && db < 0) { end = -1; break; }
        if (da < 0) start = Math.max(start, da / (da - db));
        else if (db < 0) end = Math.min(end, da / (da - db));
        if (start > end) break;
      }
      if (start > end) continue;
      if (exclusion === null || exclusion.radius <= 0) { count = this.emitSegment(a,i,start,end,count); continue; }
      const ax = this.view[a]! - this.exclusionView.x;
      const ay = this.view[a+1]! - this.exclusionView.y;
      const az = this.view[a+2]! - this.exclusionView.z;
      const vx = this.view[i]! - this.view[a]!;
      const vy = this.view[i+1]! - this.view[a+1]!;
      const vz = this.view[i+2]! - this.view[a+2]!;
      const length = Math.hypot(vx,vy,vz);
      if (length === 0) { count = this.emitSegment(a,i,start,end,count); continue; }
      const ux = vx/length, uy = vy/length, uz = vz/length;
      const along = -(ax*ux+ay*uy+az*uz);
      const closest = Math.hypot(ax+along*ux,ay+along*uy,az+along*uz);
      if (closest >= exclusion.radius) { count = this.emitSegment(a,i,start,end,count); continue; }
      const half = Math.sqrt((exclusion.radius-closest)*(exclusion.radius+closest));
      const enter = (along-half)/length, leave = (along+half)/length;
      if (leave <= start || enter >= end) count = this.emitSegment(a,i,start,end,count);
      else { count = this.emitSegment(a,i,start,Math.min(end,enter),count); count = this.emitSegment(a,i,Math.max(start,leave),end,count); }

    }
    return count;
  }
  private emitSegment(a: number, i: number, from: number, to: number, count: number): number {
    if (to <= from) return count;
    for (let component = 0; component < 3; component += 1) {
      const av = this.view[a + component]!;
      const bv = this.view[i + component]!;
      const ac = this.colors[a + component]!;
      const bc = this.colors[i + component]!;
      this.segments[count * 6 + component] = stableLerp(av, bv, from);
      this.segments[count * 6 + 3 + component] = stableLerp(av, bv, to);
      this.segmentColors[count * 6 + component] = stableLerp(ac, bc, from);
      this.segmentColors[count * 6 + 3 + component] = stableLerp(ac, bc, to);
    }
    return count + 1;
  }

}

function stableLerp(a: number, b: number, t: number): number {
  return t <= 0.5 ? a + (b - a) * t : b + (a - b) * (1 - t);
}

/** Thin moon/spacecraft paths share the same precision pipeline as planet lines. */
export class PrecisionLine extends LineSegments<BufferGeometry, LineBasicMaterial> {
  readonly path: PrecisionPath;

  constructor(points: number, material: LineBasicMaterial, topology: 'strip' | 'segments' = 'strip') {
    const path = new PrecisionPath(points, topology);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(path.segments, 3));
    if (material.vertexColors) geometry.setAttribute('color', new BufferAttribute(path.segmentColors, 3));
    geometry.setDrawRange(0, 0);
    material.depthWrite = false;
    material.toneMapped = false;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        'vec4 mvPosition = vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;');
    };
    material.customProgramCacheKey = () => 'precision-path-view-space-v1';
    super(geometry, material);
    this.path = path;
    this.frustumCulled = false;
    registerPrecisionPath(this, (camera) => {
      const segments = path.prepare(camera);
      geometry.setDrawRange(0, segments * 2);
      geometry.getAttribute('position').needsUpdate = true;
      if (material.vertexColors) geometry.getAttribute('color').needsUpdate = true;
    });
  }
}

const preparations = new WeakMap<Object3D, (camera: Camera) => void>();
export function registerPrecisionPath(object: Object3D, prepare: (camera: Camera) => void): void {
  preparations.set(object, prepare);
}
/** Call from Scene.onBeforeRender: object.onBeforeRender is AFTER buffer upload. */
export function preparePrecisionPaths(root: Object3D, camera: Camera): void {
  root.traverseVisible((object) => preparations.get(object)?.(camera));
}
