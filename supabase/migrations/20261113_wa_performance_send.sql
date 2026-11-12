-- WA Control > Founder: the daily / weekly team performance report, sent by the ERP itself (replaces the Make.com scenario
-- "Daily / Weekly Report WhatsApp"). Recipients, a send history, and an auto-send switch. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.wa_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,                  -- digits only, 62...
    name TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, phone)
);

CREATE TABLE IF NOT EXISTS public.wa_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,                   -- daily | weekly | monthly
    report_date DATE NOT NULL,            -- the Jakarta "today" the report was built for
    trigger TEXT NOT NULL,                -- cron | manual | test
    recipients TEXT[] NOT NULL DEFAULT '{}',
    ok BOOLEAN NOT NULL,
    detail TEXT,                          -- Fonnte's answer or the error
    text TEXT,                            -- what was sent
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_sends_time ON public.wa_sends (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wa_settings (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    auto_send BOOLEAN NOT NULL DEFAULT false,   -- the 09:00 cron sends only when this is on
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_recipients','wa_sends','wa_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;
