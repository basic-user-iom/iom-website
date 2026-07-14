import { useEffect, useState } from 'react'
import {
  fetchClientWeather,
  formatClientLocalTime,
  formatSunClock,
  geocodeClientLocation,
  type ClientWeather,
} from './clientWeather'
import { useCrmI18n } from './i18n'
import type { Lead } from './types'
import { isValidIanaTimezone } from './timezones'
import { WeatherIcon } from './WeatherIcons'

interface LeadClientLocalProps {
  lead: Lead
  /** Compact single-line clock (list / collapsed detail). */
  compact?: boolean
  /** Live DB is missing client locale columns — show migration hint. */
  schemaMissing?: boolean
}

export function LeadClientLocal({
  lead,
  compact = false,
  schemaMissing = false,
}: LeadClientLocalProps) {
  const { t, locale } = useCrmI18n()
  const tz = lead.client_timezone?.trim() || ''
  const city = lead.client_city?.trim() || ''
  const country = lead.client_country?.trim() || ''
  const hasTz = isValidIanaTimezone(tz)
  const hasPlace = !!(city || country || (lead.client_lat != null && lead.client_lon != null))

  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<ClientWeather | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Compact list clocks: minute resolution so list rows don't re-render every second.
  // Detail panel keeps a live second tick.
  useEffect(() => {
    if (!hasTz) return
    const tickMs = compact ? 60_000 : 1_000
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), tickMs)
    return () => window.clearInterval(id)
  }, [hasTz, compact])

  useEffect(() => {
    if (compact || !hasPlace) {
      setWeather(null)
      setWeatherError(false)
      setWeatherLoading(false)
      return
    }

    let cancelled = false
    setWeatherLoading(true)
    setWeatherError(false)

    void (async () => {
      try {
        let lat = lead.client_lat
        let lon = lead.client_lon
        let placeLabel = [city, country].filter(Boolean).join(', ')
        let weatherTz = tz || 'auto'

        if (lat == null || lon == null) {
          const geo = await geocodeClientLocation(city, country)
          if (!geo) {
            if (!cancelled) {
              setWeather(null)
              setWeatherError(true)
              setWeatherLoading(false)
            }
            return
          }
          lat = geo.lat
          lon = geo.lon
          placeLabel = [geo.name, geo.country].filter(Boolean).join(', ')
          if (!weatherTz || weatherTz === 'auto') weatherTz = geo.timezone || 'auto'
        } else if (!placeLabel) {
          placeLabel = `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        }

        const result = await fetchClientWeather({
          lat,
          lon,
          timezone: weatherTz,
          placeLabel,
        })
        if (cancelled) return
        setWeather(result)
        setWeatherError(!result)
      } catch {
        if (!cancelled) {
          setWeather(null)
          setWeatherError(true)
        }
      } finally {
        if (!cancelled) setWeatherLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    compact,
    hasPlace,
    city,
    country,
    tz,
    lead.client_lat,
    lead.client_lon,
    lead.id,
    lead.updated_at,
  ])

  if (!hasTz && !hasPlace) {
    if (compact) return null
    return (
      <section className="crm-client-local crm-client-local--empty">
        <h3 className="crm-panel-title">{t('locale.title')}</h3>
        <p className="crm-muted">{t('locale.empty')}</p>
        {schemaMissing && (
          <p className="crm-feedback crm-feedback--error" role="status">
            {t('locale.schemaMissing')}
          </p>
        )}
      </section>
    )
  }

  const timeStr = hasTz
    ? formatClientLocalTime(now, tz, locale, {
        hour: '2-digit',
        minute: '2-digit',
        ...(compact ? {} : { second: '2-digit' as const }),
        hour12: false,
      })
    : null
  const dateStr = hasTz
    ? formatClientLocalTime(now, tz, locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null

  if (compact) {
    if (!timeStr) return null
    return (
      <span className="crm-client-clock-snip" title={`${t('locale.localTime')} · ${tz}`}>
        <span className="crm-client-clock-snip-label">{t('locale.clockShort')}</span>
        <span className="crm-client-clock-snip-time">{timeStr}</span>
      </span>
    )
  }

  const conditionText = weather
    ? t(`locale.wx.${weather.conditionKey}`)
    : weatherLoading
      ? t('locale.weatherLoading')
      : weatherError
        ? t('locale.weatherError')
        : t('locale.weatherNeedPlace')

  return (
    <section className="crm-client-local" aria-live="polite">
      <h3 className="crm-panel-title">{t('locale.title')}</h3>
      <p className="crm-muted crm-client-local-blurb">{t('locale.blurb')}</p>
      {schemaMissing && (
        <p className="crm-feedback crm-feedback--error" role="status">
          {t('locale.schemaMissing')}
        </p>
      )}

      <div className="crm-client-local-grid">
        <div className="crm-client-local-card">
          <p className="crm-client-local-label">{t('locale.localTime')}</p>
          {timeStr ? (
            <>
              <p className="crm-client-local-time">{timeStr}</p>
              <p className="crm-client-local-date">{dateStr}</p>
              <p className="crm-client-local-tz">{tz}</p>
            </>
          ) : (
            <p className="crm-muted">{t('locale.noTimezone')}</p>
          )}
          {(city || country) && (
            <p className="crm-client-local-place">
              {[city, country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        <div className="crm-client-local-card">
          <p className="crm-client-local-label">{t('locale.weather')}</p>
          {weather ? (
            <>
              <div className="crm-client-local-temp-row">
                <WeatherIcon
                  kind={weather.conditionKey}
                  isDay={weather.isDay}
                  className="crm-wx-icon"
                  title={conditionText}
                />
                <p className="crm-client-local-temp">
                  {Math.round(weather.temperatureC)}°C
                  <span className="crm-client-local-cond"> · {conditionText}</span>
                </p>
              </div>
              <p className="crm-client-local-place">{weather.placeLabel}</p>
              <div className="crm-client-local-sun">
                <span className="crm-client-local-sun-item">
                  <WeatherIcon kind="sunrise" className="crm-wx-icon crm-wx-icon--sunline" title={t('locale.sunrise')} />
                  <span className="crm-client-local-sun-label">{t('locale.sunrise')}</span>{' '}
                  {formatSunClock(weather.sunriseIso, weather.timezone || tz, locale)}
                </span>
                <span className="crm-client-local-sun-item">
                  <WeatherIcon kind="sunset" className="crm-wx-icon crm-wx-icon--sunline" title={t('locale.sunset')} />
                  <span className="crm-client-local-sun-label">{t('locale.sunset')}</span>{' '}
                  {formatSunClock(weather.sunsetIso, weather.timezone || tz, locale)}
                </span>
              </div>
              <div className="crm-client-local-moon">
                <WeatherIcon
                  kind={weather.moonPhaseKey}
                  className="crm-wx-icon crm-wx-icon--moonline"
                  title={t(`locale.moon.${weather.moonPhaseKey}`)}
                />
                <span className="crm-client-local-moon-label">{t('locale.moonPhase')}</span>
                <span className="crm-client-local-moon-name">
                  {t(`locale.moon.${weather.moonPhaseKey}`)}
                </span>
              </div>
            </>
          ) : (
            <p className="crm-muted">{conditionText}</p>
          )}
        </div>
      </div>
    </section>
  )
}
