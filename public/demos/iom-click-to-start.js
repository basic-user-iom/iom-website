/**
 * Shared click-to-start gate for heavy IOM demos.
 * Shows a static poster until the visitor interacts, then resolves.
 *
 * Usage (classic or module):
 *   await window.iomDemoAwaitStart({
 *     poster: '/assets/posters/fft-ocean.webp',
 *     label: 'Start experience',
 *   })
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
        min-height: 2.75rem;
        padding: 0.7rem 1.25rem;
        border: 1px solid rgba(255,255,255,0.35);
        border-radius: 999px;
        background: rgba(8, 12, 18, 0.72);
        letter-spacing: 0.04em;
      }
      .iom-demo-gate-hint {
        position: relative;
        z-index: 1;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .iom-demo-gate:focus-visible {
        outline: 2px solid #00e5ff;
        outline-offset: -4px;
      }
    `
    document.head.appendChild(style)
  }

  /**
   * @param {{ poster?: string, label?: string, hint?: string, parent?: HTMLElement }} [opts]
   * @returns {Promise<void>}
   */
  function iomDemoAwaitStart(opts = {}) {
    ensureStyles()
    const poster = opts.poster || ''
    const label = opts.label || 'Start experience'
    const hint = opts.hint || 'Tap or click to load live 3D'
    const parent = opts.parent || document.body

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

      const finish = () => {
        gate.removeEventListener('click', finish)
        gate.removeEventListener('keydown', onKey)
        gate.remove()
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
