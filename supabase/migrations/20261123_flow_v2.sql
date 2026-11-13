-- Scenario flows v2: the order flows are checked in, questions whose answers are saved, and flows that stop (for an answer, or a Wait box) and
-- go on later. Written by the app (service role); finance members can read.

-- 1) Order: the first matching flow runs, so the team decides which comes first.
ALTER TABLE public.bot_flows ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
UPDATE public.bot_flows f SET position = o.rn
FROM (SELECT id, row_number() OVER (PARTITION BY workspace_id ORDER BY created_at) AS rn FROM public.bot_flows) o
WHERE o.id = f.id AND f.position = 0;

-- 2) What the lead answered to "Ask a question" boxes, by field name ({"toko": "hijab", ...}). Shown in the chat's side panel.
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) A flow that stopped in a chat: at most one per chat.
CREATE TABLE IF NOT EXISTS public.bot_flow_sessions (
    group_id UUID PRIMARY KEY REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    flow_name TEXT NOT NULL,
    node_id TEXT NOT NULL,                  -- the box it stopped at
    kind TEXT NOT NULL,                     -- answer | wait
    field TEXT,                             -- answer: where the answer is saved
    if_reply TEXT,                          -- wait: stop | continue
    resume_at TIMESTAMPTZ,                  -- wait: when to go on
    expires_at TIMESTAMPTZ,                 -- answer: give up after this
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bot_flow_sessions_due ON public.bot_flow_sessions (kind, resume_at);

ALTER TABLE public.bot_flow_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_finance_read ON public.bot_flow_sessions;
CREATE POLICY wa_finance_read ON public.bot_flow_sessions FOR SELECT USING (public.is_finance_member(workspace_id));

-- 4) The clock for Wait boxes. Vercel crons here run once a day, so the database calls the ERP once a minute, and only when a Wait is due.
--    The key is made here and never leaves the database: the scheduler sends it, the ERP reads it back with the service role to compare.
CREATE TABLE IF NOT EXISTS public.flow_tick_key (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);
INSERT INTO public.flow_tick_key (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.flow_tick_key ENABLE ROW LEVEL SECURITY;   -- no policies: only the service role can read it

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('flow-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flow-tick');
SELECT cron.schedule('flow-tick', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://erp.profesoronline.id/api/v1/chat/flows/tick',
    headers := jsonb_build_object('content-type', 'application/json', 'x-flow-tick', (SELECT key FROM public.flow_tick_key WHERE id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  WHERE EXISTS (SELECT 1 FROM public.bot_flow_sessions WHERE kind = 'wait' AND resume_at <= now());
$job$);
