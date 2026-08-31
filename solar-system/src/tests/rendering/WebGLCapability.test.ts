import { detectWebGL2Support } from '../../rendering/WebGLCapability';

describe('detectWebGL2Support', () => {
  it('reports support when a WebGL 2 context can be created', () => {
    const loseContext = vi.fn();
    const context = {
      getExtension: vi.fn(() => ({ loseContext })),
    } as unknown as WebGL2RenderingContext;
    const canvas = {
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    expect(detectWebGL2Support(() => canvas)).toEqual({ supported: true });
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('returns an actionable fallback reason without throwing', () => {
    const canvas = {
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;

    const result = detectWebGL2Support(() => canvas);
    expect(result.supported).toBe(false);
    expect(result.reason).toContain('hardware acceleration');
  });
});
