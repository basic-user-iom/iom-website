import { lazy, Suspense, useState } from 'react'
import { DEBUG } from './config/debug.js'
import { useConfigSync } from './hooks/useConfigurator.js'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion.js'
import { useViewer } from './hooks/useViewer.js'
import { ConfiguratorPanel } from './components/Configurator/ConfiguratorPanel.jsx'
import { Header } from './components/UI/Header.jsx'
import { HotspotCard } from './components/UI/HotspotCard.jsx'
import { InfoPanel } from './components/UI/InfoPanel.jsx'
import { ErrorScreen, LoadingScreen } from './components/UI/LoadingScreen.jsx'
import { UtilityControls, ViewControls } from './components/UI/UtilityControls.jsx'
import { CameraFramingPanel } from './components/UI/CameraFramingPanel.jsx'
import { DebugOverlay } from './components/UI/DebugOverlay.jsx'
import { isDemoUnlocked, tryCrmEmbedUnlock, unlockDemo } from './utils/demoAuth.js'

const HarpScene = lazy(() => import('./components/Viewer/HarpScene.jsx').then((mod) => ({ default: mod.HarpScene })))

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event) => {
    event.preventDefault()
    if (unlockDemo(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <main className="demo-gate">
      <section className="demo-gate__panel" aria-labelledby="demo-gate-title">
        <p className="kicker">IOM private client demo</p>
        <h1 id="demo-gate-title">Harp Configurator</h1>
        <p>Enter the preview password to continue.</p>
        <form className="demo-gate__form" onSubmit={submit}>
          <label htmlFor="demo-password">Password</label>
          <div className="demo-gate__row">
            <input
              id="demo-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(false)
              }}
              autoFocus
            />
            <button type="submit">Enter</button>
          </div>
          {error && <p className="demo-gate__error">Incorrect password.</p>}
        </form>
      </section>
    </main>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== 'undefined' && (isDemoUnlocked() || tryCrmEmbedUnlock()),
  )
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <ConfiguratorApp />
}

function ConfiguratorApp() {
  const [infoOpen, setInfoOpen] = useState(false)
  useConfigSync()
  usePrefersReducedMotion()
  const progress = useViewer((state) => state.progress)
  const ready = useViewer((state) => state.ready)
  const loadError = useViewer((state) => state.loadError)
  const reducedMotion = useViewer((state) => state.reducedMotion)
  const showLoader = !loadError && !ready

  return (
    <div className={`app ${ready ? 'is-ready' : ''} ${reducedMotion ? 'is-reduced' : ''}`}>
      <Suspense fallback={null}>
        <HarpScene />
      </Suspense>
      <Header />
      <UtilityControls onInfo={() => setInfoOpen(true)} />
      <ViewControls />
      {DEBUG && <CameraFramingPanel />}
      <ConfiguratorPanel />
      <HotspotCard />
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
      <LoadingScreen progress={Math.max(progress, ready ? 1 : 0)} visible={showLoader} />
      <ErrorScreen error={loadError} />
      {DEBUG && <DebugOverlay />}
    </div>
  )
}
