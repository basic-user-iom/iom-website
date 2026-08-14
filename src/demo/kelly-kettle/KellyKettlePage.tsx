import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { isKellyKettleUnlocked, tryCrmEmbedUnlock, unlockKellyKettle } from './auth'
import { HowItWorksSchematic } from './HowItWorksSchematic'
import { IntroPicture } from './IntroPicture'
import { IntroVideo } from './IntroVideo'
import { IntroYouTube } from './IntroYouTube'
import { hasWebGL, measureTransferredBytes, preferMobileQuality, prefersReducedMotion } from './webgl'
import type { QualityLevel } from './types'
import './kelly-kettle.css'

type ExperienceProps = {
  reducedMotion: boolean
  quality: QualityLevel
  onFirstFrame?: () => void
}

type Phase = 'intro' | 'loading' | 'ready'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function loadStatusText(phase: Phase, progress: number, transferred: number) {
  if (phase === 'intro') return '3D not loaded'
  if (phase === 'loading') return `Loading interactive model… ${progress}%`
  if (transferred > 0) return `Interactive model ready · ${formatBytes(transferred)}`
  return 'Interactive model ready'
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (unlockKellyKettle(password)) {
      setError(false)
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <div className="kk-page kk-page--gate">
      <div className="kk-gate">
        <div className="kk-gate__panel">
          <p className="kk-gate__brand">Kelly Kettle · Base Camp 1.6 L</p>
          <p className="kk-gate__hint">Private client preview. Enter the password to continue.</p>
          <form className="kk-gate__form" onSubmit={submit}>
            <input
              className="kk-gate__input"
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
            <button className="kk-gate__submit" type="submit">
              Enter
            </button>
            {error ? <p className="kk-gate__error">Incorrect password.</p> : null}
          </form>
        </div>
      </div>
    </div>
  )
}

export function KellyKettlePage() {
  const [unlocked, setUnlocked] = useState(
    () => (typeof window === 'undefined' ? false : isKellyKettleUnlocked() || tryCrmEmbedUnlock()),
  )
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <KellyKettleUnlockedPage />
}

