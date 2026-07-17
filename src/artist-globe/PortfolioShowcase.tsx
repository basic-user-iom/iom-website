import { useEffect, useState } from 'react'
import {
  fetchClientWeather,
  formatClientLocalTime,
  type ClientWeather,
  type WeatherConditionKey,
} from '../crm/clientWeather'
import type { Artist } from './types'
import { CATEGORY_LABELS } from './types'

const CONDITION_LABEL: Record<WeatherConditionKey, string> = {
  clear: 'Clear',
  mainlyClear: 'Mostly clear',
  partlyCloudy: 'Partly cloudy',
  overcast: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  showers: 'Showers',
  snowShowers: 'Snow showers',
  thunderstorm: 'Thunderstorm',
  unknown: '—',
}

interface PortfolioShowcaseProps {
  artist: Artist
  onClose: () => void
}

export function PortfolioShowcase({ artist, onClose }: PortfolioShowcaseProps) {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<ClientWeather | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(true)

  const tz = artist.timezone?.trim() || 'UTC'
  const works = artist.portfolio?.length
    ? artist.portfolio
    : [
        {
          id: `${artist.slug}-placeholder`,
          title: 'Works coming soon',
          year: '',
          medium: '',
          imageUrl: `https://picsum.photos/seed/${artist.slug}-empty/960/720`,
          caption: 'This artist has not uploaded a showcase yet.',
        },
      ]

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setWeatherLoading(true)
    void (async () => {
      try {
        const result = await fetchClientWeather({
          lat: artist.lat,
          lon: artist.lon,
          timezone: tz,
          placeLabel: [artist.city, artist.country].filter(Boolean).join(', '),
        })
        if (!cancelled) setWeather(result)
      } catch {
        if (!cancelled) setWeather(null)
      } finally {
        if (!cancelled) setWeatherLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [artist.lat, artist.lon, artist.city, artist.country, tz])

  const localTime = formatClientLocalTime(now, tz, 'en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const localDate = formatClientLocalTime(now, tz, 'en-GB', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="ag-portfolio" role="dialog" aria-modal="true" aria-label={`${artist.displayName} portfolio`}>
      <div className="ag-portfolio-top">
        <div className="ag-portfolio-identity">
          <button type="button" className="ag-btn" onClick={onClose}>
            ← Back
          </button>
          <div>
            <p className="ag-portfolio-cat">{CATEGORY_LABELS[artist.category]}</p>
            <h2 className="ag-portfolio-name">{artist.displayName}</h2>
            <p className="ag-portfolio-loc">
              {artist.city}
              {artist.country ? `, ${artist.country}` : ''}
            </p>
          </div>
        </div>

        <div className="ag-portfolio-locale" aria-live="polite">
          <div className="ag-portfolio-clock">
            <span className="ag-portfolio-clock-time">{localTime}</span>
            <span className="ag-portfolio-clock-date">{localDate} · local</span>
          </div>
          <div className="ag-portfolio-weather">
            {weatherLoading ? (
              <span className="ag-muted">Weather…</span>
            ) : weather ? (
              <>
                <span className="ag-portfolio-temp">
                  {Math.round(weather.temperatureC)}°
                </span>
                <span className="ag-portfolio-cond">
                  {CONDITION_LABEL[weather.conditionKey]}
                </span>
              </>
            ) : (
              <span className="ag-muted">Weather n/a</span>
            )}
          </div>
        </div>
      </div>

      {artist.bio ? <p className="ag-portfolio-bio">{artist.bio}</p> : null}

      <div className="ag-portfolio-grid">
        {works.map((work) => (
          <figure key={work.id} className="ag-portfolio-card">
            <div className="ag-portfolio-media">
              <img src={work.imageUrl} alt={work.title} loading="lazy" />
            </div>
            <figcaption>
              <strong>{work.title}</strong>
              <span>
                {[work.year, work.medium].filter(Boolean).join(' · ')}
              </span>
              {work.caption ? <em>{work.caption}</em> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
