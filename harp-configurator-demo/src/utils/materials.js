import { useMemo } from 'react'
import { OPTIONS, SUMMARY_ROWS } from '../config/productConfig.js'
import { WOOD_FINISHES, HARDWARE_FINISHES } from '../config/materials.js'

export function formatSummaryValue(optionId, value) {
  const option = OPTIONS[optionId]
  if (!option) return String(value)
  if (option.type === 'boolean') return value ? option.summaryOn : option.summaryOff
  const choice = option.choices?.find((item) => item.id === value)
  return choice?.label ?? String(value)
}

export function getActiveMaterials(values) {
  return {
    wood: WOOD_FINISHES[values.finish] ?? WOOD_FINISHES.natural,
    hardware: HARDWARE_FINISHES[values.hardware] ?? HARDWARE_FINISHES.bright,
  }
}

export function useSummaryRows(values) {
  return useMemo(
    () =>
      SUMMARY_ROWS.map((row) => ({
        ...row,
        value: formatSummaryValue(row.optionId, values[row.optionId]),
      })),
    [values],
  )
}
