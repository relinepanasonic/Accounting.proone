-- Free consultations with the expert team (booked by the bot or the team, put on the shared Google Calendar with a Meet link), and WhatsApp
-- broadcasts sent one by one from a queue, inside a time window and under a daily cap. Written by the app (service role); finance members can read.

-- 1) Meeting settings, on the bot's settings row.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_days TEXT NOT NULL DEFAULT '1,2,3,4,5';          -- 0 = Sunday ... 6 = Saturday
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_from TEXT NOT NULL DEFAULT '10:00';               -- Jakarta time
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_to TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_minutes INT NOT NULL DEFAULT 30 CHECK (meet_minutes BETWEEN 15 AND 120);
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_notice_hours INT NOT NULL DEFAULT 3 CHECK (meet_notice_hours BETWEEN 0 AND 72);
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_days_ahead INT NOT NULL DEFAULT 7 CHECK (meet_days_ahead BETWEEN 1 AND 30);
-- 2) Broadcast settings: what protects the number.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS bc_daily_max INT NOT NULL DEFAULT 40 CHECK (bc_daily_max BETWEEN 1 AND 300);
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS bc_from TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS bc_to TEXT NOT NULL DEFAULT '19:00';
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS bc_gap_min INT NOT NULL DEFAULT 90 CHECK (bc_gap_min BETWEEN 30 AND 3600);   -- seconds
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS bc_gap_max INT NOT NULL DEFAULT 240 CHECK (bc_gap_max BETWEEN 30 AND 7200);

-- 3) The Google account the meetings go on (one per workspace). The refresh token never leaves the server: no read policy.
CREATE TABLE IF NOT EXISTS public.google_calendar_link (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT,
    refresh_token TEXT NOT NULL,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    connected_by TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.google_calendar_link ENABLE ROW LEVEL SECURITY;

-- 4) Booked meetings.
CREATE TABLE IF NOT EXISTS public.chat_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE SET NULL,
    lead_name TEXT,
    store TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'done', 'no_show', 'cancelled')),
    meet_url TEXT,
    google_event_id TEXT,
    booked_by TEXT NOT NULL DEFAULT 'bot',      -- "bot" or the person's name
    note TEXT,
    reminded_at TIMESTAMPTZ,                    -- the lead got the reminder before the meeting
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_meetings_ws_time ON public.chat_meetings (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_chat_meetings_chat ON public.chat_meetings (group_id, starts_at);
-- two bookings can never take the same time
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_meetings_slot ON public.chat_meetings (workspace_id, starts_at) WHERE status = 'booked';

-- 5) Broadcasts and their queue.
CREATE TABLE IF NOT EXISTS public.chat_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    message TEXT NOT NULL,                      -- variants separated by a line "---"; {nama} = first name
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'done', 'cancelled')),
    total INT NOT NULL DEFAULT 0,
    next_send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    fails_in_row INT NOT NULL DEFAULT 0,
    paused_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_broadcasts_due ON public.chat_broadcasts (status, next_send_at);

CREATE TABLE IF NOT EXISTS public.chat_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES public.chat_broadcasts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE SET NULL,
    wa_id TEXT NOT NULL,
    name TEXT,
    position INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
    error TEXT,
    sent_at TIMESTAMPTZ,
    UNIQUE (broadcast_id, wa_id)
);
CREATE INDEX IF NOT EXISTS idx_bc_recipients_next ON public.chat_broadcast_recipients (broadcast_id, status, position);
CREATE INDEX IF NOT EXISTS idx_bc_recipients_sent ON public.chat_broadcast_recipients (workspace_id, sent_at);

-- People who said STOP never get a broadcast again.
CREATE TABLE IF NOT EXISTS public.chat_optouts (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    wa_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, wa_id)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_meetings','chat_broadcasts','chat_broadcast_recipients','chat_optouts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;

-- 6) The once-a-minute clock now also runs when a broadcast message or a meeting reminder is due (not only a flow's Wait).
SELECT cron.unschedule('flow-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flow-tick');
SELECT cron.schedule('flow-tick', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://erp.profesoronline.id/api/v1/chat/flows/tick',
    headers := jsonb_build_object('content-type', 'application/json', 'x-flow-tick', (SELECT key FROM public.flow_tick_key WHERE id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  WHERE EXISTS (SELECT 1 FROM public.bot_flow_sessions WHERE kind = 'wait' AND resume_at <= now())
     OR EXISTS (SELECT 1 FROM public.chat_broadcasts WHERE status = 'running' AND next_send_at <= now())
     OR EXISTS (SELECT 1 FROM public.chat_meetings WHERE status = 'booked' AND reminded_at IS NULL AND starts_at <= now() + interval '60 minutes' AND starts_at > now());
$job$);
