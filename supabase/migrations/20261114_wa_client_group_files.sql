-- WA Control: one WhatsApp group per client (a client's brands and stores share it), the saved numbers behind each weekly
-- summary (so its PDF matches the text), and the switch for sending PDFs as files (needs the Fonnte Super package).
-- Safe to run twice.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS wa_group_id UUID REFERENCES public.wa_groups(id) ON DELETE SET NULL;

ALTER TABLE public.wa_outbox ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE public.wa_settings ADD COLUMN IF NOT EXISTS send_files BOOLEAN NOT NULL DEFAULT false;

-- Private storage for the files Oli sends (the advertiser's session report PDF / image). Served to Fonnte by a short-lived signed link.
INSERT INTO storage.buckets (id, name, public) VALUES ('wa-files', 'wa-files', false) ON CONFLICT (id) DO NOTHING;

-- A reference to what a send was about (e.g. the advertiser session report: client|store|date|session), to stop the same one going out twice.
ALTER TABLE public.wa_sends ADD COLUMN IF NOT EXISTS ref TEXT;
CREATE INDEX IF NOT EXISTS idx_wa_sends_ref ON public.wa_sends (workspace_id, kind, ref, created_at DESC);
