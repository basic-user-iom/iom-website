import { getSupabase, useLiveCrmBackend } from './supabaseClient'
import { isCrmDemoMode } from './demoMode'
import type { CrmClientAccount, CrmClientMembership } from './types'

export type CrmAccessRole = 'staff' | 'client' | 'none'

/** Local/demo = staff. Live = RPC is_crm_staff / is_crm_client. */
export async function resolveCrmAccessRole(): Promise<CrmAccessRole> {
  if (!useLiveCrmBackend() || isCrmDemoMode()) return 'staff'
  const supabase = getSupabase()!
  const { data: staff, error: staffErr } = await supabase.rpc('is_crm_staff')
  if (staffErr) throw new Error(staffErr.message)
  if (staff === true) return 'staff'
  const { data: client, error: clientErr } = await supabase.rpc('is_crm_client')
  if (clientErr) throw new Error(clientErr.message)
  if (client === true) return 'client'
  return 'none'
}

export async function listClientAccounts(): Promise<CrmClientAccount[]> {
  if (!useLiveCrmBackend()) return []
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_client_accounts')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CrmClientAccount[]
}

export async function createClientAccount(input: {
  name: string
  lead_id?: string | null
}): Promise<CrmClientAccount> {
  if (!useLiveCrmBackend()) {
    throw new Error('Client accounts require online Supabase.')
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_client_accounts')
    .insert({
      name: input.name.trim(),
      lead_id: input.lead_id ?? null,
      active: true,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as CrmClientAccount
}

export async function updateClientAccount(
  id: string,
  input: Partial<Pick<CrmClientAccount, 'name' | 'active' | 'lead_id'>>,
): Promise<CrmClientAccount> {
  if (!useLiveCrmBackend()) {
    throw new Error('Client accounts require online Supabase.')
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase
    .from('crm_client_accounts')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as CrmClientAccount
}

export async function listClientMemberships(
  accountId: string,
): Promise<CrmClientMembership[]> {
  if (!useLiveCrmBackend()) return []
  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('crm_list_client_members', {
    p_account_id: accountId,
  })
  if (!error && Array.isArray(data)) {
    return (data as Array<{
      id: string
      user_id: string
      email: string
      active: boolean
      created_at: string
    }>).map((row) => ({
      id: row.id,
      client_account_id: accountId,
      user_id: row.user_id,
      email: row.email || '',
      active: row.active,
      created_at: row.created_at,
    }))
  }
  // Fallback if RPC not applied yet
  const { data: rows, error: listErr } = await supabase
    .from('crm_client_memberships')
    .select('*')
    .eq('client_account_id', accountId)
    .order('created_at', { ascending: false })
  if (listErr) throw new Error(listErr.message)
  return (rows ?? []) as CrmClientMembership[]
}

/** Staff-only RPC: attach an existing Auth user (by email) to an account. */
export async function addClientMemberByEmail(
  accountId: string,
  email: string,
): Promise<string> {
  if (!useLiveCrmBackend()) {
    throw new Error('Client memberships require online Supabase.')
  }
  const supabase = getSupabase()!
  const { data, error } = await supabase.rpc('crm_add_client_member', {
    p_account_id: accountId,
    p_email: email.trim(),
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('user_not_found')) {
      throw new Error(
        'No Auth user with that email. Create the user in Supabase Auth first, then link them.',
      )
    }
    if (msg.includes('staff_cannot_be_client')) {
      throw new Error('Staff accounts cannot be linked as client members.')
    }
    throw new Error(msg)
  }
  return String(data)
}

export async function setClientMemberActive(
  membershipId: string,
  active: boolean,
): Promise<void> {
  if (!useLiveCrmBackend()) {
    throw new Error('Client memberships require online Supabase.')
  }
  const supabase = getSupabase()!
  const { error } = await supabase
    .from('crm_client_memberships')
    .update({ active })
    .eq('id', membershipId)
  if (error) throw new Error(error.message)
}
