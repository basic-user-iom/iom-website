export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function preferMobileQuality(): boolean {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 860px)').matches
  const saveData =
    'connection' in navigator &&
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
  return coarse || narrow || saveData || (navigator.hardwareConcurrency || 8) <= 4
}

export function measureTransferredBytes(): number {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  let total = 0
  for (const entry of entries) {
    const name = entry.name
    if (
      /kelly-kettle|three|addons|GLB|glb|kelly-kettle-basecamp/i.test(name) ||
      /assets\/.*(?:three|kelly)/i.test(name)
    ) {
      total += entry.transferSize || 0
    }
  }
  return total
}
