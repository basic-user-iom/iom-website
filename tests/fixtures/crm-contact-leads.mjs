// Synthetic contacts only. No production data or credentials.
export function contactLead(id = 'a', extra = {}) {
  return {
    id, company_name: id === 'b' ? 'Beta Mock' : 'Acme Mock',
    website: 'https://example.test', links: [{ label: 'Portfolio', url: 'https://example.test/work' }],
    contact_name: 'Ada Mock', contact_role: 'Director', email: 'ada@example.test',
    emails: [{ label: 'Office', email: 'office@example.test' }], phone: '+381 11 000 000',
    offer: 'Pavilion walkthrough', company_focus: 'Exhibits', notes: 'Call after 15:00',
    initial_email_subject: 'Mock subject', initial_email_body: 'Hello from the catalog',
    initial_email_drafted_at: null, initial_email_sent_at: null,
    temperature: 'warm', status: 'new', next_follow_up: '2026-11-01',
    contact_priority: false, scheduled_send: null, estimated_value: 1500, value_emoji: '',
    tags: ['architecture'], last_client_reply_at: null,
    atlas_eval: { can_hire_us: 2, thinks_like_us: 3, commercial_potential: 0, creative_compatibility: 0, technical_compatibility: 0, relationship_potential: 0, strategic_value: 0 },
    client_timezone: 'Europe/Belgrade', client_city: 'Belgrade', client_country: 'Serbia',
    client_address: 'Synthetic address', client_lat: 44.8, client_lon: 20.4,
    owner_id: 'mock-user', owner_email: 'owner@example.test', owner_avatar_url: null,
    created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
    ...extra,
  }
}

export function catalogLead(id = 'a', extra = {}) {
  const lead = contactLead(id, extra)
  delete lead.offer
  delete lead.notes
  return lead
}
