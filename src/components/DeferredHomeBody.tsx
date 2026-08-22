import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode, useState } from 'react'
import { hasReturnScrollY, peekReturnCard } from '../utils/demoNav'
import { isDeepLinkHash } from '../utils/homeHashScroll'

type DeferredHomeBodyProps = {
  children: ReactNode
  /** Section ids to keep as anchors while JS chunks are deferred. */
  sectionIds: string[]
}

/**
 * Keep scrollable page height while portfolio / clients / about chunks load.
 * A null Suspense fallback collapses the document to ~hero height and feels like
 * a hard freeze (cannot scroll, only hero visible) — especially on Ctrl+Shift+R.
 */
function PendingSections({ sectionIds }: { sectionIds: string[] }) {
  const pendingAnchors = [...sectionIds, 'clients']
  return (
    <div className="home-body-deferred" aria-hidden="true">
      {pendingAnchors.map((id) => (
        <div
          key={id}
          data-pending-anchor={id}
          className="section-block section-block--pending"
        />
      ))}
    </div>
  )
}

function restoreScrollY(y: number): void {
  const stored = peekReturnCard()
  if (hasReturnScrollY(stored) && stored) {
    window.scrollTo({ top: stored.scrollY ?? y, behavior: 'auto' })
    return
  }
  if (stored) return
  if (y <= 40) return
  if (window.scrollY >= y - 1) return
  window.scrollTo({ top: y, behavior: 'auto' })
}

/** After Suspense swaps placeholders for real sections, put scrollY back. */
function RestoreScrollOnMount({
  yRef,
  children,
}: {
  yRef: { current: number }
  children: ReactNode
}) {
  useLayoutEffect(() => {
    restoreScrollY(yRef.current)
  }, [yRef])
  return children
}

/**
 * Keep the first paint to Hero-only: portfolio / clients / about mount after the
 * visitor scrolls (or after a long idle fallback / hash deep-link).
 * Intersection alone is not enough — a short hero leaves the next block in-view
 * on first paint and would defeat the deferral.
 */
export function DeferredHomeBody({ children, sectionIds }: DeferredHomeBodyProps) {
  const [ready, setReady] = useState(() =>
    typeof window !== 'undefined'
      ? isDeepLinkHash(window.location.hash) || Boolean(peekReturnCard())
      : false,
  )
  const lastYRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0)

  useEffect(() => {
    const capture = () => {
      lastYRef.current = window.scrollY
    }
    window.addEventListener('scroll', capture, { passive: true })
    capture()
    return () => window.removeEventListener('scroll', capture)
  }, [])

  useEffect(() => {
    if (ready) return

    let cancelled = false
    let fallbackId = 0

    const mount = () => {
      if (cancelled) return
      lastYRef.current = window.scrollY
      setReady(true)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onHash)
      if (fallbackId) window.clearTimeout(fallbackId)
    }

    const onScroll = () => {
      lastYRef.current = window.scrollY
      if (window.scrollY > 40) mount()
    }

    const onHash = () => {
      if (isDeepLinkHash(window.location.hash) || Boolean(peekReturnCard())) mount()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hashchange', onHash)
    // Users who stay on the hero still get the rest without scrolling.
    fallbackId = window.setTimeout(mount, 8000)
    onScroll()

    return () => {
      cancelled = true
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onHash)
      if (fallbackId) window.clearTimeout(fallbackId)
    }
  }, [ready])

  useLayoutEffect(() => {
    if (!ready) return
    restoreScrollY(lastYRef.current)
  }, [ready])

  if (ready) {
    return (
      <Suspense fallback={<PendingSections sectionIds={sectionIds} />}>
        <RestoreScrollOnMount yRef={lastYRef}>{children}</RestoreScrollOnMount>
      </Suspense>
    )
  }

  return <PendingSections sectionIds={sectionIds} />
}
