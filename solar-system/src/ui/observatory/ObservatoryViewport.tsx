import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const VIEWPORT_ID = 'observatory-viewport';
const FALLBACK_BODY_CLASS = 'observatory-viewport-expanded';

type FullscreenMode = 'idle' | 'native' | 'fallback';

export interface ObservatoryViewportProps {
  readonly children: ReactNode;
  readonly closeUpActive: boolean;
  readonly ariaLabel: string;
}

/**
 * Owns the complete interactive stage so the WebGL canvas, labels, legend,
 * scenario HUDs, and exit control all remain available in the fullscreen
 * top layer. A fixed-position fallback covers browsers or embeds that deny
 * the native Fullscreen API.
 */
export function ObservatoryViewport({
  children,
  closeUpActive,
  ariaLabel,
}: ObservatoryViewportProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('idle');
  const fullscreenActive = fullscreenMode !== 'idle';

  useEffect(() => {
    const handleFullscreenChange = () => {
      const viewport = viewportRef.current;
      setFullscreenMode((currentMode) => {
        if (viewport !== null && document.fullscreenElement === viewport) return 'native';
        return currentMode === 'native' ? 'idle' : currentMode;
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (fullscreenMode !== 'fallback') return undefined;

    document.body.classList.add(FALLBACK_BODY_CLASS);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setFullscreenMode('idle');
    };
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('keydown', handleEscape, true);
      document.body.classList.remove(FALLBACK_BODY_CLASS);
    };
  }, [fullscreenMode]);

  const enterFullscreen = useCallback(async () => {
    const viewport = viewportRef.current;
    if (viewport === null) return;

    if (typeof viewport.requestFullscreen !== 'function' || document.fullscreenEnabled === false) {
      setFullscreenMode('fallback');
      return;
    }

    try {
      await viewport.requestFullscreen();
      setFullscreenMode(document.fullscreenElement === viewport ? 'native' : 'fallback');
    } catch {
      // Embedded demos can deny the Fullscreen API when their iframe lacks
      // permission. Keep the same user-facing feature inside that viewport.
      setFullscreenMode('fallback');
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    const viewport = viewportRef.current;
    if (
      fullscreenMode === 'native' &&
      viewport !== null &&
      document.fullscreenElement === viewport &&
      typeof document.exitFullscreen === 'function'
    ) {
      try {
        await document.exitFullscreen();
      } catch {
        return;
      }
    }
    setFullscreenMode('idle');
  }, [fullscreenMode]);

  const handleToggle = useCallback(() => {
    void (fullscreenActive ? exitFullscreen() : enterFullscreen());
  }, [enterFullscreen, exitFullscreen, fullscreenActive]);

  const actionLabel = fullscreenActive
    ? 'Exit full screen space view'
    : 'Open full screen space view';

  return (
    <section
      ref={viewportRef}
      id={VIEWPORT_ID}
      className="canvas-section"
      data-testid="observatory-viewport"
      data-close-up-active={closeUpActive ? 'true' : 'false'}
      data-fullscreen-active={fullscreenActive ? 'true' : 'false'}
      data-fullscreen-mode={fullscreenMode}
      aria-label={ariaLabel}
    >
      {children}
      <button
        className="viewport-fullscreen-button"
        type="button"
        data-testid="viewport-fullscreen-toggle"
        aria-controls={VIEWPORT_ID}
        aria-label={actionLabel}
        aria-pressed={fullscreenActive}
        title={`${actionLabel}${fullscreenActive ? ' (Esc)' : ''}`}
        onClick={handleToggle}
      >
        <FullscreenIcon expanded={fullscreenActive} />
        <span className="viewport-fullscreen-label">
          {fullscreenActive ? 'Exit full screen' : 'Full screen'}
        </span>
      </button>
    </section>
  );
}

function FullscreenIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      className="viewport-fullscreen-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {expanded ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
      )}
    </svg>
  );
}
