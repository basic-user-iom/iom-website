import { Suspense, useEffect, useState, type ReactNode } from 'react'

type DeferredHomeBodyProps = {
  children: ReactNode
  /** Section ids to keep as anchors while JS chunks are deferred. */
  sectionIds: string[]
}

/**
 * Keep the first paint to Hero-only: portfolio / clients / about mount after the
 * visitor scrolls (or after a long idle fallback / hash deep-link).
 * Intersection alone is not enough — a short hero leaves the next block in-view
 * on first paint and would defeat the deferral.
 */
export function DeferredHomeBody({ children, sectionIds }: DeferredHomeBodyProps) {
  const [ready, setReady] = useState(() =>
    typeof window !== 'undefined' ? Boolean(window.location.hash) : false,
  )

  useEffect(() => {
    if (ready) return

    let cancelled = false
    let fallbackId = 0

    const mount = () => {
      if (cancelled) return
      setReady(true)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onHash)
      if (fallbackId) window.clearTimeout(fallbackId)
    }

    const onScroll = () => {
      if (window.scrollY > 40) mount()
    }

    const onHash = () => {
      if (window.location.hash) mount()
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

  if (ready) {
    return <Suspense fallback={null}>{children}</Suspense>
  }

  return (
    <div className="home-body-deferred" aria-hidden="true">
      {sectionIds.map((id) => (
        <div key={id} id={id} className="section-block section-block--pending" />
      ))}
      <div id="clients" className="section-block section-block--pending" />
      <div id="about" className="section-block section-block--pending" />
    </div>
  )
}
