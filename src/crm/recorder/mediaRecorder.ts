export interface RecordingHandle {
  stop: () => Promise<Blob>
  pause: () => void
  resume: () => void
  /** Elapsed ms while actively recording (excludes pause). */
  getElapsedMs: () => number
}

export function startMediaRecorder(stream: MediaStream): RecordingHandle {
  const mime = pickMime()
  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 4_000_000,
  })

  let startedAt = performance.now()
  let accumulated = 0
  let paused = false

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  recorder.start(500)

  return {
    pause() {
      if (recorder.state === 'recording') {
        recorder.pause()
        accumulated += performance.now() - startedAt
        paused = true
      }
    },
    resume() {
      if (recorder.state === 'paused') {
        recorder.resume()
        startedAt = performance.now()
        paused = false
      }
    },
    getElapsedMs() {
      if (paused || recorder.state === 'paused') return accumulated
      if (recorder.state === 'inactive') return accumulated
      return accumulated + (performance.now() - startedAt)
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: mime }))
          return
        }
        recorder.onerror = () => reject(new Error('Recorder error'))
        recorder.onstop = () => {
          if (!paused) accumulated += performance.now() - startedAt
          resolve(new Blob(chunks, { type: mime || 'video/webm' }))
        }
        recorder.stop()
      })
    },
  }
}

function pickMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
