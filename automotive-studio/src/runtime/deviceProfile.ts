/** Phones use the existing lightweight assets; desktop appearance stays unchanged. */
export function isPhoneViewport(width: number, height: number, coarsePointer: boolean): boolean {
  return width <= 600 || (coarsePointer && Math.min(width, height) <= 600)
}

export function usePhoneProfile(): boolean {
  return typeof window !== 'undefined' && isPhoneViewport(
    window.innerWidth, window.innerHeight, window.matchMedia('(pointer: coarse)').matches,
  )
}
