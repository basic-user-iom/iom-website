import { useEffect, useState, type FormEvent } from 'react'
import {
  getCurrentArtist,
  signInArtist,
  signOutArtist,
  updateMyArtist,
} from './api'
import type { Artist, ArtistCategory } from './types'
import { CATEGORY_LABELS, PRIMARY_CATEGORIES } from './types'

interface ArtistDashboardProps {
  onBack: () => void
}

export function ArtistDashboard({ onBack }: ArtistDashboardProps) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState<ArtistCategory>('photographer')
  const [tagsRaw, setTagsRaw] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [instagram, setInstagram] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const hydrate = (a: Artist) => {
    setArtist(a)
    setDisplayName(a.displayName)
    setCategory(a.category)
    setTagsRaw(a.tags.join(', '))
    setBio(a.bio)
    setWebsite(a.links.website || '')
    setInstagram(a.links.instagram || '')
    setPortfolio(a.links.portfolio || '')
    setCity(a.city)
    setCountry(a.country)
    setLat(String(a.lat))
    setLon(String(a.lon))
    setAvatarUrl(a.avatarUrl)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const a = await getCurrentArtist()
      if (cancelled) return
      if (a) hydrate(a)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await signInArtist(email, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    hydrate(result.artist)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    const result = await updateMyArtist({
      displayName,
      category,
      tags: tagsRaw.split(/[,#]/).map((t) => t.trim()).filter(Boolean),
      bio,
      links: {
        website: website.trim() || undefined,
        instagram: instagram.trim() || undefined,
        portfolio: portfolio.trim() || undefined,
      },
      city,
      country,
      lat: Number(lat),
      lon: Number(lon),
      avatarUrl,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    hydrate(result.artist)
    setSaved(true)
  }

  if (loading) {
    return (
      <div className="ag-panel">
        <p className="ag-muted">Loading…</p>
      </div>
    )
  }

  if (!artist) {
    return (
      <form className="ag-panel ag-form" onSubmit={onSignIn}>
        <header className="ag-panel-head">
          <h2>Artist sign-in</h2>
          <p>Use the account you created from your invite link.</p>
        </header>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="ag-error">{error}</p> : null}
        <div className="ag-form-actions">
          <button type="button" className="ag-btn" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="ag-btn ag-btn-primary" disabled={busy}>
            Sign in
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="ag-panel ag-form" onSubmit={onSave}>
      <header className="ag-panel-head ag-admin-head">
        <div>
          <h2>My profile</h2>
          <p>Edit how you appear on the globe.</p>
        </div>
        <button
          type="button"
          className="ag-btn"
          onClick={() => {
            void signOutArtist().then(() => setArtist(null))
          }}
        >
          Sign out
        </button>
      </header>

      <label>
        Name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as ArtistCategory)}>
          {PRIMARY_CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags
        <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
      </label>
      <label>
        Website
        <input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      <label>
        Instagram
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
      </label>
      <label>
        Portfolio
        <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
      </label>
      <label>
        Avatar URL
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </label>
      <div className="ag-form-row">
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label>
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
      </div>
      <div className="ag-form-row">
        <label>
          Latitude
          <input value={lat} onChange={(e) => setLat(e.target.value)} required />
        </label>
        <label>
          Longitude
          <input value={lon} onChange={(e) => setLon(e.target.value)} required />
        </label>
      </div>

      {error ? <p className="ag-error">{error}</p> : null}
      {saved ? <p className="ag-ok">Saved.</p> : null}

      <div className="ag-form-actions">
        <button type="button" className="ag-btn" onClick={onBack}>
          Back to globe
        </button>
        <button type="submit" className="ag-btn ag-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
