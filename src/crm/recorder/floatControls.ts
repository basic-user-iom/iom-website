export type FloatControlStatus = 'recording' | 'paused'

export interface FloatControlLabels {
  title: string
  pause: string
  resume: string
  cameraOn: string
  cameraOff: string
  stop: string
  hint: string
  statusRecording: string
  statusPaused: string
}

export interface FloatControlState {
  status: FloatControlStatus
  cameraOn: boolean
  canToggleCamera: boolean
  labels: FloatControlLabels
}

export interface FloatControlHandlers {
  onPause: () => void
  onResume: () => void
  onToggleCamera: () => void
  onStop: () => void
}

export interface FloatControlsHandle {
  update: (state: FloatControlState) => void
  close: () => void
}

type PipWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (options?: {
      width?: number
      height?: number
    }) => Promise<Window>
  }
}

function injectUi(
  doc: Document,
  state: FloatControlState,
  handlers: FloatControlHandlers,
): { root: HTMLElement; sync: (next: FloatControlState) => void } {
  const style = doc.createElement('style')
  style.textContent = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #12161d;
      color: #e8eef5;
    }
    .wrap {
      padding: 10px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 100vh;
    }
    h1 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #9eb0c4;
      text-transform: uppercase;
    }
    .status {
      font-size: 13px;
      font-weight: 600;
      color: #7fd4ff;
    }
    .status.is-paused { color: #ffc857; }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      appearance: none;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      color: #e8eef5;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      flex: 1 1 auto;
      min-width: 88px;
    }
    button:hover { background: rgba(255,255,255,0.12); }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.primary {
      background: #1aa6c1;
      border-color: #1aa6c1;
      color: #041018;
    }
    button.danger {
      background: rgba(220, 70, 70, 0.2);
      border-color: rgba(255,120,120,0.35);
      color: #ffc0c0;
    }
    .hint {
      font-size: 11px;
      color: #7a8799;
      line-height: 1.35;
    }
  `
  doc.head.appendChild(style)

  const root = doc.createElement('div')
  root.className = 'wrap'
  doc.body.appendChild(root)

  const title = doc.createElement('h1')
  const statusEl = doc.createElement('div')
  statusEl.className = 'status'
  const row = doc.createElement('div')
  row.className = 'row'
  const pauseBtn = doc.createElement('button')
  const cameraBtn = doc.createElement('button')
  const stopBtn = doc.createElement('button')
  stopBtn.className = 'danger'
  const hint = doc.createElement('p')
  hint.className = 'hint'

  row.append(pauseBtn, cameraBtn, stopBtn)
  root.append(title, statusEl, row, hint)

  pauseBtn.addEventListener('click', () => {
    if (pauseBtn.dataset.mode === 'pause') handlers.onPause()
    else handlers.onResume()
  })
  cameraBtn.addEventListener('click', () => handlers.onToggleCamera())
  stopBtn.addEventListener('click', () => handlers.onStop())

  const sync = (next: FloatControlState) => {
    title.textContent = next.labels.title
    hint.textContent = next.labels.hint
    stopBtn.textContent = next.labels.stop
    const paused = next.status === 'paused'
    statusEl.textContent = paused
      ? next.labels.statusPaused
      : next.labels.statusRecording
    statusEl.classList.toggle('is-paused', paused)
    if (paused) {
      pauseBtn.textContent = next.labels.resume
      pauseBtn.dataset.mode = 'resume'
      pauseBtn.classList.add('primary')
    } else {
      pauseBtn.textContent = next.labels.pause
      pauseBtn.dataset.mode = 'pause'
      pauseBtn.classList.remove('primary')
    }
    cameraBtn.disabled = !next.canToggleCamera
    cameraBtn.textContent = next.cameraOn
      ? next.labels.cameraOn
      : next.labels.cameraOff
  }

  sync(state)
  return { root, sync }
}

/**
 * Always-on-top recorder controls.
 * Prefer a small popup (reliable with a button click); Document PiP as fallback.
 */
export async function openRecorderFloatControls(
  initial: FloatControlState,
  handlers: FloatControlHandlers,
): Promise<FloatControlsHandle> {
  let win: Window | null = null
  let sync: ((next: FloatControlState) => void) | null = null

  const close = () => {
    try {
      win?.close()
    } catch {
      /* ignore */
    }
    win = null
    sync = null
  }

  const attach = (target: Window) => {
    win = target
    target.document.title = initial.labels.title
    const ui = injectUi(target.document, initial, handlers)
    sync = ui.sync
    target.addEventListener('pagehide', () => {
      win = null
      sync = null
    })
  }

  // Popup first — Document PiP right after screen-share has caused share drops.
  win = window.open(
    '',
    'iom-recorder-controls',
    'popup=yes,width=320,height=200,noopener=no',
  )
  if (win) {
    attach(win)
    return {
      update: (state) => sync?.(state),
      close,
    }
  }

  const docPip = (window as PipWindow).documentPictureInPicture
  if (docPip?.requestWindow) {
    try {
      const pipWin = await docPip.requestWindow({ width: 300, height: 180 })
      attach(pipWin)
      return {
        update: (state) => sync?.(state),
        close,
      }
    } catch {
      /* fall through */
    }
  }

  throw new Error('Popup blocked — allow popups for floating recorder controls')
}

export function floatControlsSupported(): boolean {
  return Boolean((window as PipWindow).documentPictureInPicture?.requestWindow)
}
