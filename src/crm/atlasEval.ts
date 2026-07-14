/** Atlas Evaluation scores on a lead (0 = unset, 1–5 = stars). */
export interface AtlasEval {
  can_hire_us: number
  thinks_like_us: number
  commercial_potential: number
  creative_compatibility: number
  technical_compatibility: number
  relationship_potential: number
  strategic_value: number
}

export const EMPTY_ATLAS_EVAL: AtlasEval = {
  can_hire_us: 0,
  thinks_like_us: 0,
  commercial_potential: 0,
  creative_compatibility: 0,
  technical_compatibility: 0,
  relationship_potential: 0,
  strategic_value: 0,
}

export const ATLAS_HEADLINE_KEYS = ['can_hire_us', 'thinks_like_us'] as const

export const ATLAS_CRITERIA_KEYS = [
  'creative_compatibility',
  'technical_compatibility',
  'relationship_potential',
  'strategic_value',
] as const

export type AtlasScoreKey =
  | (typeof ATLAS_HEADLINE_KEYS)[number]
  | (typeof ATLAS_CRITERIA_KEYS)[number]

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(5, Math.round(v)))
}

export function normalizeAtlasEval(raw: unknown): AtlasEval {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    can_hire_us: clampScore(src.can_hire_us),
    thinks_like_us: clampScore(src.thinks_like_us),
    commercial_potential: clampScore(src.commercial_potential),
    creative_compatibility: clampScore(src.creative_compatibility),
    technical_compatibility: clampScore(src.technical_compatibility),
    relationship_potential: clampScore(src.relationship_potential),
    strategic_value: clampScore(src.strategic_value),
  }
}

/** True when any score is set (1–5). */
export function hasAtlasEval(eval_: AtlasEval | null | undefined): boolean {
  if (!eval_) return false
  const e = normalizeAtlasEval(eval_)
  return (
    e.can_hire_us > 0 ||
    e.thinks_like_us > 0 ||
    e.creative_compatibility > 0 ||
    e.technical_compatibility > 0 ||
    e.relationship_potential > 0 ||
    e.strategic_value > 0
  )
}

/**
 * Composite priority hint (1–5) from headline scores.
 * Uses the rounded average of set headline scores; 0 when none set.
 */
export function atlasPriorityComposite(eval_: AtlasEval | null | undefined): number {
  if (!eval_) return 0
  const e = normalizeAtlasEval(eval_)
  const scores = [e.can_hire_us, e.thinks_like_us].filter((s) => s > 0)
  if (scores.length === 0) return 0
  return Math.max(
    1,
    Math.min(5, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)),
  )
}

export function atlasPriorityHintKey(
  composite: number,
): `atlas.priority${1 | 2 | 3 | 4 | 5}` | null {
  if (composite < 1 || composite > 5) return null
  return `atlas.priority${composite as 1 | 2 | 3 | 4 | 5}`
}
