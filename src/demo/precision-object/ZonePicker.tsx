import { WATCH_TIME_ZONES } from './cetWatchHands'

type Props = {
  value: string
  onChange: (timeZone: string) => void
}

export function ZonePicker({ value, onChange }: Props) {
  return (
    <label className="pov-zone">
      <span className="pov-zone__label">Zone</span>
      <select
        className="pov-zone__select"
        value={value}
        aria-label="Watch time zone"
        onChange={(event) => onChange(event.target.value)}
      >
        {WATCH_TIME_ZONES.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label}
          </option>
        ))}
      </select>
    </label>
  )
}
