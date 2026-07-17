import { useState, type FormEvent } from 'react'
import { submitArtist } from './api'
import type { ArtistCategory } from './types'
import { CATEGORY_LABELS, PRIMARY_CATEGORIES, SUGGESTED_TAGS } from './types'

const CITY_PRESETS: {
  label: string
  city: string
  country: string
  lat: number
  lon: number
  timezone: string
}[] = [
  { label: 'Berlin', city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, timezone: 'Europe/Berlin' },
  { label: 'New York', city: 'New York', country: 'USA', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  { label: 'Tokyo', city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { label: 'London', city: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { label: 'Zagreb', city: 'Zagreb', country: 'Croatia', lat: 45.815, lon: 15.9819, timezone: 'Europe/Zagreb' },
  { label: 'São Paulo', city: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333, timezone: 'America/Sao_Paulo' },
  { label: 'Custom coords…', city: '', country: '', lat: 0, lon: 0, timezone: 'UTC' },
]

interface SubmitFormProps {
  onDone: () => void
  onCancel: () => void
}

export function SubmitForm({ onDone, onCancel }: SubmitFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<ArtistCategory>('photographer')
  const [tags, setTags] = useState<string[]>([])
  const [tagsRaw, setTagsRaw] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [instagram, setInstagram] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [presetIdx, setPresetIdx] = useState(0)
  const [city, setCity] = useState(CITY_PRESETS[0].city)
  const [country, setCountry] = useState(CITY_PRESETS[0].country)
  const [lat, setLat] = useState(String(CITY_PRESETS[0].lat))
  const [lon, setLon] = useState(String(CITY_PRESETS[0].lon))
  const [timezone, setTimezone] = useState(CITY_PRESETS[0].timezone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const applyPreset = (idx: number) => {
    setPresetIdx(idx)
    const p = CITY_PRESETS[idx]
    if (!p.city) return
    setCity(p.city)
    setCountry(p.country)
    setLat(String(p.lat))
    setLon(String(p.lon))
    setTimezone(p.timezone)
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const extra = tagsRaw.split(/[,#]/).map((t) => t.trim()).filter(Boolean)
    const result = await submitArtist({
      displayName,
      email,
      category,
      tags: [...tags, ...extra],
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
      timezone,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setOk(true)
  }

  if (ok) {
    return (
      <div className="ag-panel ag-form-done">
        <h2>Submitted</h2>
        <p>
          Thanks — your profile is pending review. If approved, you will receive an invite link to
          create your account and manage the listing.
        </p>
        <button type="button" className="ag-btn ag-btn-primary" onClick={onDone}>
          Back to globe
        </button>
      </div>
    )
  }

  return (
    <form className="ag-panel ag-form" onSubmit={onSubmit}>
      <header className="ag-panel-head">
        <h2>Join the globe</h2>
        <p>Anyone can submit. We approve or reject each profile before it goes live.</p>
      </header>

      <label>
        Name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={120} />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
        />
      </label>
      <label>
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ArtistCategory)}
        >
          {PRIMARY_CATEGORIES.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      <div className="ag-tag-picker">
        <span className="ag-filter-label">Suggested tags</span>
        <div className="ag-chips ag-chips-tags">
          {SUGGESTED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={tags.includes(tag) ? 'is-active' : ''}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <label>
        Extra tags (comma-separated)
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="custom, local-term"
        />
      </label>
      <label>
        Short bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={2000} />
      </label>
      <label>
        Website
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
      </label>
      <label>
        Instagram
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://" />
      </label>
      <label>
        Portfolio URL
        <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://" />
      </label>

      <label>
        Location preset
        <select value={presetIdx} onChange={(e) => applyPreset(Number(e.target.value))}>
          {CITY_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
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
      <label>
        Timezone (IANA)
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="Europe/Berlin"
          required
        />
      </label>

      {error ? <p className="ag-error">{error}</p> : null}

      <div className="ag-form-actions">
        <button type="button" className="ag-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ag-btn ag-btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Submit for review'}
        </button>
      </div>
    </form>
  )
}
