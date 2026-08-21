const STORAGE_KEY = 'automotive-studio-demo-unlocked'

export function getAutomotiveStudioPassword(): string {
  return import.meta.env.VITE_AUTOMOTIVE_STUDIO_DEMO_PASSWORD?.trim() || 'automotive'
}

export function isAutomotiveStudioUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockAutomotiveStudio(password: string): boolean {
  if (password !== getAutomotiveStudioPassword()) return false
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
 * Block Studio/Present boot behind the password gate until unlocked.
 * Resolves immediately when already unlocked or CRM-embedded.
 */
export function ensureAutomotiveStudioAccess(host: HTMLElement): Promise<void> {
  if (isAutomotiveStudioUnlocked() || tryCrmEmbedUnlock()) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    host.replaceChildren()
    const gate = document.createElement('div')
    gate.className = 'as-gate'
    gate.innerHTML = `
      <div class="as-gate__panel">
        <p class="as-gate__brand">IOM · Automotive Studio</p>
        <p class="as-gate__hint">Private client preview. Enter the password to continue.</p>
        <form class="as-gate__form" autocomplete="on">
          <input
            class="as-gate__input"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            autofocus
          />
          <button class="as-gate__submit" type="submit">Enter</button>
          <p class="as-gate__error" hidden>Incorrect password.</p>
        </form>
      </div>
    `
    host.appendChild(gate)

    const form = gate.querySelector('form')
    const input = gate.querySelector('input')
    const error = gate.querySelector('.as-gate__error')
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(error instanceof HTMLElement)) {
      return
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (unlockAutomotiveStudio(input.value)) {
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
