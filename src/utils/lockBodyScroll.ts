let lockCount = 0
let locked = false
let savedScrollY = 0
let unlockTimer = 0
let prevHtmlOverflow = ''
let prevHtmlOverscroll = ''
let prevBodyOverflow = ''
let prevBodyPosition = ''
let prevBodyTop = ''
let prevBodyLeft = ''
let prevBodyRight = ''
let prevBodyWidth = ''

function applyLock(): void {
  const html = document.documentElement
  const body = document.body

  savedScrollY = window.scrollY || window.pageYOffset || 0
  prevHtmlOverflow = html.style.overflow
  prevHtmlOverscroll = html.style.overscrollBehavior
  prevBodyOverflow = body.style.overflow
  prevBodyPosition = body.style.position
  prevBodyTop = body.style.top
  prevBodyLeft = body.style.left
  prevBodyRight = body.style.right
  prevBodyWidth = body.style.width

  html.classList.add('is-overlay-open')
  html.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${savedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
}

function releaseLock(): void {
  const html = document.documentElement
  const body = document.body
  const y = savedScrollY
  const prevScrollBehavior = html.style.scrollBehavior

  html.style.overflow = prevHtmlOverflow
  html.style.overscrollBehavior = prevHtmlOverscroll
  body.style.overflow = prevBodyOverflow
  body.style.position = prevBodyPosition
  body.style.top = prevBodyTop
  body.style.left = prevBodyLeft
  body.style.right = prevBodyRight
  body.style.width = prevBodyWidth
  html.style.scrollBehavior = 'auto'
  window.scrollTo(0, y)
  html.classList.remove('is-overlay-open')
  html.classList.add('is-restoring-scroll')
  window.scrollTo(0, y)
  window.requestAnimationFrame(() => {
    window.scrollTo(0, y)
    window.setTimeout(() => {
      window.scrollTo(0, y)
      html.classList.remove('is-restoring-scroll')
      html.style.scrollBehavior = prevScrollBehavior
    }, 80)
  })
}

/** Prevent background scroll while a viewport overlay is open (iOS-safe). */
export function lockBodyScroll(): () => void {
  if (unlockTimer) {
    window.clearTimeout(unlockTimer)
    unlockTimer = 0
  }

  if (!locked) {
    applyLock()
    locked = true
  }
  lockCount += 1

  return () => {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return
    // Strict Mode remounts in the same tick — delay restore so a re-lock keeps the original scroll.
    unlockTimer = window.setTimeout(() => {
      unlockTimer = 0
      if (lockCount === 0 && locked) {
        releaseLock()
        locked = false
      }
    }, 50)
  }
}
