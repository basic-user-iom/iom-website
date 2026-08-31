import {
  AdaptiveResolutionController,
  adaptiveResolutionProfile,
} from '../../rendering/AdaptiveResolutionController';

describe('AdaptiveResolutionController', () => {
  it('degrades after sustained heavy-effect pressure and respects every tier floor', () => {
    for (const quality of ['low', 'medium', 'high', 'ultra'] as const) {
      const controller = new AdaptiveResolutionController(quality);
      for (let frame = 0; frame < 600; frame += 1) {
        controller.sampleFrame(1 / 12, 'black-hole');
      }
      const diagnostics = controller.getDiagnostics();
      expect(diagnostics.resolutionScale).toBe(
        adaptiveResolutionProfile(quality).minimumScale,
      );
      expect(diagnostics.state).toBe('degraded');
      expect(diagnostics.adjustmentCount).toBeGreaterThan(0);
    }
  });

  it('uses hysteresis, recovers slowly, and restores full scale outside heavy effects', () => {
    const controller = new AdaptiveResolutionController('high');
    for (let frame = 0; frame < 90; frame += 1) {
      controller.sampleFrame(1 / 20, 'impact');
    }
    const degraded = controller.scale;
    expect(degraded).toBeLessThan(1);

    for (let frame = 0; frame < 20; frame += 1) {
      controller.sampleFrame(1 / 120, 'impact');
    }
    expect(controller.scale).toBe(degraded);

    for (let frame = 0; frame < 600; frame += 1) {
      controller.sampleFrame(1 / 120, 'impact');
    }
    expect(controller.scale).toBeGreaterThan(degraded);
    expect(controller.scale).toBeLessThanOrEqual(1);

    const requiredRestore = controller.scale < 1;
    expect(controller.sampleFrame(0, 'none')).toBe(requiredRestore);
    expect(controller.scale).toBe(1);
    expect(controller.getDiagnostics().state).toBe('inactive');
  });

  it('resets per-tier samples and reports deterministic frame percentiles', () => {
    const controller = new AdaptiveResolutionController('medium');
    for (const milliseconds of [10, 20, 30, 40, 50]) {
      controller.sampleFrame(milliseconds / 1_000, 'none');
    }
    expect(controller.getDiagnostics()).toMatchObject({
      sampleCount: 5,
      medianFrameMs: 30,
      p95FrameMs: 50,
      p99FrameMs: 50,
    });

    controller.setQuality('ultra');
    expect(controller.getDiagnostics()).toMatchObject({
      quality: 'ultra',
      sampleCount: 0,
      medianFrameMs: null,
      resolutionScale: 1,
    });
  });

  it('rejects invalid frame intervals', () => {
    const controller = new AdaptiveResolutionController();
    expect(() => controller.sampleFrame(Number.NaN, 'impact')).toThrow(/finite/i);
    expect(() => controller.sampleFrame(-0.1, 'impact')).toThrow(/non-negative/i);
  });
});
