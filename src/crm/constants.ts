import type { ActivityType, LeadStatus, LeadTemperature } from './types'
import { EMPTY_ATLAS_EVAL } from './atlasEval'

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
]

export const LEAD_TEMPERATURES: { value: LeadTemperature; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
]

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
]

export const STATUS_LABEL: Record<LeadStatus, string> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.value, s.label]),
) as Record<LeadStatus, string>

export const TEMP_LABEL: Record<LeadTemperature, string> = Object.fromEntries(
  LEAD_TEMPERATURES.map((t) => [t.value, t.label]),
) as Record<LeadTemperature, string>

export const EMPTY_LEAD_INPUT = {
  company_name: '',
  website: '',
  links: [] as { label: string; url: string }[],
  contact_name: '',
  contact_role: '',
  email: '',
  emails: [] as { label: string; email: string }[],
  phone: '',
  offer: '',
  company_focus: '',
  notes: '',
  initial_email_subject: '',
  initial_email_body: '',
  initial_email_drafted_at: null,
  initial_email_sent_at: null,
  temperature: 'warm' as const,
  status: 'new' as const,
  next_follow_up: null,
  contact_priority: false,
  estimated_value: null,
  value_emoji: '',
  atlas_eval: { ...EMPTY_ATLAS_EVAL },
  client_timezone: '',
  client_city: '',
  client_country: '',
  client_address: '',
  client_lat: null as number | null,
  client_lon: null as number | null,
}
