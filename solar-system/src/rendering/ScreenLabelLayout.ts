export interface ScreenLabelBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Place the full touch target, not a fixed-size estimate, beside its object. */
export function placeScreenLabelBounds(
  x: number, y: number, width: number, height: number,
  viewportWidth: number, viewportHeight: number, occupied: readonly ScreenLabelBounds[],
): ScreenLabelBounds | null {
  const edge = 4, gap = 4;
  if (width > viewportWidth - 2 * edge || height > viewportHeight - 2 * edge) return null;
  const candidates = [
    [x + 10, y - height], [x + 10, y + 4],
    [x - width - 10, y - height], [x - width - 10, y + 4],
    [x - width / 2, y - height - 10], [x - width / 2, y + 10],
  ] as const;
  for (const [candidateX, candidateY] of candidates) {
    const left = Math.max(edge, Math.min(viewportWidth - width - edge, candidateX));
    const top = Math.max(edge, Math.min(viewportHeight - height - edge, candidateY));
    const box = { left, top, right: left + width, bottom: top + height };
    if (!occupied.some(other => box.left < other.right + gap && box.right + gap > other.left && box.top < other.bottom + gap && box.bottom + gap > other.top)) return box;
  }
  return null;
}
