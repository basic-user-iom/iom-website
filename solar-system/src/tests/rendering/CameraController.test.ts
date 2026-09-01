import { Vector3 } from 'three';

import { CameraController } from '../../rendering/camera/CameraController';
import type {
  CameraBodyTarget,
  CameraUpdateFrame,
} from '../../rendering/camera/CameraTypes';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 });

describe('CameraController', () => {
  it('produces overview, follow, top-down, chase, and free-orbit poses', () => {
    const bodies = new Map<string, CameraBodyTarget>([
      [
        'earth',
        bodyTarget(
          'earth',
          { x: ASTRONOMICAL_UNIT_M, y: 2 * ASTRONOMICAL_UNIT_M, z: 3 * ASTRONOMICAL_UNIT_M },
          { x: 1_000, y: 2_000, z: 3_000 },
          0.5,
        ),
      ],
    ]);
    const controller = new CameraController();
    const baseFrame = frame({ bodies, overviewRadiusRenderUnits: 40, reducedMotion: true });

    controller.update(baseFrame);
    expect(controller.rig.target.toArray()).toEqual([0, 0, 0]);
    expect(controller.rig.position.toArray()).toEqual([0, 22, 88]);

    controller.focusBody('earth', 'body-follow');
    controller.update(baseFrame);
    expect(controller.status.targetAvailable).toBe(true);
    expect(controller.rig.target.toArray()).toEqual([1, 3, -2]);
    expect(controller.rig.position.distanceTo(controller.rig.target)).toBeCloseTo(4, 12);

    controller.setMode('top-down-ecliptic');
    controller.update(baseFrame);
    expect(controller.rig.position.x).toBeCloseTo(1, 12);
    expect(controller.rig.position.z).toBeCloseTo(-2, 12);
    expect(controller.rig.position.y - controller.rig.target.y).toBeCloseTo(58, 12);
    expect(controller.rig.up.toArray()).toEqual([0, 0, -1]);

    controller.setMode('chase');
    controller.update(baseFrame);
    const mappedVelocity = new Vector3(1_000, 3_000, -2_000).normalize();
    const targetAhead = controller.rig.target.clone().sub(new Vector3(1, 3, -2));
    expect(targetAhead.normalize().dot(mappedVelocity)).toBeCloseTo(1, 12);
    const cameraBehind = controller.rig.position.clone().sub(new Vector3(1, 3, -2));
    expect(cameraBehind.dot(mappedVelocity)).toBeLessThan(0);

    const freePosition = new Vector3(7, 8, 9);
    const freeTarget = new Vector3(1, 2, 3);
    controller.setTargetBody(null);
    controller.setMode('free-orbit');
    controller.synchronizeFreeOrbitPose(freePosition, freeTarget);
    controller.update(baseFrame);
    expect(controller.rig.position.toArray()).toEqual(freePosition.toArray());
    expect(controller.rig.target.toArray()).toEqual(freeTarget.toArray());
  });

  it('frames the complete Earth-Moon system from ecliptic north', () => {
    const earthRadius = 0.0017035;
    const moonRadius = 0.0004646;
    const separation = 0.0026695;
    const earthPosition = { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 };
    const bodies = new Map<string, CameraBodyTarget>([
      [
        'earth',
        bodyTarget(
          'earth',
          earthPosition,
          { x: 0, y: 29_780, z: 0 },
          earthRadius,
        ),
      ],
      [
        'moon',
        bodyTarget(
          'moon',
          { x: earthPosition.x + separation * ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
          { x: 0, y: 30_802, z: 0 },
          moonRadius,
        ),
      ],
    ]);
    const controller = new CameraController();

    controller.setMode('earth-moon-system');
    controller.update(frame({ bodies, reducedMotion: true }));

    const framingRadius = (separation + earthRadius + moonRadius) * 0.5;
    const expectedTargetX = 1 + framingRadius - earthRadius;
    expect(controller.status).toMatchObject({
      mode: 'earth-moon-system',
      targetBodyId: 'earth',
      targetAvailable: true,
    });
    expect(controller.rig.target.x).toBeCloseTo(expectedTargetX, 12);
    expect(controller.rig.target.y).toBe(0);
    expect(controller.rig.target.z).toBe(0);
    expect(controller.rig.position.x).toBeCloseTo(expectedTargetX, 12);
    expect(controller.rig.position.y).toBeCloseTo(framingRadius * 3.5, 12);
    expect(controller.rig.position.z).toBe(0);
    expect(controller.rig.up.toArray()).toEqual([0, 0, -1]);
  });

  it('falls back to a valid overview pose when a requested body is unavailable', () => {
    const controller = new CameraController();
    controller.focusBody('missing');
    controller.update(frame({ bodies: new Map(), overviewRadiusRenderUnits: 12 }));

    expect(controller.status).toMatchObject({
      mode: 'body-follow',
      targetBodyId: 'missing',
      targetAvailable: false,
    });
    expect(controller.rig.target.toArray()).toEqual([0, 0, 0]);
    expect(controller.rig.position.length()).toBeGreaterThan(12);
  });

  it('preserves the camera-to-target vector exactly across an origin and scale rebase', () => {
    const neptunePosition = { x: 30 * ASTRONOMICAL_UNIT_M, y: 0, z: 0 };
    const bodies = new Map<string, CameraBodyTarget>([
      ['neptune', bodyTarget('neptune', neptunePosition, { x: 0, y: 5_400, z: 0 })],
    ]);
    const controller = new CameraController();
    controller.focusBody('neptune');
    controller.update(frame({ bodies }));
    const offsetBefore = controller.rig.position.clone().sub(controller.rig.target);

    controller.update(
      frame({
        bodies,
        metersPerRenderUnit: ASTRONOMICAL_UNIT_M / 2,
        originM: neptunePosition,
        originRevision: 1,
        realDeltaSeconds: 0,
      }),
    );
    const offsetAfter = controller.rig.position.clone().sub(controller.rig.target);

    expect(controller.rig.target.length()).toBeLessThan(1e-14);
    expect(offsetAfter.distanceTo(offsetBefore.clone().multiplyScalar(2))).toBeLessThan(1e-14);
  });

  it('keeps Neptune follow stable while the floating origin rebases every frame', () => {
    const controller = new CameraController({ responseTimeSeconds: 0.3 });
    controller.focusBody('neptune');
    const position = {
      x: 29.9 * ASTRONOMICAL_UNIT_M,
      y: -0.6 * ASTRONOMICAL_UNIT_M,
      z: 0.8 * ASTRONOMICAL_UNIT_M,
    };
    const velocity = { x: 5_100, y: 3_200, z: -800 };
    const bodies = new Map<string, CameraBodyTarget>();
    bodies.set('neptune', bodyTarget('neptune', position, velocity));
    controller.update(
      frame({ bodies, originM: { ...position }, overviewRadiusRenderUnits: 32 }),
    );
    const stableOffset = controller.rig.position.clone().sub(controller.rig.target);

    for (let frameIndex = 1; frameIndex <= 600; frameIndex += 1) {
      position.x += velocity.x / 60;
      position.y += velocity.y / 60;
      position.z += velocity.z / 60;
      controller.update(
        frame({
          bodies,
          originM: { ...position },
          originRevision: frameIndex,
          overviewRadiusRenderUnits: 32,
        }),
      );
      expect(controller.rig.target.length()).toBeLessThan(1e-13);
    }

    const finalOffset = controller.rig.position.clone().sub(controller.rig.target);
    expect(finalOffset.distanceTo(stableOffset)).toBeLessThan(1e-12);
  });

  it('focuses every giant planet at a physical three-quarter phase angle', () => {
    const sun = bodyTarget('sun', ORIGIN, ORIGIN);
    for (const [index, bodyId] of ['jupiter', 'saturn', 'uranus', 'neptune'].entries()) {
      const positionM = {
        x: (5 + index * 5) * ASTRONOMICAL_UNIT_M,
        y: (index - 1.5) * 0.2 * ASTRONOMICAL_UNIT_M,
        z: index * 0.08 * ASTRONOMICAL_UNIT_M,
      };
      const giant = bodyTarget(bodyId, positionM, ORIGIN, 0.5);
      const bodies = new Map<string, CameraBodyTarget>([['sun', sun], [bodyId, giant]]);
      const controller = new CameraController();
      controller.update(frame({ bodies, reducedMotion: true }));
      controller.focusBody(bodyId);
      controller.update(frame({ bodies, reducedMotion: true }));

      const cameraDirection = controller.rig.position.clone()
        .sub(controller.rig.target)
        .normalize();
      const sunDirection = new Vector3(
        sun.positionM.x - positionM.x,
        sun.positionM.z - positionM.z,
        positionM.y - sun.positionM.y,
      ).normalize();
      const phaseAngleDeg = Math.acos(cameraDirection.dot(sunDirection)) * 180 / Math.PI;
      expect(phaseAngleDeg).toBeCloseTo(52, 10);
    }
  });

  it('hands an in-flight damped pose to free orbit without a jump', () => {
    const bodies = new Map<string, CameraBodyTarget>([
      [
        'earth',
        bodyTarget(
          'earth',
          { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
          { x: 0, y: 29_780, z: 0 },
          0.5,
        ),
      ],
    ]);
    const controller = new CameraController({ responseTimeSeconds: 1 });
    const cameraFrame = frame({ bodies, overviewRadiusRenderUnits: 40 });
    controller.update(cameraFrame);
    controller.focusBody('earth');
    controller.update(cameraFrame);

    const interruptedPosition = controller.rig.position.clone();
    const interruptedTarget = controller.rig.target.clone();
    controller.interruptToFreeOrbit();
    controller.update(cameraFrame);

    expect(controller.status.mode).toBe('free-orbit');
    expect(controller.status.closeUpPresetId).toBeNull();
    expect(controller.rig.position.distanceTo(interruptedPosition)).toBeLessThan(1e-14);
    expect(controller.rig.target.distanceTo(interruptedTarget)).toBeLessThan(1e-14);
  });
});

function bodyTarget(
  bodyId: string,
  positionM: { x: number; y: number; z: number },
  velocityMps: { x: number; y: number; z: number },
  radiusRenderUnits?: number,
): CameraBodyTarget {
  return {
    bodyId,
    positionM,
    velocityMps,
    radiusM: bodyId === 'neptune' ? 24_622_000 : 6_371_008.4,
    radiusRenderUnits,
    visible: true,
  };
}

function frame(
  overrides: Partial<CameraUpdateFrame> & Pick<CameraUpdateFrame, 'bodies'>,
): CameraUpdateFrame {
  return {
    realDeltaSeconds: 1 / 60,
    originM: ORIGIN,
    originRevision: 0,
    metersPerRenderUnit: ASTRONOMICAL_UNIT_M,
    overviewRadiusRenderUnits: 32,
    ...overrides,
  };
}
