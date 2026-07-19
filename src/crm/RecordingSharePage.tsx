import { useEffect, useState } from 'react'
import './recordingShare.css'

interface ShareMeta {
  id: string
  title: string
  mimeType: string
  durationMs: number | null
  hasPassword: boolean
  createdAt: string
}

interface UnlockResult {
  title: string
  mimeType: string
  playbackUrl: string
}

export function isRecordingSharePath(path: string): boolean {
  return /^\/r\/[^/]+$/.test(path.replace(/\/+$/, '') || '/')
}

export function recordingSlugFromPath(path: string): string | null {
  const m = /^\/r\/([^/]+)$/.exec(path.replace(/\/+$/, '') || '/')
  return m ? decodeURIComponent(m[1]) : null
}

export function RecordingSharePage({ slug }: { slug: string }) {
  const embed =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1'

  const [meta, setMeta] = useState<ShareMeta | null>(null)
  const [playback, setPlayback] = useState<UnlockResult | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function unlock(pw: string) {
      setUnlocking(true)
      setError('')
      try {
        const res = await fetch('/api/crm-recording-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, password: pw }),
        })
        if (cancelled) return
        if (res.status === 401) {
          setError('password')
          return
        }
        if (res.status === 404) {
          setError('notfound')
          return
        }
        if (!res.ok) throw new Error('Unlock failed')
        const data = (await res.json()) as UnlockResult
        setPlayback(data)
      } catch {
        if (!cancelled) setError('load')
      } finally {
        if (!cancelled) setUnlocking(false)
      }
    }

    ;(async () => {
      setLoading(true)
      setError('')
      setPlayback(null)
      try {
        const res = await fetch(
          `/api/crm-recording-share?slug=${encodeURIComponent(slug)}`,
        )
        if (cancelled) return
        if (res.status === 404) {
          setError('notfound')
          return
        }
        if (!res.ok) throw new Error('Lookup failed')
        const data = (await res.json()) as ShareMeta
        setMeta(data)
        if (!data.hasPassword) {
          await unlock('')
        }
      } catch {
        if (!cancelled) setError('load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  async function unlockFromForm(pw: string) {
    setUnlocking(true)
    setError('')
    try {
      const res = await fetch('/api/crm-recording-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password: pw }),
      })
      if (res.status === 401) {
        setError('password')
        return
      }
      if (res.status === 404) {
        setError('notfound')
        return
      }
      if (!res.ok) throw new Error('Unlock failed')
      const data = (await res.json()) as UnlockResult
      setPlayback(data)
    } catch {
      setError('load')
    } finally {
      setUnlocking(false)
    }
  }

  const showBoot =
    loading || (unlocking && meta !== null && !meta.hasPassword && !playback)

  if (showBoot) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        <p className="rec-share-msg">Loading…</p>
      </div>
    )
  }

  if (error === 'notfound' || (error === 'load' && !meta)) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        <p className="rec-share-msg">Recording not found</p>
      </div>
    )
  }

  if (!playback) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        {!embed && <p className="rec-share-kicker">IOM · Shared recording</p>}
        <h1 className="rec-share-title">{meta?.title ?? 'Recording'}</h1>
        <p className="rec-share-msg">This recording is password protected.</p>
        <form
          className="rec-share-form"
          onSubmit={(e) => {
            e.preventDefault()
            void unlockFromForm(password)
          }}
        >
          <label>
            <span className="visually-hidden">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={unlocking}>
            {unlocking ? '…' : 'Unlock'}
          </button>
        </form>
        {error === 'password' && (
          <p className="rec-share-error" role="alert">
            Wrong password
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
      {!embed && (
        <>
          <p className="rec-share-kicker">IOM · Shared recording</p>
          <h1 className="rec-share-title">{playback.title}</h1>
        </>
      )}
      <div className="rec-share-player">
        <video src={playback.playbackUrl} controls playsInline autoPlay={embed} />
      </div>
    </div>
  )
}
