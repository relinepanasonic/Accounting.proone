-- Scenario flows (boxes and lines drawn in the chat dashboard) and a log of what they did. Written by the app (service role); finance members can read.

CREATE TABLE IF NOT EXISTS public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT false,          -- a new flow is OFF until the team switches it on
    graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_bot_flows_ws ON public.bot_flows (workspace_id, active, created_at);

CREATE TABLE IF NOT EXISTS public.bot_flow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    flow_id UUID,
    flow_name TEXT NOT NULL,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    trigger_text TEXT,                              -- the lead's message that started it
    actions TEXT[],                                 -- what was done, in order
    handled BOOLEAN NOT NULL DEFAULT false,         -- the flow answered the lead (so the normal bot stayed quiet)
    outcome TEXT NOT NULL DEFAULT 'ok',             -- ok | failed
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_flow_runs_ws ON public.bot_flow_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_flow_runs_flow_chat ON public.bot_flow_runs (flow_id, group_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bot_flows','bot_flow_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;

-- The bot's own replies were logged but never saved as chat messages (Fonnte does not send our own messages back), so a chat the bot had answered
-- still looked unanswered. Save the ones already sent, once.
INSERT INTO public.wa_messages (workspace_id, group_id, sender_phone, sender_name, body, is_from_me, dedupe_key, sent_at, source, raw)
SELECT l.workspace_id, l.group_id, d.phone, NULL, l.reply, true, 'botlog:' || l.id::text, l.created_at, 'bot', '{"bot": true}'::jsonb
FROM public.wa_bot_log l
JOIN public.wa_groups g ON g.id = l.group_id
LEFT JOIN public.wa_devices d ON d.id = g.device_id
WHERE l.ok AND l.reply IS NOT NULL AND l.reply <> ''
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING;
