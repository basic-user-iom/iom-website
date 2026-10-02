/** A tap survives only a single, short, stationary primary-pointer gesture. */
export class SelectionGesture {
  private readonly pointers = new Set<number>();
  private start: { id: number; x: number; y: number; time: number } | null = null;

  down(id: number, x: number, y: number, time: number, primary = true) {
    this.pointers.add(id);
    this.start = this.pointers.size === 1 && primary ? { id, x, y, time } : null;
  }
  move(id: number, x: number, y: number) {
    if (this.start?.id === id && Math.hypot(x - this.start.x, y - this.start.y) > 7) this.start = null;
  }
  up(id: number, x: number, y: number, time: number): boolean {
    this.move(id, x, y);
    const tap = this.start?.id === id && this.pointers.size === 1 && time - this.start.time < 650;
    this.pointers.delete(id);
    this.start = null;
    return tap;
  }
  cancel(id?: number) {
    this.start = null;
    if (id !== undefined) this.pointers.delete(id);
  }
}
