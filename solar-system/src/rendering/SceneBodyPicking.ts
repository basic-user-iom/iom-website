import { type PerspectiveCamera, Raycaster, Sphere, Vector2, Vector3 } from 'three';
import { bodyLocationOccluded } from './BodyLocationCue';

export interface PickableSceneBody {
  readonly id: string;
  readonly position: Vector3;
  readonly radius: number;
  readonly allowPointPick: boolean;
}

/** One depth-aware hit test for planets, comet nuclei and natural moons. */
export function pickSceneBody(camera: PerspectiveCamera, bodies: readonly PickableSceneBody[],
  x: number, y: number, width: number, height: number, hitSlopPx: number): string | null {
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x > width || y > height) return null;
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
  const intersection = new Vector3();
  let nearest = Infinity, pixelDistance = hitSlopPx;
  let picked: string | null = null, fallback: string | null = null;
  for (const body of bodies) {
    if (ray.ray.intersectSphere(new Sphere(body.position, body.radius), intersection)) {
      const distance = intersection.distanceTo(camera.position);
      if (distance < nearest) { nearest = distance; picked = body.id; }
    }
    if (!body.allowPointPick) continue;
    const ndc = body.position.clone().project(camera);
    if (ndc.z < -1 || ndc.z > 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue;
    const distance = Math.hypot(x - (ndc.x * .5 + .5) * width, y - (-ndc.y * .5 + .5) * height);
    if (distance >= pixelDistance || bodies.some(other => other !== body &&
      bodyLocationOccluded(camera.position, body.position, other.position, other.radius))) continue;
    pixelDistance = distance;
    fallback = body.id;
  }
  return picked ?? fallback;
}
