-- Junk leads: when a chat is ignored (a verification code, a company's auto-greeting, or "Not a lead"), the lead the automation already made for it is ARCHIVED
-- (stage "Archived", hidden from the pipeline, reports and stats; the stage it had is kept here so "This is a lead" can restore it). The month-end job deletes
-- what is still archived.
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS archived_from TEXT;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS crm_deals_archived ON public.crm_deals (archived_at) WHERE stage = 'Archived';
