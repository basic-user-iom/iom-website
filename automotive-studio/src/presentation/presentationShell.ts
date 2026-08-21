import type { StoreSnapshot } from '../persistence/projectStore'
import type { TransportSnapshot } from '../transport/transport'
import type { StudioRenderer } from '../renderer/createRenderer'
import type { ChaseOrbitPreset } from '../route/chaseCamera'
import { CHASE_ORBIT_PRESETS } from '../route/chaseCamera'

export interface PresentationShellOptions {
  onPlayPause: () => void
  onMuteToggle: () => void
  onFullscreen: () => void
  onExit: () => void
  onInfo: () => void
  onFreeDriveToggle: () => void
  onGoToShot: (shotId: string) => void
  onChasePreset: (preset: ChaseOrbitPreset) => void
  onOrbitToggle: () => void
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
  setFreeDriveActive: (active: boolean) => void
  setOrbitActive: (active: boolean) => void
  setExploreControls: (opts: {
    shots: Array<{ id: string; name: string; thumbnailDataUrl?: string }>
    showChase: boolean
    showDrive: boolean
  }) => void
} {
  root.className = 'as-app as-app--presentation'
  root.innerHTML = `
    <main class="as-viewport" data-viewport tabindex="-1" aria-label="Presentation viewport"></main>
    <div class="as-presentation-controls" role="toolbar" aria-label="Presentation controls">
      <div class="as-presentation-row" role="group" aria-label="Transport">
        <button type="button" class="as-btn" data-action="playpause" aria-keyshortcuts="Space">Play</button>
        <button type="button" class="as-btn" data-action="mute">Mute</button>
        <button type="button" class="as-btn" data-action="fullscreen">Fullscreen</button>
        <button type="button" class="as-btn" data-action="info">Info</button>
        <button type="button" class="as-btn" data-action="exit" aria-keyshortcuts="Escape">Exit</button>
      </div>
      <div class="as-presentation-row" data-explore-row hidden role="group" aria-label="Explore">
        <button type="button" class="as-btn" data-action="drive" aria-pressed="false" hidden>Free drive</button>
        <button type="button" class="as-btn" data-action="orbit" aria-pressed="false">Orbit</button>
        <span class="as-presentation-label">Views</span>
        <div class="as-presentation-shots" data-shots></div>
        <div class="as-presentation-chase" data-chase hidden></div>
      </div>
      <span class="as-status" data-status role="status" aria-live="polite">Client presentation shell</span>
    </div>
  `

  const viewportHost = root.querySelector('[data-viewport]') as HTMLElement
  const badge = document.createElement('div')
  badge.className = 'as-viewport-badge'
  badge.textContent = 'Presentation mode — authoring chrome hidden.'
  viewportHost.appendChild(badge)

  const exploreRow = root.querySelector('[data-explore-row]') as HTMLElement
  const driveBtn = root.querySelector('[data-action="drive"]') as HTMLButtonElement
  const orbitBtn = root.querySelector('[data-action="orbit"]') as HTMLButtonElement
  const shotsHost = root.querySelector('[data-shots]') as HTMLElement
  const chaseHost = root.querySelector('[data-chase]') as HTMLElement

  root.querySelector('[data-action="playpause"]')?.addEventListener('click', options.onPlayPause)
  root.querySelector('[data-action="mute"]')?.addEventListener('click', options.onMuteToggle)
  root.querySelector('[data-action="fullscreen"]')?.addEventListener('click', options.onFullscreen)
  root.querySelector('[data-action="info"]')?.addEventListener('click', options.onInfo)
  root.querySelector('[data-action="exit"]')?.addEventListener('click', options.onExit)
  driveBtn.addEventListener('click', options.onFreeDriveToggle)
  orbitBtn.addEventListener('click', options.onOrbitToggle)

  chaseHost.innerHTML = (
    Object.keys(CHASE_ORBIT_PRESETS) as ChaseOrbitPreset[]
  )
    .map(
      (id) =>
        `<button type="button" class="as-btn as-btn--compact" data-chase-preset="${id}">${CHASE_ORBIT_PRESETS[id].label}</button>`,
    )
    .join('')
  chaseHost.querySelectorAll('[data-chase-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.chasePreset as ChaseOrbitPreset
      if (id) options.onChasePreset(id)
    })
  })

  return {
    viewportHost,
    updateStore(snap) {
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
    setFreeDriveActive(active) {
      driveBtn.setAttribute('aria-pressed', active ? 'true' : 'false')
      driveBtn.textContent = active ? 'Exit drive' : 'Free drive'
    },
    setOrbitActive(active) {
      orbitBtn.setAttribute('aria-pressed', active ? 'true' : 'false')
    },
    setExploreControls(opts) {
      const hasShots = opts.shots.length > 0
      const show = opts.showDrive || opts.showChase || hasShots
      exploreRow.hidden = !show
      driveBtn.hidden = !opts.showDrive
      chaseHost.hidden = !opts.showChase
      shotsHost.innerHTML = opts.shots
        .map((s) => {
          const thumb = s.thumbnailDataUrl
            ? `<img class="as-presentation-shot-thumb" src="${escapeAttr(s.thumbnailDataUrl)}" alt="" width="64" height="36" decoding="async" />`
            : `<span class="as-presentation-shot-thumb as-presentation-shot-thumb--empty" aria-hidden="true"></span>`
          return `<button type="button" class="as-btn as-btn--compact as-presentation-shot" data-shot-id="${escapeAttr(s.id)}" title="${escapeAttr(s.name)}" aria-label="${escapeAttr(s.name)}">${thumb}<span class="as-presentation-shot-label">${escapeHtml(s.name)}</span></button>`
        })
        .join('')
      shotsHost.querySelectorAll('[data-shot-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.shotId
          if (id) options.onGoToShot(id)
        })
      })
    },
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    (
      {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      } as Record<string, string>
    )[char]!,
  )
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;')
}
