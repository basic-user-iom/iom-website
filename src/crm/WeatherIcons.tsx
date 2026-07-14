import type { ReactNode } from 'react'
import type { MoonPhaseKey, WeatherConditionKey } from './clientWeather'

type IconProps = {
  className?: string
  title?: string
}

function SvgShell({
  className,
  title,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

function Sun({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <circle className="crm-wx-fill-sun" cx="16" cy="16" r="5.2" />
      <g className="crm-wx-stroke-sun" strokeWidth="1.6" strokeLinecap="round">
        <path d="M16 3.2v3.2M16 25.6v3.2M3.2 16h3.2M25.6 16h3.2M6.6 6.6l2.3 2.3M23.1 23.1l2.3 2.3M6.6 25.4l2.3-2.3M23.1 8.9l2.3-2.3" />
      </g>
    </SvgShell>
  )
}

function Moon({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-moon"
        d="M21.2 4.8a10.8 10.8 0 1 0 6 17.2A9 9 0 1 1 21.2 4.8Z"
      />
    </SvgShell>
  )
}

function PartlyCloudy({ className, title, isDay }: IconProps & { isDay: boolean }) {
  return (
    <SvgShell className={className} title={title}>
      {isDay ? (
        <>
          <circle className="crm-wx-fill-sun" cx="11.2" cy="11" r="3.6" />
          <g className="crm-wx-stroke-sun" strokeWidth="1.35" strokeLinecap="round">
            <path d="M11.2 3.6v1.9M11.2 16.5v1.9M3.6 11h1.9M16.9 11h1.9M5.8 5.6l1.4 1.4M15.2 15l1.4 1.4M5.8 16.4l1.4-1.4M15.2 7l1.4-1.4" />
          </g>
        </>
      ) : (
        <path
          className="crm-wx-fill-moon"
          d="M15.6 4.2a7.2 7.2 0 1 0 4.2 11.4A6 6 0 1 1 15.6 4.2Z"
        />
      )}
      <path
        className="crm-wx-fill-cloud"
        d="M11.2 25.2h11.6a4.8 4.8 0 0 0 .4-9.5 6.4 6.4 0 0 0-12.2 1.8 4.2 4.2 0 0 0 .2 7.7Z"
      />
    </SvgShell>
  )
}

function Overcast({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud-dim"
        d="M7.4 15.8h11.2a4.4 4.4 0 0 0 .35-8.7A5.9 5.9 0 0 0 7.6 8.8a3.9 3.9 0 0 0-.2 7Z"
      />
      <path
        className="crm-wx-fill-cloud"
        d="M11.4 26h13a5.2 5.2 0 0 0 .45-10.35 6.9 6.9 0 0 0-13.2 1.95A4.6 4.6 0 0 0 11.4 26Z"
      />
    </SvgShell>
  )
}

function Fog({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud-dim"
        d="M9.8 14.2h12.2a4.6 4.6 0 0 0 .4-9.1A6.2 6.2 0 0 0 9.9 7.1a4 4 0 0 0-.1 7.1Z"
      />
      <g className="crm-wx-stroke-fog" strokeWidth="1.55" strokeLinecap="round">
        <path d="M6 18.2h20M7.5 21.4h17M8.8 24.6h14.4" />
      </g>
    </SvgShell>
  )
}

function Raindrops({ y = 22.5 }: { y?: number }) {
  return (
    <g className="crm-wx-stroke-rain" strokeWidth="1.5" strokeLinecap="round">
      <path d={`M11 ${y}v3.2M16 ${y + 1.1}v3.2M21 ${y}v3.2`} />
    </g>
  )
}

function Snowflakes({ y = 22.2 }: { y?: number }) {
  return (
    <g className="crm-wx-fill-snow">
      <circle cx="11" cy={y} r="1.15" />
      <circle cx="16" cy={y + 1.2} r="1.15" />
      <circle cx="21" cy={y} r="1.15" />
    </g>
  )
}

function Rain({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.6 18.8h12.8a5 5 0 0 0 .45-9.9A6.7 6.7 0 0 0 9.8 11.1a4.4 4.4 0 0 0-.2 7.7Z"
      />
      <Raindrops />
    </SvgShell>
  )
}

function Drizzle({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.6 18.8h12.8a5 5 0 0 0 .45-9.9A6.7 6.7 0 0 0 9.8 11.1a4.4 4.4 0 0 0-.2 7.7Z"
      />
      <g className="crm-wx-stroke-rain" strokeWidth="1.25" strokeLinecap="round">
        <path d="M12 21.6v2M16 22.4v2M20 21.6v2" />
      </g>
    </SvgShell>
  )
}

function Showers({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.6 17.6h12.8a5 5 0 0 0 .45-9.9A6.7 6.7 0 0 0 9.8 9.9a4.4 4.4 0 0 0-.2 7.7Z"
      />
      <g className="crm-wx-stroke-rain" strokeWidth="1.55" strokeLinecap="round">
        <path d="M10.5 20.8v4.2M16 22v4.2M21.5 20.8v4.2" />
      </g>
    </SvgShell>
  )
}

function Snow({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.6 18.6h12.8a5 5 0 0 0 .45-9.9A6.7 6.7 0 0 0 9.8 10.9a4.4 4.4 0 0 0-.2 7.7Z"
      />
      <Snowflakes />
    </SvgShell>
  )
}

function SnowShowers({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.6 17.4h12.8a5 5 0 0 0 .45-9.9A6.7 6.7 0 0 0 9.8 9.7a4.4 4.4 0 0 0-.2 7.7Z"
      />
      <Snowflakes y={21.4} />
      <g className="crm-wx-stroke-rain" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
        <path d="M13.2 25.6v1.8M18.8 25.6v1.8" />
      </g>
    </SvgShell>
  )
}

function Thunderstorm({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        className="crm-wx-fill-cloud"
        d="M9.4 16.8h13.2a5.1 5.1 0 0 0 .45-10.1A6.8 6.8 0 0 0 9.6 8.9a4.5 4.4 0 0 0-.2 7.9Z"
      />
      <path
        className="crm-wx-fill-bolt"
        d="M17.2 16.6h-3.6l1.1 4.1h-2.5L18.4 28l-1-4.6h3.2Z"
      />
    </SvgShell>
  )
}

function Unknown({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <circle className="crm-wx-stroke-fog" cx="16" cy="16" r="9" fill="none" strokeWidth="1.6" />
      <path
        className="crm-wx-stroke-fog"
        d="M12.4 13.2a3.6 3.6 0 1 1 5.5 3.1c-.7.5-1.3 1-1.3 2.2"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle className="crm-wx-fill-fog" cx="16" cy="22.4" r="1.2" />
    </SvgShell>
  )
}

export function SunriseIcon({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <circle className="crm-wx-fill-sun" cx="16" cy="18" r="4" />
      <g className="crm-wx-stroke-sun" strokeWidth="1.45" strokeLinecap="round">
        <path d="M16 9.2v2.2M7.6 18h2.1M22.3 18h2.1M9.4 11.4l1.5 1.5M21.1 12.9l1.5-1.5" />
      </g>
      <path className="crm-wx-stroke-horizon" d="M5 22.5h22" strokeWidth="1.5" strokeLinecap="round" />
    </SvgShell>
  )
}

export function SunsetIcon({ className, title }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <circle className="crm-wx-fill-sun" cx="16" cy="18" r="4" opacity="0.85" />
      <g className="crm-wx-stroke-sun" strokeWidth="1.45" strokeLinecap="round" opacity="0.85">
        <path d="M16 9.2v2.2M7.6 18h2.1M22.3 18h2.1M9.4 11.4l1.5 1.5M21.1 12.9l1.5-1.5" />
      </g>
      <path className="crm-wx-stroke-horizon" d="M5 22.5h22" strokeWidth="1.5" strokeLinecap="round" />
      <path
        className="crm-wx-fill-cloud-dim"
        d="M8 24.8h16a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2Z"
        opacity="0.55"
      />
    </SvgShell>
  )
}

/** Compact illuminated-disk icons for the eight major lunar phases (N. hemisphere). */
export function MoonPhaseIcon({
  phase,
  className,
  title,
}: IconProps & { phase: MoonPhaseKey }) {
  // Dark disc + light overlay. Waxing = lit on the right; waning = lit on the left.
  const lit: Record<MoonPhaseKey, ReactNode> = {
    new: null,
    waxingCrescent: (
      <path
        className="crm-wx-fill-moon"
        d="M16 6c4 2.8 6.2 7 6.2 10S20 23.2 16 26c5.5 0 10-4.5 10-10S21.5 6 16 6Z"
      />
    ),
    firstQuarter: <path className="crm-wx-fill-moon" d="M16 6a10 10 0 0 1 0 20Z" />,
    waxingGibbous: (
      <path
        className="crm-wx-fill-moon"
        d="M16 6c-2.8 2.8-4.2 6.5-4.2 10S13.2 23.2 16 26a10 10 0 0 0 0-20Z"
      />
    ),
    full: <circle className="crm-wx-fill-moon" cx="16" cy="16" r="10" />,
    waningGibbous: (
      <path
        className="crm-wx-fill-moon"
        d="M16 6c2.8 2.8 4.2 6.5 4.2 10S18.8 23.2 16 26a10 10 0 0 1 0-20Z"
      />
    ),
    lastQuarter: <path className="crm-wx-fill-moon" d="M16 6a10 10 0 0 0 0 20Z" />,
    waningCrescent: (
      <path
        className="crm-wx-fill-moon"
        d="M16 6c-4 2.8-6.2 7-6.2 10S12 23.2 16 26C10.5 26 6 21.5 6 16S10.5 6 16 6Z"
      />
    ),
  }

  return (
    <SvgShell className={className} title={title}>
      <circle className="crm-wx-fill-moon-dark" cx="16" cy="16" r="10" />
      {lit[phase]}
      <circle
        className="crm-wx-stroke-moon-rim"
        cx="16"
        cy="16"
        r="10"
        fill="none"
        strokeWidth="1.2"
      />
    </SvgShell>
  )
}

export function WeatherConditionIcon({
  conditionKey,
  isDay,
  className,
  title,
}: {
  conditionKey: WeatherConditionKey
  isDay: boolean
  className?: string
  title?: string
}) {
  const props = { className, title }
  switch (conditionKey) {
    case 'clear':
      return isDay ? <Sun {...props} /> : <Moon {...props} />
    case 'mainlyClear':
    case 'partlyCloudy':
      return <PartlyCloudy {...props} isDay={isDay} />
    case 'overcast':
      return <Overcast {...props} />
    case 'fog':
      return <Fog {...props} />
    case 'drizzle':
      return <Drizzle {...props} />
    case 'rain':
      return <Rain {...props} />
    case 'showers':
      return <Showers {...props} />
    case 'snow':
      return <Snow {...props} />
    case 'snowShowers':
      return <SnowShowers {...props} />
    case 'thunderstorm':
      return <Thunderstorm {...props} />
    default:
      return <Unknown {...props} />
  }
}

export type WeatherIconKind =
  | WeatherConditionKey
  | 'sunrise'
  | 'sunset'
  | MoonPhaseKey

/** Unified icon used by the CRM weather panel. */
export function WeatherIcon({
  kind,
  isDay = true,
  className,
  title,
}: {
  kind: WeatherIconKind
  isDay?: boolean
  className?: string
  title?: string
}) {
  if (kind === 'sunrise') return <SunriseIcon className={className} title={title} />
  if (kind === 'sunset') return <SunsetIcon className={className} title={title} />
  if (
    kind === 'new' ||
    kind === 'waxingCrescent' ||
    kind === 'firstQuarter' ||
    kind === 'waxingGibbous' ||
    kind === 'full' ||
    kind === 'waningGibbous' ||
    kind === 'lastQuarter' ||
    kind === 'waningCrescent'
  ) {
    return <MoonPhaseIcon phase={kind} className={className} title={title} />
  }
  return (
    <WeatherConditionIcon
      conditionKey={kind}
      isDay={isDay}
      className={className}
      title={title}
    />
  )
}
