import type { Hotspot, HotspotAction } from '../persistence/schema'
import { idbGetAssetBlob } from '../persistence/localDb'

export type HotspotCardHandlers = {
  onClose?: () => void
  onRunAction?: (action: HotspotAction) => void
  /** Prefer human labels (e.g. clip names) over raw actionId. */
  resolveActionLabel?: (action: HotspotAction) => string | null
}

const objectUrls = new Set<string>()

function revokeAll() {
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.clear()
}

async function assetUrl(assetId: string): Promise<string | null> {
  const blob = await idbGetAssetBlob(assetId)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  objectUrls.add(url)
  return url
}

export function mountHotspotCard(host: HTMLElement, handlers: HotspotCardHandlers = {}) {
  const card = document.createElement('article')
  card.className = 'as-hotspot-card'
  card.hidden = true
  host.appendChild(card)

  const close = () => {
    card.querySelectorAll('video').forEach((v) => {
      v.pause()
      v.removeAttribute('src')
      v.load()
    })
    revokeAll()
    card.hidden = true
    card.innerHTML = ''
    handlers.onClose?.()
  }

  return {
    async show(hotspot: Hotspot) {
      revokeAll()
      const title =
        hotspot.blocks.find((block) => block.type === 'title')?.text ?? hotspot.name

      const parts: string[] = []
      for (const block of hotspot.blocks) {
        if (block.type === 'eyebrow') {
          parts.push(`<p class="as-hotspot-eyebrow">${escapeHtml(block.text)}</p>`)
        } else if (block.type === 'title') {
          // rendered as h2
        } else if (block.type === 'richtext') {
          parts.push(
            `<div class="as-hotspot-text">${escapeHtml(block.markdown).replace(/\n/g, '<br>')}</div>`,
          )
        } else if (block.type === 'specs') {
          parts.push(
            `<dl>${block.rows
              .map(
                (row) =>
                  `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`,
              )
              .join('')}</dl>`,
          )
        } else if (block.type === 'cta') {
          parts.push(
            `<a class="as-btn as-btn--accent" href="${escapeAttr(block.url)}" target="_blank" rel="noopener">${escapeHtml(block.label)}</a>`,
          )
        } else if (block.type === 'image') {
          const url = await assetUrl(block.assetId)
          if (url) {
            parts.push(
              `<img class="as-hotspot-media" src="${escapeAttr(url)}" alt="${escapeAttr(block.alt || hotspot.name)}" />`,
            )
          }
        } else if (block.type === 'video') {
          const url = await assetUrl(block.assetId)
          if (url) {
            parts.push(
              `<video class="as-hotspot-media" src="${escapeAttr(url)}" controls autoplay playsinline></video>`,
            )
          } else {
            parts.push(`<p class="as-hint">Video missing — re-import media into this project.</p>`)
          }
        }
      }

      const actionButtons = hotspot.actions
        .map((action, index) => {
          const label =
            handlers.resolveActionLabel?.(action) ?? defaultActionLabel(action)
          return `<button type="button" class="as-btn as-btn--accent" data-hotspot-action="${index}">${escapeHtml(label)}</button>`
        })
        .join('')

      card.innerHTML = `
        <button type="button" class="as-hotspot-close" aria-label="Close hotspot">×</button>
        <h2>${escapeHtml(title)}</h2>
        ${parts.join('')}
        ${
          actionButtons
            ? `<div class="as-hotspot-actions" role="group" aria-label="Hotspot actions">${actionButtons}</div>`
            : ''
        }
      `
      card.hidden = false
      card.querySelector('.as-hotspot-close')?.addEventListener('click', close)
      card.querySelectorAll('[data-hotspot-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const index = Number((btn as HTMLElement).dataset.hotspotAction)
          const action = hotspot.actions[index]
          if (action) handlers.onRunAction?.(action)
        })
      })
    },
    close,
    dispose() {
      close()
      card.remove()
    },
  }
}

function defaultActionLabel(action: HotspotAction): string {
  switch (action.type) {
    case 'action.play':
    case 'action.toggle':
      return action.actionId.startsWith('clip:')
        ? `Play animation ${Number(action.actionId.slice(5)) + 1}`
        : action.actionId.replace(/_/g, ' ')
    case 'shot.goTo':
      return 'Go to shot'
    case 'environment.setPreset':
      return `Environment: ${action.presetId}`
    case 'link.open':
      return 'Open link'
    case 'vehicleLight.set':
      return `Lights: ${action.groupId} ${action.on ? 'on' : 'off'}`
    case 'vehicleLight.toggle':
      return `Toggle lights: ${action.groupId}`
    case 'vehicleLight.sequence':
      return `Light sequence: ${action.sequenceId}`
    default:
      return 'Run action'
  }
}

export function runHotspotAction(
  action: HotspotAction,
  handlers: {
    playSemanticAction: (id: string) => boolean
    goToShot?: (shotId: string) => void
    setEnvironmentPreset?: (presetId: string) => void
    setVehicleLight?: (groupId: string, on: boolean) => void
    toggleVehicleLight?: (groupId: string) => void
    playVehicleLightSequence?: (sequenceId: string) => void
  },
): boolean {
  switch (action.type) {
    case 'action.play':
    case 'action.toggle':
      return handlers.playSemanticAction(action.actionId)
    case 'shot.goTo':
      handlers.goToShot?.(action.shotId)
      return Boolean(handlers.goToShot)
    case 'environment.setPreset':
      handlers.setEnvironmentPreset?.(action.presetId)
      return Boolean(handlers.setEnvironmentPreset)
    case 'link.open':
      window.open(action.url, '_blank', 'noopener')
      return true
    case 'vehicleLight.set':
      handlers.setVehicleLight?.(action.groupId, action.on)
      return Boolean(handlers.setVehicleLight)
    case 'vehicleLight.toggle':
      handlers.toggleVehicleLight?.(action.groupId)
      return Boolean(handlers.toggleVehicleLight)
    case 'vehicleLight.sequence':
      handlers.playVehicleLightSequence?.(action.sequenceId)
      return Boolean(handlers.playVehicleLightSequence)
    default:
      return false
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

/** Fire configured hotspot actions (door clips, etc.). */
export function runHotspotActions(
  hotspot: Hotspot,
  run: (action: HotspotAction) => void,
) {
  for (const action of hotspot.actions) run(action)
}
