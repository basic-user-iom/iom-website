/**
 * Shared UI chrome helpers for IOM WebGPU demos:
 * - Collapsible inspector-style side panels
 * - Parameters button toggles all overlay panels (camera views + inspector mini-panel)
 */

export function initCameraViewsPanelCollapse(storageKey = 'demo-camera-views-collapsed') {
  const panel = document.getElementById('camera-views-panel')
  const header = panel?.querySelector('.panel-header')
  if (!panel || !header) return null

  let collapsed = false
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) collapsed = stored === '1'
  } catch {
    // ignore storage failures
  }

  const setCollapsed = (nextCollapsed, { persist = true } = {}) => {
    collapsed = nextCollapsed
    panel.classList.toggle('is-open', !collapsed)
    header.setAttribute('aria-expanded', String(!collapsed))
    if (persist) {
      try {
        localStorage.setItem(storageKey, collapsed ? '1' : '0')
      } catch {
        // ignore storage failures
      }
    }
  }

  header.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, label')) return
    setCollapsed(!collapsed)
  })

  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setCollapsed(!collapsed)
  })

  setCollapsed(collapsed, { persist: false })
  return { setCollapsed }
}

export function initDemoUiChrome(renderer, options = {}) {
  const {
    storageKey = 'demo-ui-chrome-visible',
    shouldHideCameraViews = () => false,
  } = options

  let uiChromeVisible = true
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) uiChromeVisible = stored === '1'
  } catch {
    // ignore storage failures
  }

  const getProfiler = () => renderer?.inspector?.profiler
  const getParametersTab = () => renderer?.inspector?.parameters

  const isParametersPanelOpen = () => {
    const parametersTab = getParametersTab()
    const miniContent = parametersTab?.miniContent
    return Boolean(
      miniContent && miniContent.style.display !== 'none' && miniContent.children.length > 0,
    )
  }

  const applyUiChrome = ({ openParameters = false } = {}) => {
    const cameraPanel = document.getElementById('camera-views-panel')
    const hideCamera = !uiChromeVisible || shouldHideCameraViews()

    if (cameraPanel) {
      cameraPanel.classList.toggle('ui-chrome-hidden', hideCamera)
    }

    document.body.classList.toggle('demo-ui-chrome-hidden', !uiChromeVisible)

    const profiler = getProfiler()
    if (!profiler) return

    if (!uiChromeVisible) {
      profiler.hide()
      return
    }

    if (openParameters) {
      const parametersTab = getParametersTab()
      if (parametersTab) profiler.show(parametersTab)
    }
  }

  const persistUiChrome = () => {
    try {
      localStorage.setItem(storageKey, uiChromeVisible ? '1' : '0')
    } catch {
      // ignore storage failures
    }
  }

  const setUiChromeVisible = (visible, { openParameters = false } = {}) => {
    uiChromeVisible = visible
    persistUiChrome()
    applyUiChrome({ openParameters })
  }

  const toggleUiChromeFromParameters = () => {
    if (isParametersPanelOpen()) {
      setUiChromeVisible(false)
      return
    }

    setUiChromeVisible(true, { openParameters: true })
  }

  const hookParametersButton = () => {
    const parametersTab = getParametersTab()
    const btn = parametersTab?.builtinButton
    if (!btn || btn.dataset.demoUiChromeHooked === '1') return false

    btn.dataset.demoUiChromeHooked = '1'
    btn.onclick = (event) => {
      event.stopPropagation()
      toggleUiChromeFromParameters()
    }
    return true
  }

  const tryInit = () => {
    const hooked = hookParametersButton()
    applyUiChrome({ openParameters: false })
    return hooked
  }

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(tryInit, 50)
    setTimeout(tryInit, 250)
  }

  return {
    applyUiChrome,
    setUiChromeVisible,
    isUiChromeVisible: () => uiChromeVisible,
  }
}
