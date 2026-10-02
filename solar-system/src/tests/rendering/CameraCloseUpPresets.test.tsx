import { renderToStaticMarkup } from 'react-dom/server';
import { Quaternion, Vector3 } from 'three';

import {
  CAMERA_CLOSE_UP_PRESETS,
  CameraController,
  JUPITER_GREAT_RED_SPOT_VISUAL_LATITUDE_DEG,
  SATURN_RING_PRESET_VISUAL_LATITUDE_DEG,
  getCameraCloseUpPreset,
  type CameraBodyTarget,
  type CameraUpdateFrame,
} from '../../rendering/camera';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';
import { ViewControls } from '../../ui/observatory/ViewControls';

const ORIGIN = Object.freeze({ x: 0, y: 0, z: 0 });

describe('Phase 5 close-up camera presets', () => {
  it('declares stable visual-sphere-local configurations for Jupiter and Saturn', () => {
    expect(CAMERA_CLOSE_UP_PRESETS.map((preset) => preset.id)).toEqual([
      'jupiter-great-red-spot',
      'saturn-rings',
      'saturn-from-earth',
    ]);
    expect(CAMERA_CLOSE_UP_PRESETS.map((preset) => preset.bodyId)).toEqual([
      'jupiter',
      'saturn',
      'saturn',
    ]);
    for (const preset of CAMERA_CLOSE_UP_PRESETS) {
      expect(vectorLength(preset.cameraDirectionVisualLocal)).toBeCloseTo(1, 12);
      expect(vectorLength(preset.upDirectionVisualLocal)).toBeCloseTo(1, 12);
      expect(preset.distanceRadiusMultiplier).toBeGreaterThan(2);
      expect(Object.isFrozen(preset)).toBe(true);
    }
    expect(
      getCameraCloseUpPreset('jupiter-great-red-spot').cameraDirectionVisualLocal.y,
    ).toBeCloseTo(
      Math.sin(JUPITER_GREAT_RED_SPOT_VISUAL_LATITUDE_DEG * Math.PI / 180),
      12,
    );
    expect(
      getCameraCloseUpPreset('saturn-rings').cameraDirectionVisualLocal.y,
    ).toBeCloseTo(
      Math.sin(SATURN_RING_PRESET_VISUAL_LATITUDE_DEG * Math.PI / 180),
      12,
    );
  });

  it('tracks a preset direction through the target body orientation', () => {
    const orientation = new Quaternion();
    const jupiter = bodyTarget('jupiter', 2, orientation);
    const bodies = new Map<string, CameraBodyTarget>([['jupiter', jupiter]]);
    const controller = new CameraController();
    const preset = getCameraCloseUpPreset('jupiter-great-red-spot');

    controller.applyCloseUpPreset(preset.id);
    controller.update(frame(bodies));
    let offset = controller.rig.position.clone().sub(controller.rig.target);
    expect(controller.status).toMatchObject({
      mode: 'body-follow',
      targetBodyId: 'jupiter',
      targetAvailable: true,
      closeUpPresetId: preset.id,
    });
    expect(offset.length()).toBeCloseTo(2 * preset.distanceRadiusMultiplier, 12);
    const initialExpectedDirection = new Vector3(
      preset.cameraDirectionVisualLocal.x,
      preset.cameraDirectionVisualLocal.y,
      preset.cameraDirectionVisualLocal.z,
    );
    expect(offset.normalize().distanceTo(initialExpectedDirection)).toBeLessThan(1e-12);

    orientation.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    controller.update(frame(bodies));
    offset = controller.rig.position.clone().sub(controller.rig.target).normalize();
    const expectedDirection = new Vector3(
      preset.cameraDirectionVisualLocal.x,
      preset.cameraDirectionVisualLocal.y,
      preset.cameraDirectionVisualLocal.z,
    ).applyQuaternion(orientation);
    expect(offset.distanceTo(expectedDirection)).toBeLessThan(1e-12);

    controller.setMode('body-follow');
    expect(controller.status.closeUpPresetId).toBeNull();
  });

  it('frames Saturn far enough away to include the ring plane', () => {
    const saturn = bodyTarget('saturn', 1.5, new Quaternion());
    const controller = new CameraController();
    const preset = getCameraCloseUpPreset('saturn-rings');

    controller.applyCloseUpPreset(preset.id);
    controller.update(frame(new Map([['saturn', saturn]])));

    const offset = controller.rig.position.clone().sub(controller.rig.target);
    expect(controller.status).toMatchObject({
      targetBodyId: 'saturn',
      closeUpPresetId: 'saturn-rings',
    });
    expect(offset.length()).toBeCloseTo(1.5 * preset.distanceRadiusMultiplier, 12);
    expect(offset.y).toBeGreaterThan(0);
    expect(offset.z).toBeGreaterThan(0);
  });

  it('follows the geometric Earth sightline independently of Saturn spin and scene origin', () => {
    const orientation = new Quaternion();
    const saturn = bodyTarget('saturn', 1.5, orientation);
    const earth = bodyTarget('earth', 0.1, new Quaternion());
    Object.assign(earth.positionM, { x: 0, y: ASTRONOMICAL_UNIT_M, z: ASTRONOMICAL_UNIT_M / 2 });
    const bodies = new Map([['saturn', saturn], ['earth', earth]]);
    const controller = new CameraController();
    controller.applyCloseUpPreset('saturn-from-earth');
    controller.update(frame(bodies));
    const direction = () => controller.rig.position.clone().sub(controller.rig.target).normalize();
    const initial = new Vector3(-1, 0.5, -1).normalize();
    expect(direction().distanceTo(initial)).toBeLessThan(1e-12);
    orientation.setFromAxisAngle(new Vector3(0, 1, 0), 2);
    controller.update({ ...frame(bodies), originM: saturn.positionM, originRevision: 1 });
    expect(direction().distanceTo(initial)).toBeLessThan(1e-12);
    Object.assign(earth.positionM, { y: -ASTRONOMICAL_UNIT_M });
    controller.update(frame(bodies));
    expect(direction().distanceTo(new Vector3(-1, 0.5, 1).normalize())).toBeLessThan(1e-12);
    expect(controller.status.closeUpPresetId).toBe('saturn-from-earth');
  });

  it('renders accessible controls for all presets', () => {
    const markup = renderToStaticMarkup(
      <ViewControls
        cameraMode="body-follow"
        activeCloseUpPresetId="saturn-rings"
        renderScaleMode="presentation"
        presentationWarningRequired
        selectedTrailInterval="previous"
        onCameraModeChange={() => undefined}
        onRenderScaleModeChange={() => undefined}
        onCloseUpPresetSelect={() => undefined}
        onSelectedTrailIntervalChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="camera-close-up-presets"');
    expect(markup).toContain('data-testid="camera-preset-saturn-from-earth"');
    expect(markup).toContain('follows the selected date, not today');
    expect(markup).toContain('data-testid="camera-preset-jupiter-great-red-spot"');
    expect(markup).toContain(
      'aria-pressed="true" data-testid="camera-preset-saturn-rings"',
    );
  });
});

function bodyTarget(
  bodyId: string,
  radiusRenderUnits: number,
  visualLocalToScene: Quaternion,
): CameraBodyTarget {
  return {
    bodyId,
    positionM: { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
    velocityMps: { x: 0, y: 10_000, z: 0 },
    radiusM: 69_911_000,
    radiusRenderUnits,
    visualLocalToScene,
    visible: true,
  };
}

function frame(bodies: ReadonlyMap<string, CameraBodyTarget>): CameraUpdateFrame {
  return {
    realDeltaSeconds: 1 / 60,
    originM: ORIGIN,
    originRevision: 0,
    metersPerRenderUnit: ASTRONOMICAL_UNIT_M,
    overviewRadiusRenderUnits: 32,
    reducedMotion: true,
    bodies,
  };
}

function vectorLength(vector: Readonly<{ x: number; y: number; z: number }>): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}
