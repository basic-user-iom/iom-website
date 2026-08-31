export interface WebGLCapabilityResult {
  readonly supported: boolean;
  readonly reason?: string;
}

const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: true,
  depth: true,
  // A software WebGL2 implementation is slower but still a valid accessible
  // baseline; quality management can react to performance in later phases.
  failIfMajorPerformanceCaveat: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
  stencil: false,
};

export function detectWebGL2Support(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): WebGLCapabilityResult {
  try {
    const canvas = createCanvas();
    const context = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);

    if (context === null) {
      return {
        supported: false,
        reason:
          'WebGL 2 is unavailable. Enable hardware acceleration or use a current browser and graphics driver.',
      };
    }

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return { supported: true };
  } catch (error) {
    return {
      supported: false,
      reason:
        error instanceof Error
          ? `WebGL 2 could not start: ${error.message}`
          : 'WebGL 2 could not start on this device.',
    };
  }
}

export { CONTEXT_ATTRIBUTES };
