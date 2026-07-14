-- IOM CRM: Atlas Evaluation Principle scores on crm_leads
--
-- Paste into Supabase → SQL Editor → Run, then hard-refresh the CRM.
-- Safe to re-run (IF NOT EXISTS).
--
-- Scores are integers 0–5 (0 = unset). Stored as one jsonb object:
-- {
--   "can_hire_us": 0,
--   "thinks_like_us": 0,
--   "commercial_potential": 0,
--   "creative_compatibility": 0,
--   "technical_compatibility": 0,
--   "relationship_potential": 0,
--   "strategic_value": 0
-- }

alter table public.crm_leads
  add column if not exists atlas_eval jsonb not null default '{}'::jsonb;

comment on column public.crm_leads.atlas_eval is
  'Atlas Evaluation Principle: headline + criteria scores 0–5 (0 unset)';
