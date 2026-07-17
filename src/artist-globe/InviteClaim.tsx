import { useEffect, useState, type FormEvent } from 'react'
import { claimInvite, getInvite } from './api'
import type { Artist } from './types'
import { CATEGORY_LABELS } from './types'

interface InviteClaimProps {
  token: string
  onClaimed: () => void
}

export function InviteClaim({ token, onClaimed }: InviteClaimProps) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [email, setEmail] = useState('')
  const [used, setUsed] = useState(false)
  const [expired, setExpired] = useState(false)
  const [missing, setMissing] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const packed = await getInvite(token)
      if (cancelled) return
      if (!packed) {
        setMissing(true)
        return
      }
      setArtist(packed.artist)
      setEmail(packed.invite.email)
      setUsed(Boolean(packed.invite.usedAt))
      setExpired(new Date(packed.invite.expiresAt).getTime() < Date.now())
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await claimInvite(token, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClaimed()
  }

  if (missing) {
    return (
      <div className="ag-panel">
        <h2>Invite not found</h2>
        <p>This invite link is invalid or was cleared from local demo storage.</p>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="ag-panel">
        <p className="ag-muted">Loading invite…</p>
      </div>
    )
  }

  if (used) {
    return (
      <div className="ag-panel">
        <h2>Already claimed</h2>
        <p>
          {artist.displayName} is linked to an account. Sign in from <strong>My profile</strong>.
        </p>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="ag-panel">
        <h2>Invite expired</h2>
        <p>Ask an admin to approve again and generate a fresh invite.</p>
      </div>
    )
  }

  return (
    <form className="ag-panel ag-form" onSubmit={onSubmit}>
      <header className="ag-panel-head">
        <h2>Create your account</h2>
        <p>
          Claim <strong>{artist.displayName}</strong> ({CATEGORY_LABELS[artist.category]}) —{' '}
          {artist.city}
        </p>
      </header>
      <label>
        Email
        <input value={email} readOnly />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      {error ? <p className="ag-error">{error}</p> : null}
      <button type="submit" className="ag-btn ag-btn-primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}
