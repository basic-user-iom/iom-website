/** Curated CRM-safe emoticons for lead estimated value. */
export const VALUE_EMOJI_OPTIONS = [
  { emoji: '', i18nKey: 'form.valueEmojiNone' as const },
  { emoji: '❤️', i18nKey: 'form.valueEmojiHeart' as const },
  { emoji: '🎁', i18nKey: 'form.valueEmojiGift' as const },
  { emoji: '🤝', i18nKey: 'form.valueEmojiPartner' as const },
  { emoji: '⭐', i18nKey: 'form.valueEmojiStar' as const },
] as const

export type ValueEmojiOption = (typeof VALUE_EMOJI_OPTIONS)[number]

const HEART_SET = new Set(['❤️', '♥', '❤', '♥️'])

/** Heart / pro-bono tag (allows empty or €0 display). */
export function isHeartValueEmoji(emoji: string | null | undefined): boolean {
  return HEART_SET.has((emoji ?? '').trim())
}

/** Emoticon implies no monetary charge when value is missing or zero. */
export function isNoChargeValueEmoji(emoji: string | null | undefined): boolean {
  const e = (emoji ?? '').trim()
  return isHeartValueEmoji(e) || e === '🎁'
}

export function normalizeValueEmoji(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (VALUE_EMOJI_OPTIONS.some((o) => o.emoji === trimmed)) return trimmed
  // Accept common heart variants as the stored heart option.
  if (isHeartValueEmoji(trimmed)) return '❤️'
  // Allow other single emoji already saved (forward compatible).
  if ([...trimmed].length <= 4) return trimmed
  return ''
}

export function formatLeadEstimatedValue(
  estimatedValue: number | null | undefined,
  valueEmoji: string | null | undefined,
  locale: string,
  labels: { fromTheHeart: string; noCharge: string },
): { primary: string; emoji: string; caption: string | null; isEmotive: boolean } {
  const emoji = normalizeValueEmoji(valueEmoji)
  const amount =
    estimatedValue == null || Number.isNaN(estimatedValue)
      ? null
      : Number(estimatedValue)
  const zeroOrEmpty = amount == null || amount === 0
  const noCharge = isNoChargeValueEmoji(emoji) && zeroOrEmpty

  if (noCharge) {
    return {
      primary: emoji || '❤️',
      emoji: emoji || '❤️',
      caption: isHeartValueEmoji(emoji) ? labels.fromTheHeart : labels.noCharge,
      isEmotive: true,
    }
  }

  const money =
    amount == null
      ? '—'
      : new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(amount)

  return {
    primary: emoji ? `${money} ${emoji}` : money,
    emoji,
    caption: null,
    isEmotive: false,
  }
}
