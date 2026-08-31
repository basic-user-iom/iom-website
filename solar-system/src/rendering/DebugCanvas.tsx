import { useEffect, useRef, useState } from 'react';

import { DebugSolarSystemRenderer } from './DebugSolarSystemRenderer';
import type { EarthTideDebugMode } from './tides/EarthTideDebugOverlay';
import { detectWebGL2Support } from './WebGLCapability';
import type { ObservatoryCameraMode, WebGLStatus } from '../state/useAppStore';

export interface DebugCanvasProps {
  readonly reducedMotion: boolean;
  readonly reduceFlashes: boolean;
  readonly cameraMode: ObservatoryCameraMode;
  readonly earthTideDebugMode: EarthTideDebugMode;
  readonly manualCameraInteractionLocked: boolean;
  readonly onRendererReady: (renderer: DebugSolarSystemRenderer | null) => void;
  readonly onStatusChange: (status: WebGLStatus, message?: string | null) => void;
  readonly onVisibilityChange: (visible: boolean) => void;
  readonly onInteractionStart?: () => void;
}

interface LocalStatus {
  readonly status: WebGLStatus;
  readonly message: string | null;
}

export function DebugCanvas({
  reducedMotion,
  reduceFlashes,
  cameraMode,
  earthTideDebugMode,
  manualCameraInteractionLocked,
  onRendererReady,
  onStatusChange,
  onVisibilityChange,
  onInteractionStart = () => undefined,
}: DebugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DebugSolarSystemRenderer | null>(null);
  const [capability] = useState(() => detectWebGL2Support());
  const [localStatus, setLocalStatus] = useState<LocalStatus>(() => {
    return capability.supported
      ? { status: 'checking', message: null }
      : {
          status: 'unavailable',
          message: capability.reason ?? 'WebGL 2 is unavailable.',
        };
  });
  const cameraHint = manualCameraInteractionLocked
    ? 'Camera controlled by the active scenario'
    : cameraMode === 'free-orbit'
      ? 'Free orbit: drag to rotate · wheel to dolly · right-drag to pan'
      : 'Drag or wheel to enter free orbit · right-drag to pan';

  useEffect(() => {
    let effectActive = true;
    if (!capability.supported) {
      onStatusChange('unavailable', capability.reason ?? 'WebGL 2 is unavailable.');
      onRendererReady(null);
      return undefined;
    }

    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }

    let renderer: DebugSolarSystemRenderer;
    try {
      renderer = new DebugSolarSystemRenderer(canvas, {
        labelContainer: labelLayerRef.current,
        earthTideDebugMode,
      });
      rendererRef.current = renderer;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The WebGL renderer could not start.';
      queueMicrotask(() => {
        if (!effectActive) {
          return;
        }
        setLocalStatus({ status: 'error', message });
        onStatusChange('error', message);
        onRendererReady(null);
      });
      return () => {
        effectActive = false;
      };
    }

    const reportReady = () => {
      setLocalStatus({ status: 'ready', message: null });
      onStatusChange('ready', null);
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height, window.devicePixelRatio);
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      renderer.handleContextLost();
      const message = 'Graphics context lost. Waiting for the browser to restore it…';
      setLocalStatus({ status: 'lost', message });
      onStatusChange('lost', message);
    };
    const handleContextRestored = () => {
      renderer.handleContextRestored();
      resize();
      reportReady();
    };
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      renderer.setVisible(visible);
      onVisibilityChange(visible);
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);
    if (resizeObserver === null) {
      window.addEventListener('resize', resize);
    }
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resize();
    handleVisibilityChange();
    reportReady();
    onRendererReady(renderer);

    return () => {
      effectActive = false;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      onRendererReady(null);
      rendererRef.current = null;
      renderer.dispose();
      // React Strict Mode replays effects against the same connected canvas in
      // development. Releasing that shared context during the replay poisons
      // the replacement renderer, so only force loss after a true DOM detach.
      queueMicrotask(() => {
        if (!canvas.isConnected) renderer.releaseContext();
      });
    };
  }, [capability, earthTideDebugMode, onRendererReady, onStatusChange, onVisibilityChange]);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    rendererRef.current?.setReduceFlashes(reduceFlashes);
  }, [reduceFlashes]);

  if (localStatus.status === 'unavailable' || localStatus.status === 'error') {
    return (
      <div className="observatory-canvas-frame">
        <canvas
          ref={canvasRef}
          className="observatory-canvas"
          data-testid="solar-system-canvas"
          role="img"
          aria-label="Static Solar System fallback; interactive WebGL 2 is unavailable."
        />
        <StaticCanvasFallback message={localStatus.message} />
      </div>
    );
  }

  return (
    <div className="observatory-canvas-frame">
      <canvas
        ref={canvasRef}
        className="observatory-canvas"
        data-testid="solar-system-canvas"
        role="img"
        aria-label="Interactive Solar System observatory with illuminated planets, named comets, ephemeris orbit lines, catastrophe labs, adaptive quality, audited browser fallbacks, and an optional experimental Earth-tide debug overlay."
        tabIndex={0}
        aria-describedby="canvas-keyboard-help"
        data-camera-interaction={
          manualCameraInteractionLocked
            ? 'scenario-controlled'
            : cameraMode === 'free-orbit'
              ? 'free-orbit'
              : 'handoff-to-free-orbit'
        }
        onPointerDownCapture={onInteractionStart}
        onWheelCapture={onInteractionStart}
      />
      <div ref={labelLayerRef} className="body-label-layer" aria-hidden="true" />
      <p className="sr-only" id="canvas-keyboard-help">
        The Sun, eight planets, and Moon are positioned from generated JPL Horizons state
        vectors. Planetary surfaces use body-local sunlight; true and presentation render scales
        are explicitly labeled in the controls. Press question mark for keyboard help. Press F to
        focus the selected object and number keys 1 through 6 to change camera mode. Key 6 frames
        Earth and the Moon together. The optional
        Impact Lab pauses observatory time and labels all atmospheric entry and surface effects as
        educational approximations. Solar Fate keeps Scientific Solar Evolution separate from a
        fictional cinematic scenario that the real Sun cannot produce. {cameraHint}.
      </p>
      {localStatus.status === 'lost' ? (
        <div className="canvas-status" role="status">
          {localStatus.message}
        </div>
      ) : null}
      <div className="canvas-hint" data-testid="canvas-camera-hint" aria-hidden="true">
        {cameraHint}
      </div>
    </div>
  );
}

function StaticCanvasFallback({ message }: { readonly message: string | null }) {
  return (
    <div className="webgl-fallback" role="alert" data-testid="webgl-fallback">
      <div className="fallback-diagram" aria-hidden="true">
        <span className="fallback-sun" />
        <span className="fallback-guide" />
        <span className="fallback-earth" />
      </div>
      <h2>Interactive 3D is unavailable</h2>
      <p>{message ?? 'This browser could not create the required WebGL 2 context.'}</p>
      <p>The UTC clock and controls remain available below.</p>
    </div>
  );
}
