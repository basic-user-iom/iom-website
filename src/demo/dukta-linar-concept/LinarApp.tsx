import { Component, Suspense, lazy, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { isLinarDemoUnlocked, tryCrmEmbedUnlock, unlockLinarDemo } from './auth'
import { LinarLoading } from './LinarLoading'
import { useLinarMusic } from './useLinarMusic'
import './linar-entry.css'

// Keep every 3D dependency behind this boundary, including the scene constants.
const LinarConfigurator = lazy(() =>
  import('./DuktaLinarConceptPage').then(({ DuktaLinarConceptPage }) => ({
    default: DuktaLinarConceptPage,
  })),
)

class LinarLoadBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? <LinarLoading error /> : this.props.children
  }
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockLinarDemo(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="linar-page linar-page--gate">
      <div className="linar-gate">
        <div className="linar-gate__panel">
          <p className="linar-gate__brand">dukta · LINAR concept</p>
          <p className="linar-gate__hint">Private preview. Enter the password to continue.</p>
          <form className="linar-gate__form" onSubmit={submit}>
            <input
              className="linar-gate__input"
              type="password"
              aria-label="Password"
              aria-invalid={error}
              aria-describedby={error ? 'linar-password-error' : undefined}
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError(false)
              }}
              autoFocus
            />
            <button className="linar-gate__submit" type="submit">
              Enter
            </button>
            {error ? <p id="linar-password-error" className="linar-gate__error" role="alert">Incorrect password.</p> : null}
          </form>
        </div>
      </div>
    </div>
  )
}


export function LinarApp() {
  const [unlocked, setUnlocked] = useState(
    () => isLinarDemoUnlocked() || tryCrmEmbedUnlock(),
  )
  const music = useLinarMusic()

  useEffect(() => {
    document.body.classList.add('linar-route')
    document.documentElement.classList.add('linar-route')
    return () => {
      document.body.classList.remove('linar-route')
      document.documentElement.classList.remove('linar-route')
    }
  }, [])

  if (!unlocked) {
    return (
      <PasswordGate
        onUnlock={() => {
          // Preserve the trusted click for audio, before the asynchronous import.
          music.startMusic()
          setUnlocked(true)
        }}
      />
    )
  }

  return (
    <LinarLoadBoundary onFailure={music.stopMusic}>
      <Suspense fallback={<LinarLoading />}>
        <LinarConfigurator music={music} />
      </Suspense>
    </LinarLoadBoundary>
  )
}
