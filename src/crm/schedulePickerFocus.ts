import type { FormEvent } from 'react'

/** Advance within this date/time group after a complete numeric entry. */
export function advanceSchedulePart(event: FormEvent<HTMLDivElement>): void {
  const input = event.target
  const nativeEvent = event.nativeEvent as InputEvent
  if (
    !(input instanceof HTMLInputElement) ||
    nativeEvent.isComposing ||
    !nativeEvent.inputType?.startsWith('insert') ||
    input.value.length !== input.maxLength ||
    !/^\d+$/.test(input.value)
  ) return

  const fields = Array.from(
    event.currentTarget.querySelectorAll<HTMLInputElement>('input'),
  )
  const next = fields[fields.indexOf(input) + 1]
  if (!next || next.disabled || next.readOnly) return
  next.focus()
  next.select()
}
