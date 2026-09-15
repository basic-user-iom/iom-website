import { makeBendState } from './bendMath'
import { clampLinarPanelCount } from './materialData'

/** Keep a repeated C installation below a half turn, without weakening its S component. */
export function makeInstallationBendState(
  bend: number,
  panelCount: number,
  panelWidthM: number,
  referenceRadiusMm: number | null,
  bendableWidthM = panelWidthM,
  secondaryCurveAmount = 0,
  maxNormalOffsetM = 0,
) {
  const count = clampLinarPanelCount(panelCount)
  const selected = makeBendState(bend, panelWidthM, referenceRadiusMm, bendableWidthM)
  if (count === 1 || Math.abs(bend) < 0.000001) {
    return makeBendState(bend, panelWidthM, referenceRadiusMm, bendableWidthM,
      secondaryCurveAmount, maxNormalOffsetM)
  }
  const sign = Math.sign(bend)
  const targetTurn = selected.alpha / count
  let low = 0
  let high = Math.min(100, Math.abs(bend))
  for (let i = 0; i < 24; i += 1) {
    const candidate = (low + high) * 0.5
    const turn = makeBendState(sign * candidate, panelWidthM,
      referenceRadiusMm, bendableWidthM).alpha
    if (turn < targetTurn) low = candidate
    else high = candidate
  }
  const primaryControl = sign * (low + high) * 0.5
  if (secondaryCurveAmount > 0) {
    return makeBendState(bend, panelWidthM, referenceRadiusMm, bendableWidthM,
      secondaryCurveAmount, maxNormalOffsetM, primaryControl)
  }
  const primary = makeBendState(primaryControl, panelWidthM, referenceRadiusMm, bendableWidthM)
  // The control reports the selected single-module reference; geometry and
  // minimumLocalRadiusMm describe the actual distributed installation.
  return { ...primary, control: selected.control, percent: selected.percent,
    selectedRadiusMm: selected.selectedRadiusMm }
}
