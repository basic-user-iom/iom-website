/**
 * One-shot screen / window / tab capture as a PNG blob.
 * Stops the display stream immediately after the frame is grabbed.
 */
export async function captureDisplayScreenshot(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })

  try {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()

    await new Promise<void>((resolve, reject) => {
      const done = () => resolve()
      if (video.videoWidth > 0) {
        done()
        return
      }
      video.onloadedmetadata = () => done()
      video.onerror = () => reject(new Error('Screenshot stream failed'))
      window.setTimeout(() => {
        if (video.videoWidth > 0) done()
        else reject(new Error('Screenshot timed out'))
      }, 8000)
    })

    // Let the first painted frame settle
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Screenshot encode failed'))),
        'image/png',
      )
    })
    return blob
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

export function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime && mime.startsWith('image/'))
}
