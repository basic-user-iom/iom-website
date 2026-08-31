import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary:first-of-type',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ObservatoryDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly closeLabel?: string;
  readonly closeOnBackdrop?: boolean;
  readonly className?: string;
  readonly testId?: string;
}

/**
 * A small modal primitive with deterministic focus entry, Tab containment,
 * Escape dismissal, and focus restoration. The backdrop is portalled to the
 * document body so filtered control panels cannot capture its fixed viewport.
 * While the space view is fullscreen, the active viewport becomes the portal
 * host so keyboard-opened help and provenance remain in the browser top layer.
 */
export function ObservatoryDialog({
  open,
  title,
  description,
  children,
  onClose,
  initialFocusRef,
  returnFocusRef,
  closeLabel = 'Close',
  closeOnBackdrop = false,
  className = '',
  testId,
}: ObservatoryDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const returnFocus = returnFocusRef?.current ?? activeHtmlElement();
    const dialog = dialogRef.current;
    if (dialog === null) return undefined;

    const requestedInitialFocus = initialFocusRef?.current;
    const firstFocusable = focusableElements(dialog)[0];
    const initialFocus =
      requestedInitialFocus !== undefined &&
      requestedInitialFocus !== null &&
      dialog.contains(requestedInitialFocus)
        ? requestedInitialFocus
        : (firstFocusable ?? dialog);
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (returnFocus?.isConnected === true) returnFocus.focus();
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) return null;

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };

  const dialog = (
    <div
      className="observatory-dialog-backdrop"
      data-testid={testId === undefined ? undefined : `${testId}-backdrop`}
      onMouseDown={closeFromBackdrop}
    >
      <section
        ref={dialogRef}
        className={`observatory-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        data-testid={testId}
        tabIndex={-1}
      >
        <header className="observatory-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="button button-secondary observatory-dialog-close"
            type="button"
            aria-label={`${closeLabel}: ${title}`}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </header>
        {description === undefined ? null : (
          <div className="observatory-dialog-description" id={descriptionId}>
            {description}
          </div>
        )}
        <div className="observatory-dialog-content">{children}</div>
      </section>
    </div>
  );

  const expandedViewport =
    typeof document === 'undefined'
      ? null
      : document.querySelector<HTMLElement>(
          '#observatory-viewport[data-fullscreen-active="true"]',
        );
  const portalHost =
    typeof document === 'undefined' || document.getElementById('root') === null
      ? null
      : expandedViewport ?? document.body;
  return portalHost === null ? dialog : createPortal(dialog, portalHost);
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getAttribute('aria-disabled') !== 'true',
  );
}

function activeHtmlElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
