-- WA Monitor: a short log of every call the Fonnte webhook receives, so a missing chat can be diagnosed.
-- Kept 7 days (the webhook prunes it). Finance members can read it; the app writes it (service role).

CREATE TABLE IF NOT EXISTS public.wa_webhook_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.wa_devices(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    outcome TEXT NOT NULL,              -- stored | ignored | device-mismatch | error
    reason TEXT,
    content_type TEXT,
    payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_log_time ON public.wa_webhook_log (workspace_id, received_at DESC);

ALTER TABLE public.wa_webhook_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_finance_read ON public.wa_webhook_log;
CREATE POLICY wa_finance_read ON public.wa_webhook_log FOR SELECT USING (public.is_finance_member(workspace_id));
