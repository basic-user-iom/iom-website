import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Both disclosures share one full-width content area above the scene. */
export function ViewportMenus({ information, renderPlanets, onOpen }: {
  readonly information: ReactNode;
  readonly renderPlanets?: (close: () => void) => ReactNode;
  readonly onOpen: () => void;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<'information' | 'planets' | null>(null);
  useEffect(() => {
    if (open === null) return;
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);
  const close = () => {
    document.getElementById(id + (open === 'planets' ? '-planets-toggle' : '-information-toggle'))?.focus({ preventScroll: true });
    setOpen(null);
  };
  const toggle = (menu: 'information' | 'planets') => {
    if (open === menu) setOpen(null);
    else { onOpen(); setOpen(menu); }
  };
  return <div ref={container} className="viewport-menus" data-testid="viewport-menus" onKeyDown={event => {
    if (event.key === 'Escape' && open !== null) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <div className="viewport-menu-tabs" role="group" aria-label="Scene controls">
      <button id={id + '-information-toggle'} type="button"
        aria-expanded={open === 'information'} aria-controls={id + '-information'}
        onClick={() => toggle('information')}>
        <span aria-hidden="true">{open === 'information' ? '▾' : '▸'}</span> Scene information
      </button>
      {renderPlanets ? <button id={id + '-planets-toggle'} type="button"
        data-testid="planets-menu-toggle" aria-expanded={open === 'planets'} aria-controls={id + '-planets'}
        onClick={() => toggle('planets')}>
        <span aria-hidden="true">{open === 'planets' ? '▾' : '▸'}</span> Planets
      </button> : null}
    </div>
    <div id={id + '-information'} className="viewport-menu-content canvas-topbar"
      role="region" aria-labelledby={id + '-information-toggle'} hidden={open !== 'information'}>
      {information}
    </div>
    {renderPlanets ? <div id={id + '-planets'} className="viewport-menu-content canvas-quick-picks"
      data-testid="planets-menu-content" role="region" aria-labelledby={id + '-planets-toggle'} hidden={open !== 'planets'}>
      {renderPlanets(close)}
    </div> : null}
  </div>;
}
