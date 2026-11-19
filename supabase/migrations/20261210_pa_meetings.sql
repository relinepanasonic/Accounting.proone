-- Fefe as a personal assistant: every meeting (online, offline, or one the sales typed in the ERP) is followed, an hour after it ends, by a WhatsApp asking the owner
-- for the meeting notes (MoM). Offline meetings are told to Fefe by WhatsApp and kept in the ERP's Meetings with their Google event.
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS kind TEXT;                 -- 'online' (Google Meet, from the chat) | 'offline' (told to Fefe) | null (typed in the ERP)
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS mom_status TEXT;           -- 'pending' | 'asked' | 'later' | 'asked2' | 'done' | 'skipped'
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS mom_asked_at TIMESTAMPTZ;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS mom_text TEXT;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS mom_summary TEXT;
ALTER TABLE public.lead_visits ADD COLUMN IF NOT EXISTS mom_at TIMESTAMPTZ;
-- the meetings that already happened are not asked about; the new ones start as 'pending'
UPDATE public.lead_visits SET mom_status = 'skipped' WHERE mom_status IS NULL;
ALTER TABLE public.lead_visits ALTER COLUMN mom_status SET DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS lead_visits_mom ON public.lead_visits (visit_at) WHERE mom_status IN ('pending', 'later');
