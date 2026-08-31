import { Camera, Scene, type Vector2, type WebGLRenderer } from 'three';

import {
  SolarPostProcessing,
  solarBloomProfile,
  solarExposureForPreset,
} from '../../rendering/SolarPostProcessing';

describe('solar post-processing profiles', () => {
  it('keeps low quality bloom disabled and progressively raises effect fidelity', () => {
    const low = solarBloomProfile('low');
    const medium = solarBloomProfile('medium');
    const high = solarBloomProfile('high');
    const ultra = solarBloomProfile('ultra');

    expect(low.enabled).toBe(false);
    expect(low.strength).toBe(0);
    expect(medium.enabled).toBe(true);
    expect(high.strength).toBeGreaterThan(medium.strength);
    expect(ultra.strength).toBeGreaterThan(high.strength);
    expect(ultra.radius).toBeGreaterThan(high.radius);
    expect(ultra.threshold).toBeGreaterThan(1);
    expect(high.threshold).toBeGreaterThan(1);
    expect(ultra.maximumPixelRatio).toBe(2);
    expect(Object.isFrozen(high)).toBe(true);
  });

  it('provides a lower-exposure near-Sun preset', () => {
    expect(solarExposureForPreset('deep-space')).toBeGreaterThan(
      solarExposureForPreset('balanced'),
    );
    expect(solarExposureForPreset('solar-closeup')).toBeLessThan(
      solarExposureForPreset('balanced'),
    );
  });
});

describe('SolarPostProcessing', () => {
  it('applies quality profiles, DPR caps, exposure presets, and idempotent disposal', () => {
    const renderer = createRendererStub(800, 600, 2);
    const pipeline = new SolarPostProcessing(renderer, {
      initialQuality: 'high',
      hdrRenderTargetSupported: true,
    });

    expect(pipeline.getState()).toMatchObject({
      quality: 'high',
      enabled: true,
      width: 800,
      height: 600,
      requestedPixelRatio: 2,
      effectivePixelRatio: 1.5,
    });

    pipeline.setQuality('low');
    expect(pipeline.getState()).toMatchObject({
      quality: 'low',
      enabled: false,
      effectivePixelRatio: 1,
    });

    pipeline.resize(1_920.8, 1_080.2, 3);
    pipeline.setQuality('ultra');
    expect(pipeline.getState()).toMatchObject({
      width: 1_920,
      height: 1_080,
      requestedPixelRatio: 3,
      effectivePixelRatio: 2,
    });

    pipeline.setResolutionScale(0.65);
    expect(pipeline.getState()).toMatchObject({
      resolutionScale: 0.65,
      requestedPixelRatio: 3,
      effectivePixelRatio: 1.3,
    });
    expect(() => pipeline.setResolutionScale(0.49)).toThrow(/between 0.5 and 1/i);

    pipeline.setExposurePreset('solar-closeup');
    expect(renderer.toneMappingExposure).toBe(solarExposureForPreset('solar-closeup'));
    expect(() => pipeline.setExposure(0)).toThrow(RangeError);

    pipeline.dispose();
    pipeline.dispose();
    expect(() => pipeline.setQuality('high')).toThrow(/disposed/i);
  });

  it('bypasses half-float composition when the context cannot render HDR targets', () => {
    const renderer = createRendererStub(640, 360, 1);
    const pipeline = new SolarPostProcessing(renderer, {
      initialQuality: 'ultra',
      hdrRenderTargetSupported: false,
    });
    const scene = new Scene();
    const camera = new Camera();

    expect(pipeline.getState()).toMatchObject({
      quality: 'ultra',
      enabled: false,
      hdrRenderTargetSupported: false,
    });
    pipeline.render(scene, camera, 1 / 60);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);

    pipeline.setQuality('low');
    pipeline.setResolutionScale(0.75);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(0.75);
    expect(renderer.setSize).toHaveBeenLastCalledWith(640, 360, false);

    pipeline.dispose();
  });

  it('integrates quality-tiered black-hole lensing without enabling it on Low', () => {
    const renderer = createRendererStub(1_280, 720, 1);
    const pipeline = new SolarPostProcessing(renderer, {
      initialQuality: 'high',
      hdrRenderTargetSupported: true,
    });
    const lensingFrame = {
      active: true,
      centerNdc: [0, 0] as const,
      eventHorizonRadiusNdc: 0.05,
      viewportAspect: 16 / 9,
      redshiftStrength: 0.5,
    };

    pipeline.setBlackHoleLensing(lensingFrame);
    // The renderer stub cannot load public LUT assets, so High reports and
    // renders the honest simplified fallback until both tables are ready.
    expect(pipeline.getState().blackHoleLensing.path).toBe('simplified');
    pipeline.setQuality('medium');
    pipeline.setBlackHoleLensing(lensingFrame);
    expect(pipeline.getState().blackHoleLensing.path).toBe('simplified');
    pipeline.setReducedMotion(true);
    pipeline.setQuality('low');
    pipeline.setBlackHoleLensing(lensingFrame);
    expect(pipeline.getState().blackHoleLensing).toMatchObject({
      active: false,
      path: 'off',
    });
    pipeline.dispose();
  });
});

function createRendererStub(
  width: number,
  height: number,
  pixelRatio: number,
): WebGLRenderer {
  const renderer = {
    toneMappingExposure: 1,
    getPixelRatio: () => pixelRatio,
    getSize: (target: Vector2) => target.set(width, height),
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
  };
  return renderer as unknown as WebGLRenderer;
}
