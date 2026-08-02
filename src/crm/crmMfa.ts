import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode } from './demoMode'

export type SignInResult =
  | { kind: 'complete' }
  | { kind: 'mfa_challenge'; factorId: string }

export type MfaFactorSummary = {
  id: string
  friendly_name: string | null
  status: 'verified' | 'unverified'
}

export type MfaEnrollStart = {
  factorId: string
  qrCode: string
  secret: string
}

function requireLive() {
  if (!useLiveCrmBackend() || isCrmDemoMode()) {
    throw new Error('MFA requires online Supabase.')
  }
  return getSupabase()!
}

/** After password sign-in: complete, or TOTP challenge required. */
export async function getPostLoginMfaState(): Promise<SignInResult> {
  if (!useLiveCrmBackend() || isCrmDemoMode()) return { kind: 'complete' }
  const supabase = getSupabase()!
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  if (data.currentLevel === 'aal2' || data.nextLevel !== 'aal2') {
    return { kind: 'complete' }
  }
  const { data: factors, error: factorErr } = await supabase.auth.mfa.listFactors()
  if (factorErr) throw new Error(factorErr.message)
  const totp = (factors?.totp ?? []).find((f) => f.status === 'verified')
  if (!totp) return { kind: 'complete' }
  return { kind: 'mfa_challenge', factorId: totp.id }
}

export async function verifyMfaChallenge(
  factorId: string,
  code: string,
): Promise<void> {
  const supabase = requireLive()
  const trimmed = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(trimmed)) throw new Error('INVALID_MFA_CODE')
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId,
  })
  if (challengeErr) throw new Error(challengeErr.message)
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: trimmed,
  })
  if (error) {
    console.warn('[crm] mfa verify failed:', error.message)
    throw new Error('INVALID_MFA_CODE')
  }
}

export async function staffHasVerifiedMfa(): Promise<boolean> {
  if (!useLiveCrmBackend() || isCrmDemoMode()) return true
  const factors = await listVerifiedTotpFactors()
  return factors.length > 0
}

export async function listVerifiedTotpFactors(): Promise<MfaFactorSummary[]> {
  if (!useLiveCrmBackend() || isCrmDemoMode()) return []
  const supabase = getSupabase()!
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return (data?.totp ?? [])
    .filter((f) => f.status === 'verified')
    .map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      status: 'verified' as const,
    }))
}

export async function startMfaEnrollment(
  friendlyName = 'IOM CRM',
): Promise<MfaEnrollStart> {
  const supabase = requireLive()
  // Drop leftover unverified factors so re-enroll works after a cancelled setup.
  const { data: existing } = await supabase.auth.mfa.listFactors()
  for (const factor of existing?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => {})
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })
  if (error) throw new Error(error.message)
  const qrCode = data.totp?.qr_code ?? ''
  const secret = data.totp?.secret ?? ''
  if (!data.id || !qrCode) throw new Error('MFA enroll failed.')
  return { factorId: data.id, qrCode, secret }
}

export async function confirmMfaEnrollment(
  factorId: string,
  code: string,
): Promise<void> {
  await verifyMfaChallenge(factorId, code)
}

export async function unenrollMfaFactor(factorId: string): Promise<void> {
  const supabase = requireLive()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}
