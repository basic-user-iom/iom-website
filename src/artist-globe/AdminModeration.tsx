import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  approveSubmission,
  isAdminUnlocked,
  listManagedArtists,
  listSubmissions,
  lockAdmin,
  rejectSubmission,
  toggleArtistHidden,
  unlockAdmin,
} from './api'
import type { Artist, ArtistSubmission } from './types'
import { CATEGORY_LABELS } from './types'

export function AdminModeration() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [subs, setSubs] = useState<ArtistSubmission[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [busyId, setBusyId] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const refresh = useCallback(async () => {
    if (!isAdminUnlocked()) return
    const [s, a] = await Promise.all([listSubmissions(), listManagedArtists()])
    setSubs(s)
    setArtists(a)
  }, [])

  useEffect(() => {
    if (unlocked) void refresh()
  }, [unlocked, refresh])

  const onUnlock = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setUnlocking(true)
    const result = await unlockAdmin(email, password)
    setUnlocking(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setUnlocked(true)
  }

  const onLock = async () => {
    await lockAdmin()
    setUnlocked(false)
    setPassword('')
  }

  const onApprove = async (id: string) => {
    setBusyId(id)
    setInviteUrl('')
    setError('')
    const result = await approveSubmission(id)
    setBusyId('')
    if ('error' in result) {
      setError(result.error)
      return
    }
    setInviteUrl(result.inviteUrl)
    await refresh()
  }

  const onReject = async (id: string) => {
    const reason = window.prompt('Reject reason (optional)') ?? ''
    setBusyId(id)
    setError('')
    const result = await rejectSubmission(id, reason)
    setBusyId('')
    if ('error' in result) {
      setError(result.error)
      return
    }
    await refresh()
  }

  const onToggle = async (id: string) => {
    setBusyId(id)
    const result = await toggleArtistHidden(id)
    setBusyId('')
    if ('error' in result) {
      setError(result.error)
      return
    }
    await refresh()
  }

  if (!unlocked) {
    return (
      <form className="ag-panel ag-form ag-admin-lock" onSubmit={(e) => void onUnlock(e)}>
        <header className="ag-panel-head">
          <h2>Admin</h2>
          <p>Sign in with a staff IOM account to moderate submissions.</p>
        </header>
        <label>
          Staff email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            disabled={unlocking}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={unlocking}
          />
        </label>
        {error ? <p className="ag-error">{error}</p> : null}
        <p className="ag-muted">
          Same staff accounts as Client Login (e.g. visual@ / projects@ iobjectm.com).
        </p>
        <div className="ag-form-actions">
          <button type="submit" className="ag-btn ag-btn-primary" disabled={unlocking}>
            {unlocking ? 'Signing in…' : 'Unlock'}
          </button>
        </div>
      </form>
    )
  }

  const pending = subs.filter((s) => s.status === 'pending')

  return (
    <div className="ag-panel ag-admin">
      <header className="ag-panel-head ag-admin-head">
        <div>
          <h2>Moderation</h2>
          <p>Approve creates a live pin + invite URL you can send manually.</p>
        </div>
        <button type="button" className="ag-btn" onClick={() => void onLock()}>
          Lock
        </button>
      </header>

      {error ? <p className="ag-error">{error}</p> : null}
      {inviteUrl ? (
        <div className="ag-invite-box">
          <strong>Invite URL</strong>
          <code>{inviteUrl}</code>
          <button
            type="button"
            className="ag-btn ag-btn-primary"
            onClick={() => void navigator.clipboard.writeText(inviteUrl)}
          >
            Copy
          </button>
        </div>
      ) : null}

      <h3>Pending ({pending.length})</h3>
      {pending.length === 0 ? <p className="ag-muted">No pending submissions.</p> : null}
      <ul className="ag-admin-list">
        {pending.map((s) => (
          <li key={s.id}>
            <div>
              <strong>{s.displayName}</strong>
              <span className="ag-muted">
                {' '}
                · {CATEGORY_LABELS[s.category]} · {s.city}
                {s.country ? `, ${s.country}` : ''} · {s.email}
              </span>
              {s.bio ? <p>{s.bio}</p> : null}
            </div>
            <div className="ag-admin-actions">
              <button
                type="button"
                className="ag-btn ag-btn-primary"
                disabled={busyId === s.id}
                onClick={() => void onApprove(s.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="ag-btn"
                disabled={busyId === s.id}
                onClick={() => void onReject(s.id)}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3>Artists ({artists.length})</h3>
      <ul className="ag-admin-list">
        {artists.map((a) => (
          <li key={a.id}>
            <div>
              <strong>{a.displayName}</strong>
              <span className="ag-muted">
                {' '}
                · {a.status} · {CATEGORY_LABELS[a.category]} · {a.city}
              </span>
            </div>
            <button
              type="button"
              className="ag-btn"
              disabled={busyId === a.id || a.id.startsWith('seed-')}
              onClick={() => void onToggle(a.id)}
            >
              {a.status === 'live' ? 'Hide' : 'Show'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
