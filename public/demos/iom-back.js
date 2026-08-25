/**
 * Shared “Back to IOM” control for first-party demos.
 * Always return to /#<projectId> — never history.back() (that restores leftover
 * homepage hashes like #music). Visible above the click-to-start gate
 * (z-index 10050 > gate 9999).
 */
;(function (global) {
  const STYLE_ID = 'iom-back-style'
  const LINK_ID = 'iom-back-link'
  const RETURN_KEY = 'iom:returnCard'
  const LABEL = 'Back to IOM'

  /** Homepage menu hashes — never a project card to restore. */
  const NAV_HASH = {
    software: 1,
    '3d': 1,
    '360': 1,
    photography: 1,
    music: 1,
    experiments: 1,
    clients: 1,
    about: 1,
    contact: 1,
    'engage-iom': 1,
    'main-content': 1,
    top: 1,
  }

  function isCardId(id) {
    return Boolean(id) && !NAV_HASH[id]
  }

  /** Demo folder slug → homepage project card id (never music). */
  const DEMO_CARD = {
    'streets-gl': 'streets-gl-bridge',
    'panorama-360': 'panorama-360-tour',
    'iom-studio': 'iom-studio',
    'iom-studio-app': 'iom-studio',
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
    'artist-globe': 'artist-globe',
    'image-prep': 'image-prep',
    'case-studies': '360',
    'case-studies/black-witness': 'panorama-suite',
    'case-studies/3d-viewer': 'case-study-3d-viewer',
    'case-studies/message-in-a-bottle': 'case-study-message-in-a-bottle',
    'case-studies/labelled-custom-cursor': 'case-study-labelled-custom-cursor',
    icm: 'crm-demo',
    evly: 'crm-demo',
    'kelly-kettle': 'crm-demo',
    'precision-object': 'crm-demo',
    dukta: 'crm-demo',
    'dukta-linar-concept': 'crm-demo',
    'automotive-studio': 'crm-demo',
    'floating-stone': 'crm-demo',
    'crm-demo': 'crm-demo',
  }

  const BACK_SELECTOR = [
    'a.back-link',
    'a.dream-back-link',
    'a.iom-demo-back-link',
    'a.ag-back',
    'a.imgprep__back',
    'a.case-study-back',
    'a.crm-demo-back',
    'header a.back',
    'a.intro-logo-link',
    '#' + LINK_ID,
  ].join(',')

  const KEEP_VISIBLE = 'a.intro-logo-link, a.crm-demo-back'

  function pathParts() {
    const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
    if (parts[0] && /^(en|de|fr|nl|it|es)$/i.test(parts[0])) return parts.slice(1)
    return parts
  }

  function isHomepagePath() {
    return pathParts().length === 0
  }

  function demoSlug() {
    const parts = pathParts()
    const demosAt = parts.indexOf('demos')
    if (demosAt >= 0 && parts[demosAt + 1]) return parts[demosAt + 1]
    const demoAt = parts.indexOf('demo')
    if (demoAt >= 0 && parts[demoAt + 1]) return parts[demoAt + 1]
    if (parts[0] === 'artist-globe') return 'artist-globe'
    if (parts[0] === 'crm-demo') return 'crm-demo'
    if (parts[0] === 'tools' && parts[1] === 'image-prep') return 'image-prep'
    if (parts[0] === 'case-studies') {
      return parts[1] ? 'case-studies/' + parts[1] : 'case-studies'
    }
    return ''
  }

  function fallbackHref() {
    const stored = readStoredCard()
    if (isCardId(stored)) return '/#' + stored
    const card = DEMO_CARD[demoSlug()]
    if (card) return '/#' + card
    const fromLink = existingFallbackHash()
    if (isCardId(fromLink)) return '/#' + fromLink
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

  function readStoredPayload() {
    try {
      const raw = sessionStorage.getItem(RETURN_KEY)
      if (!raw) return null
      if (raw.charAt(0) === '{') {
        const data = JSON.parse(raw)
        const id = String(data.projectId || '').trim()
        if (!isCardId(id)) return null
        return data
      }
      const id = raw.trim()
      return isCardId(id) ? { projectId: id } : null
    } catch {
      return null
    }
  }

  function readStoredCard() {
    const data = readStoredPayload()
    return data && data.projectId ? String(data.projectId) : ''
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

  function rememberCard(id) {
    if (!isCardId(id)) return
    try {
      const prev = readStoredPayload() || {}
      sessionStorage.setItem(
        RETURN_KEY,
        JSON.stringify({
          projectId: id,
          section: prev.section,
          scrollY: typeof prev.scrollY === 'number' ? prev.scrollY : undefined,
          at: Date.now(),
        }),
      )
    } catch {
      /* private mode */
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

    const href = fallbackHref()
    const cardId = href.replace(/^\/#/, '')
    rememberCard(readStoredCard() || cardId)
    const stored = readStoredPayload()
    // Exact Y restore: skip the hash so the browser does not jump to a card/section first.
    if (stored && typeof stored.scrollY === 'number') {
      location.assign('/')
      return
    }
    location.assign(href)
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
        top: max(0.75rem, env(safe-area-inset-top, 0px)) !important;
        left: max(0.75rem, env(safe-area-inset-left, 0px)) !important;
        right: auto !important;
        bottom: auto !important;
        z-index: 10050 !important;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        isolation: isolate;
        min-height: 44px;
        min-width: 44px;
        padding: 0.35rem 0.7rem !important;
        margin: 0;
        box-sizing: border-box;
        border-radius: 4px !important;
        border: 1px solid rgba(94, 184, 192, 0.55) !important;
        background: #08080a !important;
        color: #00e5ff !important;
        font: 600 0.65rem/1.2 "IBM Plex Sans", system-ui, sans-serif !important;
        letter-spacing: 0.1em;
        text-decoration: none !important;
        text-transform: uppercase !important;
        white-space: nowrap;
        pointer-events: auto !important;
        cursor: pointer;
        box-shadow: none !important;
        transform: none !important;
      }
      a.iom-back::after {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: inherit;
        border: 1px solid rgba(94, 184, 192, 0.45);
        pointer-events: none;
        z-index: -1;
      }
      a.iom-back:hover,
      a.iom-back:focus-visible {
        color: #00e5ff !important;
        border-color: rgba(0, 229, 255, 0.7) !important;
        background: rgba(0, 229, 255, 0.15) !important;
        outline: none;
      }
      a.iom-back:focus-visible {
        outline: 2px solid #00e5ff;
        outline-offset: 3px;
      }
      @media (prefers-reduced-motion: no-preference) {
        a.iom-back::after {
          animation: iom-back-pulse 1.8s ease-in-out infinite;
        }
      }
      @keyframes iom-back-pulse {
        0%, 100% { transform: scale(1); opacity: 0.25; }
        50% { transform: scale(1.12); opacity: 0.9; }
      }
      @media (prefers-reduced-motion: reduce) {
        a.iom-back::after {
          animation: none;
          opacity: 0.45;
        }
      }
      html.is-iom-card-embed a.iom-back,
      html.is-iom-card-embed a.back-link,
      html.is-iom-card-embed a.dream-back-link,
      html.is-iom-card-embed a.ag-back,
      html.is-iom-card-embed a.imgprep__back,
      html.is-iom-card-embed a.case-study-back,
      html.is-iom-card-embed a.crm-demo-back {
        display: none !important;
      }
      body.crm-demo-route a.iom-back:not(.crm-demo-back) {
        display: none !important;
      }
    `
    document.head.appendChild(style)
  }

  function applyLabel(el) {
    el.setAttribute('href', fallbackHref())
    el.setAttribute('aria-label', LABEL)
    el.textContent = '← ' + LABEL
  }

  function isInFlowBack(el) {
    return isStaticFallback(el) || (el instanceof HTMLElement && el.classList.contains('crm-demo-back'))
  }

  function decorate(el, primary) {
    if (!(el instanceof HTMLAnchorElement)) return
    if (el.dataset.iomBound !== '1') {
      el.dataset.iomBound = '1'
      el.addEventListener('click', goBack)
    }
    if (isInFlowBack(el)) {
      applyLabel(el)
      return
    }
    if (!primary) return
    el.classList.add('iom-back')
    el.id = el.id || LINK_ID
    applyLabel(el)
  }

  function findExisting() {
    const nodes = Array.from(document.querySelectorAll(BACK_SELECTOR)).filter(
      (el) => el instanceof HTMLAnchorElement && !isInFlowBack(el),
    )
    return nodes[0] || null
  }

  function mount() {
    if (isHomepagePath()) return
    if (isCardHoverEmbed() || isEmbeddedPreview()) {
      document.documentElement.classList.add('is-iom-card-embed')
      return
    }

    ensureStyles()

    const inFlow = document.querySelector('a.crm-demo-back')
    if (inFlow instanceof HTMLAnchorElement) {
      decorate(inFlow, false)
      document.querySelectorAll('a.iom-back').forEach((el) => {
        if (el === inFlow) return
        el.remove()
      })
      return
    }

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
      if (el.matches(KEEP_VISIBLE)) {
        decorate(el, false)
        return
      }
      if (isInFlowBack(el)) {
        decorate(el, false)
        return
      }
      el.hidden = true
      el.setAttribute('aria-hidden', 'true')
      decorate(el, false)
    })
  }

  function boot() {
    mount()
    const observer = new MutationObserver(() => {
      if (isCardHoverEmbed() || isEmbeddedPreview()) return
      const inFlow = document.querySelector('a.crm-demo-back')
      if (inFlow) {
        const overlay = document.querySelector('a.iom-back:not(.crm-demo-back)')
        if (inFlow.getAttribute('data-iom-bound') !== '1' || overlay) mount()
        return
      }
      if (document.querySelector('a.iom-back')) return
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
