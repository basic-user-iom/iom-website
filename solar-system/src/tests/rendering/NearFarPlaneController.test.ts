import { PerspectiveCamera, Vector3 } from 'three';

import {
  NearFarPlaneController,
  calculateNearFarPlanes,
} from '../../rendering/camera/NearFarPlaneController';

describe('NearFarPlaneController', () => {
  it('contains visible bounds while keeping the focused surface ahead of near', () => {
    const planes = calculateNearFarPlanes({
      cameraPosition: new Vector3(0, 0, 10),
      focusCenter: new Vector3(),
      focusRadius: 1,
      visibleSpheres: [
        { center: new Vector3(0, 0, -100), radius: 5 },
      ],
    });

    expect(planes.far).toBeGreaterThanOrEqual(132.25);
    expect(planes.near).toBeGreaterThan(0);
    expect(planes.near).toBeLessThan(9);
  });

  it('moves near close enough for a surface approach', () => {
    const planes = calculateNearFarPlanes({
      cameraPosition: new Vector3(0, 0, 1.001),
      focusCenter: new Vector3(),
      focusRadius: 1,
    });

    expect(planes.near).toBeLessThanOrEqual(0.001 * 0.45 + 1e-12);
    expect(planes.far).toBeGreaterThan(planes.near);
  });

  it('keeps a physical-scale ISS close-up ahead of the near plane', () => {
    const radius = 1.8e-8;
    const distance = radius * 3.5;
    const planes = calculateNearFarPlanes(
      {
        cameraPosition: new Vector3(0, 0, distance),
        focusCenter: new Vector3(),
        focusRadius: radius,
      },
      { minimumNear: 1e-12, minimumFar: 800 },
    );

    expect(planes.near).toBeLessThan(distance - radius);
    expect(planes.near).toBeGreaterThanOrEqual(1e-12);
  });

  it('expands immediately to avoid clipping and damps precision-only tightening', () => {
    const controller = new NearFarPlaneController({
      minimumFar: 1,
      tightenResponseTimeSeconds: 0.5,
    });
    const cameraPosition = new Vector3(0, 0, 10);
    const focusCenter = new Vector3();
    const initial = controller.update({ cameraPosition, focusCenter, focusRadius: 1 }, 1 / 60);
    const expanded = controller.update(
      {
        cameraPosition,
        focusCenter,
        focusRadius: 1,
        visibleSpheres: [{ center: new Vector3(0, 0, -1_000), radius: 10 }],
      },
      1 / 60,
    );
    const tightening = controller.update(
      { cameraPosition, focusCenter, focusRadius: 1 },
      1 / 60,
    );

    expect(expanded.far).toBeGreaterThan(1_000);
    expect(tightening.far).toBeGreaterThan(initial.far);
    expect(tightening.far).toBeLessThan(expanded.far);
  });

  it('updates a Three.js projection camera only through the controller state', () => {
    const controller = new NearFarPlaneController();
    controller.update(
      {
        cameraPosition: new Vector3(0, 0, 8),
        focusCenter: new Vector3(),
        focusRadius: 1,
      },
      0,
    );
    const camera = new PerspectiveCamera();
    const projectionBefore = camera.projectionMatrix.clone();
    controller.applyTo(camera);

    expect(camera.near).toBe(controller.snapshot().near);
    expect(camera.far).toBe(controller.snapshot().far);
    expect(camera.projectionMatrix.equals(projectionBefore)).toBe(false);
  });
});
