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

function videoMime(mime: string): string {
  if (!mime) return 'video/webm'
  // Some browsers refuse <video type="video/webm;codecs=…">
  if (mime.startsWith('video/')) return mime.split(';')[0].trim()
  return mime
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
  const [mediaError, setMediaError] = useState(false)

  useEffect(() => {
    let alive = true

    async function unlock(pw: string): Promise<boolean> {
      if (!alive) return false
      setUnlocking(true)
      setError('')
      setMediaError(false)
      try {
        const res = await fetch('/api/crm-recorder?action=share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, password: pw }),
        })
        if (!alive) return false
        if (res.status === 401) {
          setError('password')
          return false
        }
        if (res.status === 404) {
          setError('notfound')
          return false
        }
        if (!res.ok) throw new Error('Unlock failed')
        const data = (await res.json()) as UnlockResult
        setPlayback(data)
        return true
      } catch {
        if (alive) setError('load')
        return false
      } finally {
        if (alive) setUnlocking(false)
      }
    }

    ;(async () => {
      setLoading(true)
      setError('')
      setPlayback(null)
      setMediaError(false)
      try {
        const res = await fetch(
          `/api/crm-recorder?action=share&slug=${encodeURIComponent(slug)}`,
        )
        if (!alive) return
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
        if (alive) setError('load')
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [slug])

  async function unlockFromForm(pw: string) {
    setUnlocking(true)
    setError('')
    setMediaError(false)
    try {
      const res = await fetch('/api/crm-recorder?action=share', {
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

  if (loading) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        <p className="rec-share-msg">Loading…</p>
      </div>
    )
  }

  if (error === 'notfound' || (error === 'load' && !meta)) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        <p className="rec-share-msg">Not found</p>
      </div>
    )
  }

  if (error === 'load' && meta && !playback) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        <p className="rec-share-kicker">IOM · Shared media</p>
        <h1 className="rec-share-title">{meta.title}</h1>
        <p className="rec-share-msg">Could not load this file. Try again.</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={unlocking}
          onClick={() => void unlockFromForm('')}
        >
          {unlocking ? '…' : 'Retry'}
        </button>
      </div>
    )
  }

  const isImage = Boolean(
    (playback?.mimeType || meta?.mimeType || '').startsWith('image/'),
  )
  const kindLabel = isImage ? 'Shared screenshot' : 'Shared recording'

  if (!playback) {
    return (
      <div className={`rec-share${embed ? ' rec-share--embed' : ''}`}>
        {!embed && <p className="rec-share-kicker">IOM · {kindLabel}</p>}
        <h1 className="rec-share-title">{meta?.title ?? 'Media'}</h1>
        <p className="rec-share-msg">This file is password protected.</p>
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
          <p className="rec-share-kicker">IOM · {kindLabel}</p>
          <h1 className="rec-share-title">{playback.title}</h1>
        </>
      )}
      <div className="rec-share-player">
        {playback.mimeType.startsWith('image/') ? (
          <img
            src={playback.playbackUrl}
            alt={playback.title}
            onError={() => setMediaError(true)}
          />
        ) : (
          <video
            key={playback.playbackUrl}
            src={playback.playbackUrl}
            controls
            playsInline
            preload="metadata"
            autoPlay={embed}
            onError={() => setMediaError(true)}
          >
            <source
              src={playback.playbackUrl}
              type={videoMime(playback.mimeType)}
            />
          </video>
        )}
      </div>
      {mediaError && (
        <p className="rec-share-error" role="alert">
          This recording file looks empty or unreadable. Try recording again and
          keep the screen-share bar active until you press Stop.
        </p>
      )}
    </div>
  )
}
