import './ui/styles.css'
import { ProjectStore } from './persistence/projectStore'
import { createEmptyProject } from './persistence/schema'
import { Transport } from './transport/transport'
import { createStudioRenderer } from './renderer/createRenderer'
import { mountPresentationShell } from './presentation/presentationShell'

/**
 * Presentation entry — curated client shell only.
 * Do not import Studio authoring UI modules here.
 */

const root = document.getElementById('app')
if (!root) throw new Error('#app missing')

const project = createEmptyProject('Client Presentation')
project.presentation.accessPolicy = 'access-controlled'
project.presentation.defaultMode = 'guided'

const store = new ProjectStore(project)
const transport = new Transport()
transport.setDuration(10)
transport.setOwnership({ camera: 'shot-sequence' })

let muted = false

const shell = mountPresentationShell(root, {
  onPlayPause: () => {
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  },
  onMuteToggle: () => {
    muted = !muted
    shell.setStatus(muted ? 'Muted' : 'Sound on (no media in Phase 1)')
    const btn = root.querySelector('[data-action="mute"]')
    if (btn) btn.textContent = muted ? 'Unmute' : 'Mute'
  },
  onFullscreen: async () => {
    try {
      if (!document.fullscreenElement) await root.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      shell.setStatus('Fullscreen unavailable')
    }
  },
  onExit: () => {
    const studio = new URL('index.html', location.href)
    if (new URLSearchParams(location.search).get('forceWebGL2') === '1') {
      studio.searchParams.set('forceWebGL2', '1')
    }
    location.assign(studio)
  },
  onInfo: () => {
    const credits = store
      .getSnapshot()
      .project.credits.map((c) => c.label)
      .join(' · ')
    shell.setStatus(credits || 'IOM Automotive Presentation')
  },
})

store.subscribe((snap) => shell.updateStore(snap))
transport.subscribe((snap) => shell.updateTransport(snap))
shell.updateStore(store.getSnapshot())
shell.updateTransport(transport.getSnapshot())

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    const snap = transport.getSnapshot()
    if (snap.playing) transport.pause()
    else transport.play()
  } else if (e.key === 'Escape') {
    const studio = new URL('index.html', location.href)
    location.assign(studio)
  }
})

async function boot() {
  const renderer = await createStudioRenderer(shell.viewportHost)
  shell.setRendererInfo(renderer)
  renderer.applyEnvironmentState(store.getSnapshot().project.environment)
  shell.setStatus('Access-controlled presentation shell · no authoring chrome')

  const resize = () => {
    const rect = shell.viewportHost.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height)
    renderer.render()
  }
  resize()
  window.addEventListener('resize', resize)

  let raf = 0
  const loop = () => {
    renderer.render()
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(raf)
    renderer.dispose()
    transport.dispose()
  })
}

boot().catch((err) => {
  shell.setStatus(`Renderer boot failed: ${err instanceof Error ? err.message : String(err)}`)
})
