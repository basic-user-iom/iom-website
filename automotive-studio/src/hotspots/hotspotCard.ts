import type { Hotspot, HotspotAction, SemanticNodeRef } from '../persistence/schema'
import { idbGetAssetBlob } from '../persistence/localDb'
import { isAllowedExternalUrl, sanitizeExternalUrl } from '../persistence/safeUrls'

export type HotspotCardHandlers = {
  onClose?: () => void
  onRunAction?: (action: HotspotAction) => void
  /** Prefer human labels (e.g. clip names) over raw actionId. */
  resolveActionLabel?: (action: HotspotAction) => string | null
}

export function mountHotspotCard(host: HTMLElement, handlers: HotspotCardHandlers = {}) {
  const card = document.createElement('article')
  card.className = 'as-hotspot-card'
  card.hidden = true
  host.appendChild(card)

  let renderGen = 0
  /** Object URLs owned by the in-flight or committed render generation. */
  const objectUrls = new Set<string>()

  const revokeAll = () => {
    for (const url of objectUrls) URL.revokeObjectURL(url)
    objectUrls.clear()
  }

  const revokeUrl = (url: string) => {
    URL.revokeObjectURL(url)
    objectUrls.delete(url)
  }

  async function assetUrl(assetId: string, gen: number): Promise<string | null> {
    const blob = await idbGetAssetBlob(assetId)
    if (gen !== renderGen) return null
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    if (gen !== renderGen) {
      URL.revokeObjectURL(url)
      return null
    }
    objectUrls.add(url)
    return url
  }

  const close = () => {
    renderGen += 1
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
      const gen = ++renderGen
      revokeAll()

      const title =
        hotspot.blocks.find((block) => block.type === 'title')?.text ?? hotspot.name

      const parts: string[] = []
      for (const block of hotspot.blocks) {
        if (gen !== renderGen) {
          revokeAll()
          return
        }
        if (block.type === 'eyebrow') {
          parts.push(`<p class="as-hotspot-eyebrow">${escapeHtml(block.text)}</p>`)
        } else if (block.type === 'title') {
          // rendered as h2
        } else if (block.type === 'richtext') {
          const html = escapeHtml(block.markdown)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
          parts.push(`<div class="as-hotspot-text">${html}</div>`)
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
          const safe = sanitizeExternalUrl(block.url)
          if (safe) {
            parts.push(
              `<a class="as-btn as-btn--accent" href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(block.label)}</a>`,
            )
          } else {
            parts.push(
              `<span class="as-btn as-btn--accent" aria-disabled="true" title="Blocked URL scheme">${escapeHtml(block.label)}</span>`,
            )
          }
        } else if (block.type === 'image') {
          const url = await assetUrl(block.assetId, gen)
          if (gen !== renderGen) {
            if (url) revokeUrl(url)
            revokeAll()
            return
          }
          if (url) {
            parts.push(
              `<img class="as-hotspot-media" src="${escapeAttr(url)}" alt="${escapeAttr(block.alt || hotspot.name)}" />`,
            )
          }
        } else if (block.type === 'video') {
          const url = await assetUrl(block.assetId, gen)
          if (gen !== renderGen) {
            if (url) revokeUrl(url)
            revokeAll()
            return
          }
          if (url) {
            parts.push(
              `<video class="as-hotspot-media" src="${escapeAttr(url)}" controls autoplay playsinline></video>`,
            )
          } else {
            parts.push(`<p class="as-hint">Video missing — re-import media into this project.</p>`)
          }
        }
      }

      if (gen !== renderGen) {
        revokeAll()
        return
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
        : `Play ${action.actionId.replace(/_/g, ' ')}`
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
    case 'mesh.setVisible':
      return `${action.visible ? 'Show' : 'Hide'} mesh: ${action.node.name || action.node.path || 'node'}`
    case 'mesh.toggleVisible':
      return `Toggle mesh: ${action.node.name || action.node.path || 'node'}`
    default:
      return 'Run action'
  }
}

export function runHotspotAction(
  action: HotspotAction,
  handlers: {
    playSemanticAction: (
      id: string,
      opts?: {
        startSeconds?: number
        endSeconds?: number
        forcePlay?: boolean
        forceToggle?: boolean
      },
    ) => boolean
    goToShot?: (shotId: string) => void
    setEnvironmentPreset?: (presetId: string) => void
    setVehicleLight?: (groupId: string, on: boolean) => void
    toggleVehicleLight?: (groupId: string) => void
    playVehicleLightSequence?: (sequenceId: string) => void
    setMeshVisible?: (node: SemanticNodeRef, visible: boolean) => boolean
    toggleMeshVisible?: (node: SemanticNodeRef) => boolean
  },
): boolean {
  switch (action.type) {
    case 'action.play':
      return handlers.playSemanticAction(action.actionId, {
        startSeconds: action.startSeconds,
        endSeconds: action.endSeconds,
        forcePlay: true,
      })
    case 'action.toggle':
      return handlers.playSemanticAction(action.actionId, {
        startSeconds: action.startSeconds,
        endSeconds: action.endSeconds,
        forceToggle: true,
      })
    case 'shot.goTo':
      handlers.goToShot?.(action.shotId)
      return Boolean(handlers.goToShot)
    case 'environment.setPreset':
      handlers.setEnvironmentPreset?.(action.presetId)
      return Boolean(handlers.setEnvironmentPreset)
    case 'link.open': {
      if (!isAllowedExternalUrl(action.url)) return false
      window.open(action.url, '_blank', 'noopener,noreferrer')
      return true
    }
    case 'vehicleLight.set':
      handlers.setVehicleLight?.(action.groupId, action.on)
      return Boolean(handlers.setVehicleLight)
    case 'vehicleLight.toggle':
      handlers.toggleVehicleLight?.(action.groupId)
      return Boolean(handlers.toggleVehicleLight)
    case 'vehicleLight.sequence':
      handlers.playVehicleLightSequence?.(action.sequenceId)
      return Boolean(handlers.playVehicleLightSequence)
    case 'mesh.setVisible':
      return handlers.setMeshVisible?.(action.node, action.visible) ?? false
    case 'mesh.toggleVisible':
      return handlers.toggleMeshVisible?.(action.node) ?? false
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
