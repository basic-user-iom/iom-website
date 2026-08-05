const STORAGE_KEY = 'iom.automotive-studio.inspectorWidth'
const DEFAULT_WIDTH = 340
const MIN_WIDTH = 240
const KEY_STEP = 16

function maxWidth() {
  return Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.6))
}

function clampWidth(px: number) {
  return Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, px)))
}

/**
 * Drag handle between viewport and inspector. Width lives in `--as-inspector-w`
 * on the app root and is remembered across reloads.
 */
export function setupInspectorResize(app: HTMLElement) {
  const handle = app.querySelector<HTMLElement>('[data-inspector-resizer]')
  if (!handle) return

  let width = DEFAULT_WIDTH
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  if (Number.isFinite(stored) && stored > 0) width = stored

  const apply = (px: number, persist: boolean) => {
    width = clampWidth(px)
    app.style.setProperty('--as-inspector-w', `${width}px`)
    handle.setAttribute('aria-valuenow', String(width))
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, String(width))
      } catch {
        // Private mode / quota — resizing still works for this session.
      }
    }
  }
  apply(width, false)

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    handle.classList.add('as-resizer--active')
    const right = app.getBoundingClientRect().right

    const onMove = (move: PointerEvent) => apply(right - move.clientX, false)
    const onUp = () => {
      handle.classList.remove('as-resizer--active')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      apply(width, true)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  })

  handle.addEventListener('dblclick', () => apply(DEFAULT_WIDTH, true))

  handle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') apply(width + KEY_STEP, true)
    else if (event.key === 'ArrowRight') apply(width - KEY_STEP, true)
    else if (event.key === 'Home') apply(DEFAULT_WIDTH, true)
    else return
    event.preventDefault()
  })

  window.addEventListener('resize', () => apply(width, false))
}
