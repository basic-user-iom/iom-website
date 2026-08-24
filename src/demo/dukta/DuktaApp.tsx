import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  isDuktaWebsiteUnlocked,
  tryCrmEmbedUnlock,
  unlockDuktaWebsite,
} from './auth'
import { Footer } from './Footer'
import { Header } from './Header'
import { HomePage } from './HomePage'
import { IncisionLoader } from './IncisionLoader'
import { FontProvider } from './fonts/FontContext'
import { LocaleProvider, useLocale } from './i18n/LocaleContext'
import { ProjectsPage } from './ProjectsPage'
import { useDuktaRoute } from './router'

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockDuktaWebsite(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="dk-gate">
      <div className="dk-gate__panel">
        <p className="dk-gate__brand">dukta</p>
        <p className="dk-gate__hint">Private preview. Enter the password to continue.</p>
        <form className="dk-gate__form" onSubmit={submit}>
          <input
            className="dk-gate__input"
            type="password"
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
          <button className="dk-gate__submit" type="submit">
            Enter
          </button>
          {error ? <p className="dk-gate__error">Incorrect password.</p> : null}
        </form>
      </div>
    </div>
  )
}

function DuktaShell() {
  const route = useDuktaRoute()
  const { t } = useLocale()
  const [entered, setEntered] = useState(false)
  const onDone = useCallback(() => setEntered(true), [])

  useEffect(() => {
    document.title = route.name === 'projects' ? t.meta.projectsTitle : t.meta.homeTitle
  }, [route.name, t.meta.homeTitle, t.meta.projectsTitle])

  return (
    <div className={`dk-app${entered ? ' is-ready' : ''}`}>
      <a className="dk-skip" href="#main">
        {t.actions.skipToContent}
      </a>
      <IncisionLoader onDone={onDone} />
      <Header transparent={route.name === 'home'} />
      {route.name === 'projects' ? <ProjectsPage /> : <HomePage />}
      <Footer />
    </div>
  )
}

export function DuktaApp() {
  const [unlocked, setUnlocked] = useState(
    () =>
      typeof window === 'undefined'
        ? false
        : isDuktaWebsiteUnlocked() || tryCrmEmbedUnlock(),
  )

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <LocaleProvider>
      <FontProvider>
        <DuktaShell />
      </FontProvider>
    </LocaleProvider>
  )
}
