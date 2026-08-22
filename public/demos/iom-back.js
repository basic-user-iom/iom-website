/**
 * Shared “Back to IOM” control for first-party demos.
 * Smart return: close opener → history.back (same-origin) → /#<projectId>.
 * Visible above the click-to-start gate (z-index 10050 > gate 9999).
 */
;(function (global) {
  const STYLE_ID = 'iom-back-style'
  const LINK_ID = 'iom-back-link'
  const RETURN_KEY = 'iom:returnCard'
  const LABEL = 'Back to IOM'

  /** Demo folder slug → homepage project card id (never music). */
  const DEMO_CARD = {
    'streets-gl': 'streets-gl-bridge',
    'panorama-360': 'panorama-360-tour',
    'iom-studio': 'iom-studio',
    'raven-path': 'raven-path',
    'ssr-denoise': 'ssr-denoise',
    'dreams-iom': 'iom-three',
    'volume-lighting': 'volume-lighting',
    ocean: 'threejs-ocean',
    'message-in-a-bottle': 'message-in-a-bottle',
    'fft-ocean': 'fft-ocean',
    'css3d-sprites': 'css3d-sprites',
    'custom-cursor-labelled': 'custom-cursor-labelled',
    'compute-particles': 'compute-particles',
    'webgpu-spotlight': 'webgpu-spotlight',
    'webgpu-compute-birds': 'webgpu-compute-birds',
    'webgpu-parallax-uv': 'webgpu-parallax-uv',
    'webgpu-tsl-raging-sea': 'webgpu-tsl-raging-sea',
    'webgpu-tsl-linked-particles': 'webgpu-tsl-linked-particles',
    'webgpu-tsl-attractors-particles': 'webgpu-tsl-attractors-particles',
    'webgpu-custom-fog-scattering': 'webgpu-custom-fog-scattering',
    'webgpu-modifier-curve': 'webgpu-modifier-curve',
    'webgpu-particles': 'webgpu-particles',
    'buffergeometry-drawrange': 'buffergeometry-drawrange',
    'spline-editor': 'spline-editor',
    'terrain-sandbox': 'terrain-sandbox',
    'procedural-gl': 'procedural-gl',
    spout: 'spout',
    'dj-linked-particles': 'webgpu-tsl-linked-particles',
  }

  const BACK_SELECTOR = [
    'a.back-link',
    'a.dream-back-link',
    'a.iom-demo-back-link',
    'a.ag-back',
    'header a.back',
    'a.intro-logo-link',
    '#' + LINK_ID,
  ].join(',')

  function demoSlug() {
    const parts = location.pathname.replace(/\/+$/, '').split('/')
    const demosAt = parts.indexOf('demos')
    if (demosAt >= 0 && parts[demosAt + 1]) return parts[demosAt + 1]
    const demoAt = parts.indexOf('demo')
    if (demoAt >= 0 && parts[demoAt + 1]) return parts[demoAt + 1]
    return ''
  }

  function fallbackHref() {
    const stored = readStoredCard()
    if (stored) return '/#' + stored
    const card = DEMO_CARD[demoSlug()]
    if (card) return '/#' + card
    const fromLink = existingFallbackHash()
    if (fromLink && fromLink !== 'music' && fromLink !== 'top') return '/#' + fromLink
    return '/#experiments'
  }

  function existingFallbackHash() {
    const a = document.querySelector(BACK_SELECTOR)
    if (!(a instanceof HTMLAnchorElement)) return ''
    try {
      return new URL(a.href, location.href).hash.replace(/^#/, '').trim()
    } catch {
      return ''
    }
  }

  function readStoredCard() {
    try {
      const raw = sessionStorage.getItem(RETURN_KEY)
      if (!raw) return ''
      if (raw.charAt(0) === '{') {
        const data = JSON.parse(raw)
        const id = String(data.projectId || '').trim()
        if (!id || id === 'music' || id === 'top') return ''
        return id
      }
      const id = raw.trim()
      if (!id || id === 'music' || id === 'top') return ''
      return id
    } catch {
      return ''
    }
  }

  function isEmbeddedPreview() {
    try {
      return window.self !== window.top
    } catch {
      return true
    }
  }

  function isCardHoverEmbed() {
    try {
      return new URLSearchParams(location.search).get('cardEmbed') === '1'
    } catch {
      return false
    }
  }

  function isSameOriginReferrer() {
    const ref = document.referrer
    if (!ref) return false
    try {
      const url = new URL(ref)
      if (url.origin === location.origin) return true
      const host = url.hostname.replace(/^www\./, '')
      return host === 'iobjectm.com' || host === 'localhost'
    } catch {
      return false
    }
  }

  function goBack(event) {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (window.opener && !window.opener.closed) {
      try {
        window.close()
        return
      } catch {
        /* fall through */
      }
    }

    if (history.length > 1 && isSameOriginReferrer()) {
      history.back()
      return
    }

    location.href = fallbackHref()
  }

  function isStaticFallback(el) {
    if (!(el instanceof HTMLElement)) return false
    const style = (el.getAttribute('style') || '').replace(/\s/g, '').toLowerCase()
    return style.includes('position:static')
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      a.iom-back {
        position: fixed !important;
        top: max(12px, env(safe-area-inset-top, 0px));
        left: max(12px, env(safe-area-inset-left, 0px));
        z-index: 10050 !important;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        min-width: 44px;
        padding: 0.55rem 1rem !important;
        margin: 0;
        box-sizing: border-box;
        border-radius: 999px !important;
        border: 1px solid rgba(0, 229, 255, 0.55) !important;
        background: rgba(6, 10, 16, 0.82) !important;
        color: #e8fdff !important;
        font: 600 13px/1.2 system-ui, -apple-system, sans-serif !important;
        letter-spacing: 0.04em;
        text-decoration: none !important;
        text-transform: none !important;
        white-space: nowrap;
        pointer-events: auto !important;
        cursor: pointer;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 0 16px rgba(0, 229, 255, 0.35), 0 0 2px rgba(0, 229, 255, 0.8);
        transform: none !important;
      }
      a.iom-back:hover,
      a.iom-back:focus-visible {
        color: #fff !important;
        border-color: rgba(0, 229, 255, 0.9) !important;
        box-shadow: 0 0 22px rgba(0, 229, 255, 0.55), 0 0 4px #00e5ff;
        outline: none;
      }
      a.iom-back:focus-visible {
        outline: 2px solid #00e5ff;
        outline-offset: 3px;
      }
      @media (prefers-reduced-motion: no-preference) {
        a.iom-back {
          animation: iom-back-pulse 2.4s ease-in-out infinite;
        }
      }
      @keyframes iom-back-pulse {
        0%, 100% { box-shadow: 0 0 12px rgba(0, 229, 255, 0.32), 0 0 2px rgba(0, 229, 255, 0.7); }
        50% { box-shadow: 0 0 26px rgba(0, 229, 255, 0.62), 0 0 6px #00e5ff; }
      }
      html.is-iom-card-embed a.iom-back,
      html.is-iom-card-embed a.back-link,
      html.is-iom-card-embed a.dream-back-link {
        display: none !important;
      }
    `
    document.head.appendChild(style)
  }

  function decorate(el, primary) {
    if (!(el instanceof HTMLAnchorElement)) return
    el.addEventListener('click', goBack)
    if (!primary || isStaticFallback(el)) return
    el.classList.add('iom-back')
    el.id = el.id || LINK_ID
    el.setAttribute('href', fallbackHref())
    el.setAttribute('aria-label', LABEL)
    if (!/back to iom/i.test(el.textContent || '')) {
      el.textContent = '← ' + LABEL
    }
  }

  function findExisting() {
    const nodes = Array.from(document.querySelectorAll(BACK_SELECTOR)).filter(
      (el) => el instanceof HTMLAnchorElement && !isStaticFallback(el),
    )
    return nodes[0] || null
  }

  function mount() {
    if (isCardHoverEmbed() || isEmbeddedPreview()) {
      document.documentElement.classList.add('is-iom-card-embed')
      return
    }

    ensureStyles()

    let primary = findExisting()
    if (!primary) {
      primary = document.createElement('a')
      primary.id = LINK_ID
      primary.className = 'back-link iom-back'
      primary.textContent = '← ' + LABEL
      const parent = document.body
      if (parent.firstChild) parent.insertBefore(primary, parent.firstChild)
      else parent.appendChild(primary)
    }

    decorate(primary, true)

    document.querySelectorAll(BACK_SELECTOR).forEach((el) => {
      if (el === primary) return
      decorate(el, false)
    })
  }

  function boot() {
    mount()
    const observer = new MutationObserver(() => {
      if (document.getElementById(LINK_ID) || findExisting()) return
      if (isCardHoverEmbed() || isEmbeddedPreview()) return
      mount()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  global.iomDemoGoBack = goBack
})(typeof window !== 'undefined' ? window : globalThis)
