-- Follow-up nudges: WhatsApp leads who chatted, went quiet after our answer and never booked the free consultation get 1 to 3 short messages
-- (for example a day and three days after their last message), each with three free times; a number in reply books it.

ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS nudge_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS nudge_hours TEXT NOT NULL DEFAULT '24,72';   -- hours after the lead's last message

CREATE TABLE IF NOT EXISTS public.chat_nudges (
  group_id UUID PRIMARY KEY REFERENCES public.wa_groups(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  inbound_at TIMESTAMPTZ,            -- the lead message the current count is about (a new message starts the count again)
  sent INT NOT NULL DEFAULT 0,       -- nudges sent since that message
  total INT NOT NULL DEFAULT 0,      -- nudges ever sent to this chat (capped)
  last_sent_at TIMESTAMPTZ,
  offer JSONB,                       -- the three numbered times of the last nudge
  offer_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ              -- the lead booked by answering a nudge with a number
);
CREATE INDEX IF NOT EXISTS chat_nudges_ws_sent ON public.chat_nudges (workspace_id, last_sent_at);
ALTER TABLE public.chat_nudges ENABLE ROW LEVEL SECURITY;   -- server only (no policies)

-- the chats that may need a nudge: WhatsApp sales chats where the lead wrote since p_since, we answered after that, no consultation was ever
-- booked, the lead did not say STOP, and the chat is not handed over to the team. Which nudge is due is decided in nudge-rules.ts.
CREATE OR REPLACE FUNCTION public.chat_nudge_candidates(p_since TIMESTAMPTZ)
RETURNS TABLE (workspace_id UUID, group_id UUID, wa_id TEXT, name TEXT, last_in TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.workspace_id, g.id, g.wa_id, g.name, li.last_in
  FROM wa_groups g
  JOIN wa_devices d ON d.id = g.device_id AND d.role = 'sales' AND d.active AND d.phone !~ '^(ig|fb):'
  JOIN wa_bot_config c ON c.workspace_id = g.workspace_id AND c.nudge_enabled
  CROSS JOIN LATERAL (SELECT max(m.sent_at) AS last_in FROM wa_messages m WHERE m.group_id = g.id AND NOT m.is_from_me) li
  WHERE NOT g.is_group AND g.wa_id ~ '^\d{8,16}$' AND g.last_message_at >= p_since
    AND li.last_in >= p_since
    AND EXISTS (SELECT 1 FROM wa_messages m WHERE m.group_id = g.id AND m.is_from_me AND m.sent_at > li.last_in)
    AND NOT EXISTS (SELECT 1 FROM chat_meetings x WHERE x.group_id = g.id)
    AND NOT EXISTS (SELECT 1 FROM chat_optouts o WHERE o.workspace_id = g.workspace_id AND o.wa_id = g.wa_id)
    AND NOT EXISTS (SELECT 1 FROM wa_bot_chats b WHERE b.group_id = g.id AND b.status = 'human')
  ORDER BY li.last_in
  LIMIT 300;
$$;
REVOKE ALL ON FUNCTION public.chat_nudge_candidates(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_nudge_candidates(TIMESTAMPTZ) TO service_role;

-- the once-a-minute clock also runs every 10 minutes while follow-ups are on
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
     OR EXISTS (SELECT 1 FROM public.chat_meetings WHERE status = 'booked' AND confirm_sent_at IS NULL AND starts_at > now() AND starts_at <= now() + interval '60 minutes')
     OR EXISTS (SELECT 1 FROM public.chat_meetings WHERE status = 'booked' AND reminded_at IS NULL AND starts_at > now() AND starts_at <= now() + interval '15 minutes')
     OR (extract(minute FROM now())::int % 10 = 0 AND EXISTS (SELECT 1 FROM public.wa_bot_config WHERE nudge_enabled));
$job$);
