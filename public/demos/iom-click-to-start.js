/**
 * Shared click-to-start gate for heavy IOM demos.
 * Shows a static poster until the visitor interacts, then resolves.
 *
 * Usage (classic or module):
 *   await window.iomDemoAwaitStart({
 *     poster: '/assets/posters/fft-ocean.webp',
 *     label: 'Start experience',
 *   })
 *
 * Keep the overlay visible while a heavy init runs:
 *   const gate = await window.iomDemoAwaitStart({
 *     poster: '...',
 *     label: 'Start',
 *     loadingLabel: 'Loading…',
 *   })
 *   gate.setMessage('Downloading model…')
 *   await init()
 *   gate.dismiss()
 */
;(function (global) {
  const STYLE_ID = 'iom-demo-gate-style'

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .iom-demo-gate {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 1.5rem;
        margin: 0;
        border: 0;
        cursor: pointer;
        color: #f2f4f8;
        text-align: center;
        background-color: #06060a;
        background-size: cover;
        background-position: center;
        font: 500 15px/1.4 system-ui, -apple-system, sans-serif;
        -webkit-tap-highlight-color: transparent;
      }
      .iom-demo-gate::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(6,8,12,0.45) 0%, rgba(6,8,12,0.72) 100%);
        pointer-events: none;
      }
      .iom-demo-gate-inner {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        max-width: 28rem;
      }
      .iom-demo-gate-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        padding: 0.45rem 0.85rem;
        border: 0;
        border-radius: 4px;
        background: color-mix(in srgb, #00e5ff 68%, #001416);
        color: #08080a;
        font: 700 0.72rem/1.2 "IBM Plex Sans", system-ui, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        box-shadow: 0 0 12px rgba(0, 229, 255, 0.18);
      }
      .iom-demo-gate-hint {
        position: relative;
        z-index: 1;
        font-size: 0.65rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #8b8b9a;
        opacity: 0.9;
        text-shadow: none;
      }
      @media (prefers-reduced-motion: no-preference) {
        .iom-demo-gate:not(.is-loading) .iom-demo-gate-label {
          animation: iom-demo-gate-pulse 2.4s ease-in-out infinite;
        }
        .iom-demo-gate:not(.is-loading) .iom-demo-gate-hint {
          animation: iom-demo-gate-hint-pulse 2.4s ease-in-out infinite;
        }
      }
      @keyframes iom-demo-gate-pulse {
        0%, 100% { box-shadow: 0 0 8px rgba(0, 229, 255, 0.14); filter: brightness(1); }
        50% { box-shadow: 0 0 16px rgba(0, 229, 255, 0.28); filter: brightness(1.06); }
      }
      @keyframes iom-demo-gate-hint-pulse {
        0%, 100% { opacity: 0.72; }
        50% { opacity: 1; }
      }
      .iom-demo-gate.is-loading {
        cursor: wait;
        pointer-events: none;
      }
      .iom-demo-gate.is-loading .iom-demo-gate-label {
        animation: none;
        filter: none;
        box-shadow: none;
      }
      .iom-demo-gate.is-loading .iom-demo-gate-hint {
        animation: none;
      }
      .iom-demo-gate.is-loading .iom-demo-gate-hint::after {
        content: '';
        display: inline-block;
        width: 1.1em;
        text-align: left;
        animation: iom-demo-gate-dots 1.2s steps(4, end) infinite;
      }
      @keyframes iom-demo-gate-dots {
        0% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
      }
      .iom-demo-gate:focus-visible {
        outline: 2px solid #00e5ff;
        outline-offset: -4px;
      }
    `
    document.head.appendChild(style)
  }

  /**
   * @param {{
   *   poster?: string,
   *   label?: string,
   *   hint?: string,
   *   parent?: HTMLElement,
   *   loadingLabel?: string,
   *   loadingHint?: string,
   * }} [opts]
   * @returns {Promise<void | { setMessage: (label: string, hint?: string) => void, dismiss: () => void }>}
   */
  function isEmbeddedPreview() {
    try {
      return window.self !== window.top
    } catch {
      // Cross-origin parent — treat as embedded.
      return true
    }
  }

  /** Homepage ProjectCard hover iframe (`?cardEmbed=1`). Clicks never reach it. */
  function isCardHoverEmbed() {
    try {
      return new URLSearchParams(window.location.search).get('cardEmbed') === '1'
    } catch {
      return false
    }
  }

  function iomDemoAwaitStart(opts = {}) {
    ensureStyles()
    const poster = opts.poster || ''
    const label = opts.label || 'Start experience'
    const hint = opts.hint || 'Tap or click to load live 3D'
    const parent = opts.parent || document.body
    const holdForLoading = Boolean(opts.loadingLabel)

    // Non-card iframes can't receive clicks — auto-start the live demo.
    // Card hover should keep the start splash (pointer-events: none on the iframe).
    if (isEmbeddedPreview() && !isCardHoverEmbed()) {
      if (!holdForLoading) return Promise.resolve()
      const noop = () => {}
      return Promise.resolve({ setMessage: noop, dismiss: noop })
    }

    return new Promise((resolve) => {
      const gate = document.createElement('button')
      gate.type = 'button'
      gate.className = 'iom-demo-gate'
      gate.setAttribute('aria-label', label)
      if (poster) gate.style.backgroundImage = `url("${poster}")`

      gate.innerHTML =
        '<span class="iom-demo-gate-inner">' +
        `<span class="iom-demo-gate-label">${label}</span>` +
        `<span class="iom-demo-gate-hint">${hint}</span>` +
        '</span>'

      const labelEl = gate.querySelector('.iom-demo-gate-label')
      const hintEl = gate.querySelector('.iom-demo-gate-hint')

      const dismiss = () => {
        gate.remove()
      }

      const setMessage = (nextLabel, nextHint) => {
        if (labelEl && nextLabel != null) labelEl.textContent = nextLabel
        if (hintEl && nextHint != null) hintEl.textContent = nextHint
        gate.setAttribute('aria-label', nextLabel || label)
      }

      const finish = () => {
        gate.removeEventListener('click', finish)
        gate.removeEventListener('keydown', onKey)

        if (holdForLoading) {
          gate.classList.add('is-loading')
          gate.disabled = true
          setMessage(opts.loadingLabel || 'Loading…', opts.loadingHint || 'Preparing live 3D')
          resolve({ setMessage, dismiss })
          return
        }

        dismiss()
        resolve()
      }
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          finish()
        }
      }

      gate.addEventListener('click', finish)
      gate.addEventListener('keydown', onKey)
      parent.appendChild(gate)
      try {
        gate.focus({ preventScroll: true })
      } catch {
        /* ignore */
      }
    })
  }

  /**
   * Load classic <script src> tags in order after interaction.
   * @param {string[]} urls
   * @returns {Promise<void>}
   */
  function iomLoadScripts(urls) {
    return urls.reduce(
      (chain, src) =>
        chain.then(
          () =>
            new Promise((resolve, reject) => {
              const s = document.createElement('script')
              s.src = src
              s.onload = () => resolve()
              s.onerror = () => reject(new Error('Failed to load ' + src))
              document.body.appendChild(s)
            }),
        ),
      Promise.resolve(),
    )
  }

  global.iomDemoAwaitStart = iomDemoAwaitStart
  global.iomLoadScripts = iomLoadScripts
})(typeof window !== 'undefined' ? window : globalThis)
