// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BackToIom } from '../../ui/observatory/BackToIom';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BackToIom', () => {
  it('retains the existing destination and handler across Strict Mode replays', () => {
    const existing = document.createElement('a');
    existing.id = 'iom-back-link';
    existing.href = '/#project-solar-system';
    const navigate = vi.fn((event: MouseEvent) => event.preventDefault());
    existing.addEventListener('click', navigate);
    document.body.append(existing);
    const container = document.createElement('header');
    document.body.append(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<StrictMode><BackToIom /></StrictMode>));
      const link = container.querySelector<HTMLAnchorElement>('a')!;
      expect(link).toBe(existing);
      expect(link.getAttribute('href')).toBe('/#project-solar-system');
      expect(document.querySelectorAll('#iom-back-link')).toHaveLength(1);
      link.click();
      expect(navigate).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      container.remove();
      existing.remove();
    }
  });
});
