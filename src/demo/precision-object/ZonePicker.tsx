import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  berlinCivilTime,
  formatCivilHms,
  WATCH_TIME_ZONES,
} from './cetWatchHands'

type Props = {
  value: string
  onChange: (timeZone: string) => void
}

function zoneIndex(timeZone: string) {
  const index = WATCH_TIME_ZONES.findIndex((zone) => zone.id === timeZone)
  return index >= 0 ? index : 0
}

export function ZonePicker({ value, onChange }: Props) {
  const [clock, setClock] = useState(() => formatCivilHms(berlinCivilTime()))
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => zoneIndex(value))
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const selected = WATCH_TIME_ZONES[zoneIndex(value)]

  useEffect(() => {
    const tick = () => setClock(formatCivilHms(berlinCivilTime()))
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [value])

  useEffect(() => {
    if (!open) return
    setActiveIndex(zoneIndex(value))
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const commit = (timeZone: string) => {
    onChange(timeZone)
    close()
  }

  const moveActive = (delta: number) => {
    setActiveIndex((index) => (index + delta + WATCH_TIME_ZONES.length) % WATCH_TIME_ZONES.length)
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      if (!open) return
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'Home') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === 'End') {
      if (!open) return
      event.preventDefault()
      setActiveIndex(WATCH_TIME_ZONES.length - 1)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveIndex(zoneIndex(value))
        return
      }
      if (event.key === 'ArrowDown') moveActive(1)
      if (event.key === 'ArrowUp') moveActive(-1)
      if (event.key === 'Enter' || event.key === ' ') {
        commit(WATCH_TIME_ZONES[activeIndex].id)
      }
    }
  }

  return (
    <div
      className={open ? 'pov-zone is-open' : 'pov-zone'}
      ref={rootRef}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setOpen(false)
        }
      }}
    >
      <span className="pov-zone__label">Zone</span>
      <button
        ref={buttonRef}
        type="button"
        className="pov-zone__trigger"
        aria-label="Watch time zone"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={onTriggerKeyDown}
      >
        {selected.label}
      </button>
      <time className="pov-zone__clock" dateTime={clock} aria-label="Watch civil time">
        {clock}
      </time>
      {open ? (
        <ul className="pov-zone__menu" id={listId} role="listbox" aria-label="Watch time zone">
          {WATCH_TIME_ZONES.map((zone, index) => {
            const isSelected = zone.id === value
            const isActive = index === activeIndex
            return (
              <li
                key={zone.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                className={
                  isActive
                    ? 'pov-zone__option is-active'
                    : 'pov-zone__option'
                }
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(zone.id)}
              >
                {zone.label}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
