import { Vector3 } from 'three';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';
import { inspectionDistance } from './ObjectInspectionFraming';
export type LessonFraming = { kind: 'orbits'; extentAu: 2 | 6 } | { kind: 'body'; bodyId: 'earth' | 'jupiter' | 'sun' } | { kind: 'seasons' } | { kind: 'moon-system' };
export interface LessonCameraBody { position: Vector3; radius: number }
export function lessonRelevantBodies(framing: LessonFraming): readonly string[] {
  if (framing.kind === 'orbits') return framing.extentAu === 2 ? ['sun', 'earth', 'mars', 'venus', 'mercury'] : ['sun', 'earth', 'jupiter', 'mars', 'venus', 'mercury'];
  if (framing.kind === 'moon-system') return ['earth', 'moon'];
  return [framing.kind === 'seasons' ? 'earth' : framing.bodyId];
}
/** Camera-only teaching composition: physical positions, radii and rotation are untouched. */
export function lessonCameraPose(framing: LessonFraming, bodies: ReadonlyMap<string, LessonCameraBody>, metersPerUnit: number, fov: number, aspect: number) {
  const sun = bodies.get('sun'), earth = bodies.get('earth');
  if (!sun || !earth) return null;
  const up = new Vector3(0, 1, 0);
  let target: Vector3, direction: Vector3, radius: number;
  if (framing.kind === 'orbits') {
    target = sun.position.clone(); direction = new Vector3(0, 1, 0); up.set(0, 0, -1);
    radius = framing.extentAu * ASTRONOMICAL_UNIT_M / metersPerUnit;
  } else if (framing.kind === 'moon-system') {
    const moon = bodies.get('moon'); if (!moon) return null;
    target = earth.position.clone().add(moon.position).multiplyScalar(.5);
    direction = new Vector3(0, 1, 0);
    const towardSun = sun.position.clone().sub(target).setY(0).normalize();
    up.crossVectors(direction, towardSun).normalize();
    radius = earth.position.distanceTo(moon.position) * .56 + earth.radius;
  } else {
    const body = bodies.get(framing.kind === 'seasons' ? 'earth' : framing.bodyId); if (!body) return null;
    target = body.position.clone();
    const sunward = sun.position.clone().sub(target).normalize();
    if (framing.kind === 'seasons') {
      direction = new Vector3().crossVectors(sunward, up).normalize();
    } else if (framing.bodyId === 'sun') direction = new Vector3(1, .18, 1).normalize();
    else direction = sunward.clone().addScaledVector(new Vector3().crossVectors(sunward, up), .42).addScaledVector(up, .12).normalize();
    radius = body.radius * (framing.kind === 'body' && framing.bodyId === 'sun' ? 1.45 : 1.05);
  }
  const distance = inspectionDistance(radius, fov, aspect);
  return { target, position: target.clone().addScaledVector(direction, distance), up };
}
