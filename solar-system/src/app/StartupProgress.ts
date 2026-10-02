export interface DownloadProgress {
  readonly loaded: number;
  readonly total: number | null;
  readonly complete: boolean;
}

/** Count bytes actually received. Encoded Content-Length is not a decoded byte total. */
export async function downloadBinary(
  url: string,
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Orbital data download failed (HTTP ' + response.status + ').');
  const length = Number(response.headers.get('content-length'));
  const total = !response.headers.get('content-encoding') && length > 0 ? length : null;
  onProgress({ loaded: 0, total, complete: false });
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress({ loaded: buffer.byteLength, total: buffer.byteLength, complete: true });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;
      chunks.push(result.value);
      loaded += result.value.byteLength;
      onProgress({ loaded, total, complete: false });
    }
  } finally {
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  onProgress({ loaded, total: loaded, complete: true });
  return buffer.buffer;
}

export interface StartupProgress {
  readonly percent: number;
  readonly stage: string;
  readonly loadedBytes: number;
}

/** Download work and validation milestones, never an elapsed-time animation. */
export class StartupProgressTracker {
  private readonly downloads = [0, 0];
  private readonly bytes = [0, 0];
  private completedChecks = 0;
  private lastPercent = 5;
  public constructor(private readonly publish: (progress: StartupProgress) => void) {}
  public download(index: 0 | 1, progress: DownloadProgress): void {
    this.bytes[index] = progress.loaded;
    this.downloads[index] = progress.complete ? 1
      : progress.total === null ? 0 : Math.min(0.99, progress.loaded / progress.total);
    this.emit('Downloading orbital data');
  }
  public checkpoint(stage: string): void { this.completedChecks += 1; this.emit(stage); }
  public optionalBundleUnavailable(): void { this.downloads[1] = 1; this.emit('Continuing with planetary data'); }
  private emit(stage: string): void {
    // 5% app, 70% downloads, 20% four verification/decode milestones; final 5% first view.
    const percent = Math.min(95, Math.floor(5 + 35 * (this.downloads[0]! + this.downloads[1]!) + 5 * this.completedChecks));
    this.lastPercent = Math.max(this.lastPercent, percent);
    this.publish({ percent: this.lastPercent, stage, loadedBytes: this.bytes[0]! + this.bytes[1]! });
  }
}
