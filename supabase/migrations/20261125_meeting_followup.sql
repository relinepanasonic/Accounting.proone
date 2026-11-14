-- Free consultations, before the meeting: a confirmation an hour before (YA / GANTI / BATAL), a reminder with the link 15 minutes before,
-- moving the meeting to another free time, and the meeting in the ERP's Meetings (lead_visits) under the salesperson who takes it.

ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS confirm_sent_at TIMESTAMPTZ;      -- the "1 jam lagi, masih bisa hadir?" message went out
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;         -- the lead answered YA
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS reschedule_offer JSONB;           -- the numbered free times offered after GANTI
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS reschedule_asked_at TIMESTAMPTZ;
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS owner_id UUID;                    -- the salesperson who takes the meeting
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS lead_visit_id UUID REFERENCES public.lead_visits(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.chat_meetings.reminded_at IS 'The 15-minute reminder with the Meet link went out.';

-- who takes consultations when the chat has nobody assigned
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_owner_id UUID;
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS meet_owner_name TEXT;

-- the once-a-minute clock also runs when a confirmation (1 hour before) or a reminder (15 minutes before) is due
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
     OR EXISTS (SELECT 1 FROM public.chat_meetings WHERE status = 'booked' AND reminded_at IS NULL AND starts_at > now() AND starts_at <= now() + interval '15 minutes');
$job$);
