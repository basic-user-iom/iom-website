import { useCallback, useEffect, useState } from 'react';

export type WorkspacePanel = 'objects' | 'time' | 'view' | 'tools';
const COMPACT_QUERY = '(max-width: 1100px), (max-height: 600px)';

export function useWorkspacePanels() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  const [panel, setPanel] = useState<WorkspacePanel | null>(null);
  const closePanel = useCallback(() => {
    setPanel(null);
    if (panel) requestAnimationFrame(() => {
      const dockButton = document.getElementById(`toggle-${panel}`);
      const button = dockButton?.getClientRects().length ? dockButton : document.getElementById('desktop-toggle-time');
      button?.focus();
    });
  }, [panel]);
  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (panel === null) return;
    const escape = (event: KeyboardEvent) => {
      // Dialogs and full screen own Escape while they are open.
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"], [data-fullscreen-active="true"]')) {
        closePanel();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel, closePanel]);
  return { compact, panel, setPanel, closePanel };
}
