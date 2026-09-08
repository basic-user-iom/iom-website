import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'

type VisualizerMountOptions = {
  visualizer: MusicPlayerVisualizerLike
  container: HTMLElement
  onContextLost: (error: Error) => void
}

function disposeAfterFailedMount(visualizer: MusicPlayerVisualizerLike) {
  try {
    visualizer.dispose()
  } catch (disposeError) {
    console.error('[music-player] visualizer cleanup failed', disposeError)
  }
}

/**
 * Mount and validate the first frame as one guarded operation. The returned
 * cleanup only owns listeners; the caller still owns the visualizer instance.
 */
export async function mountMusicPlayerVisualizer({
  visualizer,
  container,
  onContextLost,
}: VisualizerMountOptions): Promise<() => void> {
  let canvas: HTMLCanvasElement | null = null
  let contextLossHandler: ((event: Event) => void) | null = null

  const removeContextListener = () => {
    if (canvas && contextLossHandler) {
      canvas.removeEventListener('webglcontextlost', contextLossHandler)
    }
    canvas = null
    contextLossHandler = null
  }

  try {
    await visualizer.mount(container)
    const rect = container.getBoundingClientRect()
    visualizer.resize(rect.width, rect.height)
    visualizer.update(0.016, performance.now() / 1000, false, null)

    canvas = container.querySelector('canvas')
    if (canvas) {
      contextLossHandler = (event) => {
        event.preventDefault()
        onContextLost(new Error('WebGL context lost'))
      }
      canvas.addEventListener('webglcontextlost', contextLossHandler)
    }

    return removeContextListener
  } catch (error) {
    removeContextListener()
    disposeAfterFailedMount(visualizer)
    throw error
  }
}
