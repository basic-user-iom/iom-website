import type { StoreSnapshot } from '../persistence/projectStore'
import type { TransportSnapshot } from '../transport/transport'
import type { StudioRenderer } from '../renderer/createRenderer'

export interface PresentationShellOptions {
  onPlayPause: () => void
  onMuteToggle: () => void
  onFullscreen: () => void
  onExit: () => void
  onInfo: () => void
}

export function mountPresentationShell(
  root: HTMLElement,
  options: PresentationShellOptions,
): {
  viewportHost: HTMLElement
  updateStore: (snap: StoreSnapshot) => void
  updateTransport: (snap: TransportSnapshot) => void
  setRendererInfo: (renderer: StudioRenderer) => void
  setStatus: (message: string) => void
} {
  root.className = 'as-app as-app--presentation'
  root.innerHTML = `
    <main class="as-viewport" data-viewport tabindex="-1" aria-label="Presentation viewport"></main>
    <div class="as-presentation-controls" role="toolbar" aria-label="Presentation controls">
      <button type="button" class="as-btn" data-action="playpause" aria-keyshortcuts="Space">Play</button>
      <button type="button" class="as-btn" data-action="mute">Mute</button>
      <button type="button" class="as-btn" data-action="fullscreen">Fullscreen</button>
      <button type="button" class="as-btn" data-action="info">Info</button>
      <button type="button" class="as-btn" data-action="exit" aria-keyshortcuts="Escape">Exit</button>
      <span class="as-status" data-status role="status" aria-live="polite">Client presentation shell</span>
    </div>
  `

  const viewportHost = root.querySelector('[data-viewport]') as HTMLElement
  const badge = document.createElement('div')
  badge.className = 'as-viewport-badge'
  badge.textContent = 'Presentation mode — authoring chrome hidden.'
  viewportHost.appendChild(badge)

  root.querySelector('[data-action="playpause"]')?.addEventListener('click', options.onPlayPause)
  root.querySelector('[data-action="mute"]')?.addEventListener('click', options.onMuteToggle)
  root.querySelector('[data-action="fullscreen"]')?.addEventListener('click', options.onFullscreen)
  root.querySelector('[data-action="info"]')?.addEventListener('click', options.onInfo)
  root.querySelector('[data-action="exit"]')?.addEventListener('click', options.onExit)

  return {
    viewportHost,
    updateStore(snap) {
      // Intentionally minimal — no project internals for clients.
      void snap
    },
    updateTransport(snap) {
      root.querySelector('[data-action="playpause"]')!.textContent = snap.playing
        ? 'Pause'
        : 'Play'
    },
    setRendererInfo(renderer) {
      badge.textContent = `Presentation · ${renderer.backend}`
    },
    setStatus(message) {
      root.querySelector('[data-status]')!.textContent = message
    },
  }
}
