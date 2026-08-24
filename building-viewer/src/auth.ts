const STORAGE_KEY = 'building-viewer-demo-unlocked'

export function getBuildingViewerPassword(): string {
  return (
    import.meta.env.VITE_BUILDING_VIEWER_DEMO_PASSWORD?.trim() ||
    'animated'
  )
}

export function isBuildingViewerUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockBuildingViewer(password: string): boolean {
  if (password !== getBuildingViewerPassword()) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
  return true
}

/** Same-origin CRM Demo iframe can skip the gate. Top-level ?crmEmbed=1 does nothing. */
export function tryCrmEmbedUnlock(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crmEmbed') !== '1') return false
    if (window.top === window.self) return false
    if (window.top?.location.origin !== window.location.origin) return false
    sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  } catch {
    return false
  }
}

/**
 * Block viewer boot behind the password gate until unlocked.
 * Resolves immediately when already unlocked or CRM-embedded.
 */
export function ensureBuildingViewerAccess(host: HTMLElement): Promise<void> {
  if (isBuildingViewerUnlocked() || tryCrmEmbedUnlock()) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    host.replaceChildren()
    const gate = document.createElement('div')
    gate.className = 'bv-gate'
    gate.innerHTML = `
      <div class="bv-gate__panel">
        <p class="bv-gate__brand">ICM · Building Viewer</p>
        <p class="bv-gate__hint">Private client preview. Enter the password to continue.</p>
        <form class="bv-gate__form" autocomplete="on">
          <input
            class="bv-gate__input"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            autofocus
          />
          <button class="bv-gate__submit" type="submit">Enter</button>
          <p class="bv-gate__error" hidden>Incorrect password.</p>
        </form>
      </div>
    `
    host.appendChild(gate)

    const form = gate.querySelector('form')
    const input = gate.querySelector('input')
    const error = gate.querySelector('.bv-gate__error')
    if (
      !(form instanceof HTMLFormElement) ||
      !(input instanceof HTMLInputElement) ||
      !(error instanceof HTMLElement)
    ) {
      return
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (unlockBuildingViewer(input.value)) {
        error.hidden = true
        host.replaceChildren()
        resolve()
        return
      }
      error.hidden = false
      input.select()
    })
  })
}
