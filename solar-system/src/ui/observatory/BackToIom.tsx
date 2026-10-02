import { useLayoutEffect, useRef } from 'react';

/** Adopt the site's return link, retaining its destination and navigation handler. */
export function BackToIom() {
  const slot = useRef<HTMLSpanElement>(null);
  const retainedAnchor = useRef<HTMLAnchorElement | null>(null);
  useLayoutEffect(() => {
    const anchor = retainedAnchor.current ?? document.querySelector<HTMLAnchorElement>('#iom-back-link')
      ?? document.createElement('a');
    retainedAnchor.current = anchor;
    if (!anchor.hasAttribute('href')) anchor.href = '/#experiments';
    anchor.id = 'iom-back-link';
    anchor.classList.add('iom-back', 'observatory-back-link');
    anchor.textContent = '\u2190 Back to IOM';
    anchor.setAttribute('aria-label', 'Back to IOM');
    slot.current?.append(anchor);
    return () => anchor.remove();
  }, []);
  return <span className="observatory-back-slot" ref={slot} />;
}