function KellyKettleUnlockedPage() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState(0)
  const [transferred, setTransferred] = useState(0)
  const [Experience, setExperience] = useState<ComponentType<ExperienceProps> | null>(null)
  const [webgl, setWebgl] = useState(true)
  const reducedMotion = useState(() =>
    typeof window === 'undefined' ? false : prefersReducedMotion(),
  )[0]
  const quality: QualityLevel =
    typeof window === 'undefined' ? 'high' : preferMobileQuality() ? 'mobile' : 'high'
  const howRef = useRef<HTMLElement>(null)
  const progressTimer = useRef<number>(0)

  useEffect(() => {
    document.body.classList.add('kk-route')
    document.documentElement.classList.add('kk-route')
    setWebgl(hasWebGL())
    return () => {
      document.body.classList.remove('kk-route', 'is-demo')
      document.documentElement.classList.remove('kk-route', 'is-demo')
    }
  }, [])

  useEffect(() => {
    const demo = phase === 'ready'
    document.body.classList.toggle('is-demo', demo)
    document.documentElement.classList.toggle('is-demo', demo)
  }, [phase])

  const onFirstFrame = useCallback(() => {
    window.clearInterval(progressTimer.current)
    setProgress(100)
    setTransferred(measureTransferredBytes())
    setPhase('ready')
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }, [])

  const open = useCallback(async () => {
    if (!webgl || phase !== 'intro') return
    setPhase('loading')
    setProgress(8)
    howRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })

    const before = performance.getEntriesByType('resource').length
    progressTimer.current = window.setInterval(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      let bytes = 0
      for (const entry of entries.slice(before)) {
        if (/kelly-kettle|three|KellyKettle/i.test(entry.name)) bytes += entry.transferSize || 0
      }
      const fromBytes = bytes > 0 ? Math.min(70, 18 + bytes / 8000) : 8
      setProgress((prev) => Math.max(prev, Math.round(fromBytes)))
    }, 160)

    try {
      const mod = await import('./KellyKettleExperience')
      setProgress((prev) => Math.max(prev, 78))
      setExperience(() => mod.KellyKettleExperience)
    } catch {
      window.clearInterval(progressTimer.current)
      setPhase('intro')
      setProgress(0)
    }
  }, [phase, reducedMotion, webgl])

  const demo = phase === 'ready'
  const loading = phase === 'loading'

  return (
    <div className={demo ? 'kk-page kk-page--demo' : 'kk-page kk-page--intro'}>
      <header className="kk-header">
        <p className="kk-brand">Kelly Kettle · Base Camp 1.6 L</p>
        <span className="kk-badge">Concept demonstration — simplified draft model</span>
      </header>

      <div className="kk-intro">
        <div className="kk-intro-grid">
          <div className="kk-intro-copy">
            <div className="kk-intro-copy__text">
              <p className="kk-eyebrow">Kelly Kettle · Base Camp 1.6 L</p>
              <h1 className="kk-title">Why the fire runs through the water</h1>
              <p className="kk-lead">
                See how a small fire, natural airflow and a water-filled chimney wall work together.
                The full 3D experience loads only when you choose to open it.
              </p>
              <ul className="kk-chips">
                <li>1.6 L capacity</li>
                <li>Approx. 33 cm high</li>
                <li>Food-grade stainless steel</li>
              </ul>
            </div>
            <div className="kk-intro-cta">
              {webgl ? (
                <button
                  type="button"
                  className="kk-primary kk-primary--cta"
                  onClick={() => void open()}
                  disabled={loading}
                >
                  <span className="kk-primary__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.2 6.6v10.8L18.2 12 9.2 6.6Z" />
                    </svg>
                  </span>
                  <span className="kk-primary__copy">
                    <span className="kk-primary__title">Open interactive demonstration</span>
                    <span className="kk-primary__hint">Click to explore the kettle in 3D</span>
                  </span>
                </button>
              ) : (
                <p className="kk-fallback kk-fallback--inline">
                  WebGL is not available on this device. The diagram below still shows how the kettle
                  works.
                </p>
              )}
              {phase === 'intro' ? (
                <p className="kk-sr-only" role="status">
                  3D not loaded
                </p>
              ) : (
                <p className="kk-load-status" role="status">
                  {loadStatusText(phase, progress, transferred)}
                </p>
              )}
            </div>
          </div>

          <figure className="kk-hero-photo">
            <IntroPicture
              name="kettle-hero"
              alt="Outdoor Kelly Kettle Base Camp being lifted from its fire base, with the green whistle on the spout and glowing embers visible through the single circular air opening"
              width={700}
              height={700}
              sizes="(min-width: 1100px) 520px, (min-width: 720px) 42vw, 100vw"
              priority
              className="kk-media-img"
            />
          </figure>

          <div className="kk-intro-media">
            <IntroVideo />
            <figure className="kk-support-card">
              <IntroPicture
                name="kettle-fire-base"
                alt="Kelly Kettle steel fire base burning on a tree stump, with flames rising and embers visible through the circular air opening"
                width={400}
                height={250}
                sizes="(min-width: 1100px) 240px, (min-width: 720px) 28vw, 46vw"
                className="kk-media-img"
              />
              <figcaption>Fire base · single air opening</figcaption>
            </figure>
            <figure className="kk-support-card kk-support-card--whistle">
              <IntroPicture
                name="kettle-whistle"
                alt="Hand lifting the green Kelly Kettle whistle from the spout by its split ring, with the tether chain attached"
                width={400}
                height={640}
                sizes="(min-width: 1100px) 240px, (min-width: 720px) 28vw, 46vw"
                className="kk-media-img"
              />
              <figcaption>Green whistle on the spout</figcaption>
            </figure>
            <figure className="kk-support-card kk-support-card--handle">
              <IntroPicture
                name="kettle-handle"
                alt="Kelly Kettle boiling in a forest, with a wooden handle grip and a stick feeding the chimney fire"
                width={640}
                height={640}
                sizes="(min-width: 1100px) 240px, (min-width: 720px) 28vw, 46vw"
                className="kk-media-img"
              />
              <figcaption>Wire handle and wooden grip</figcaption>
            </figure>
          </div>
        </div>

        <section className="kk-field-video" aria-labelledby="kk-field-video-title">
          <div className="kk-field-video__head">
            <h2 id="kk-field-video-title">Kelly Kettle in use</h2>
            <p>Three official films from the Kelly Kettle website.</p>
          </div>
          <IntroYouTube />
        </section>

          <section className="kk-how" ref={howRef} id="how-it-works">
            <div className="kk-how__head">
              <h2>How the Kelly Kettle works</h2>
              <p>
                A small fire in the separate steel base draws cool air through a single opening. The
                chimney effect carries heat upward while water in the surrounding double wall absorbs
                that heat.
              </p>
            </div>
            <div className={loading ? 'kk-crossfade is-loading' : 'kk-crossfade'}>
              <div className="kk-crossfade__schematic">
                <HowItWorksSchematic />
              </div>
              <div className="kk-stage kk-crossfade__viewer">
                {Experience ? (
                  <Experience
                    reducedMotion={reducedMotion}
                    quality={quality}
                    onFirstFrame={onFirstFrame}
                  />
                ) : null}
              </div>
              {loading ? (
                <p className="kk-crossfade__progress" role="status">
                  Loading interactive model… {progress}%
                </p>
              ) : null}
            </div>
            <div className="kk-how-notes">
              <details className="kk-dims">
                <summary>View draft reference dimensions</summary>
                <dl className="kk-specs">
                  <div>
                    <dt>Height</dt>
                    <dd>approximately 0.33 m</dd>
                  </div>
                  <div>
                    <dt>Kettle width</dt>
                    <dd>approximately 0.155 m</dd>
                  </div>
                  <div>
                    <dt>Fire-base width</dt>
                    <dd>approximately 0.185 m</dd>
                  </div>
                  <div>
                    <dt>Capacity</dt>
                    <dd>1.6 litres</dd>
                  </div>
                  <div>
                    <dt>Material</dt>
                    <dd>food-grade stainless steel</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>approximately 1.16 kg</dd>
                  </div>
                </dl>
              </details>
              <p className="kk-disclaimer">
                Concept demonstration reconstructed from public product photographs. This is not an
                official or dimensionally exact Kelly Kettle model.
              </p>
            </div>
          </section>
        </div>
    </div>
  )
}
