-- Sales number: a role per WhatsApp number, and the warm first-reply bot (settings, per-chat state, log).
-- Safe to run twice. Written by the app (service role); finance members can read.

ALTER TABLE public.wa_devices ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'sales'));

-- One row per company. The bot is OFF until "enabled" is turned on.
CREATE TABLE IF NOT EXISTS public.wa_bot_config (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    persona_name TEXT NOT NULL DEFAULT 'Fefe',
    company_name TEXT NOT NULL DEFAULT 'Prof Toko Online',
    hours_from TEXT NOT NULL DEFAULT '08:00',            -- Jakarta time; outside it the bot says the team replies in the morning
    hours_to TEXT NOT NULL DEFAULT '21:00',
    max_replies INT NOT NULL DEFAULT 4 CHECK (max_replies BETWEEN 1 AND 10),   -- bot messages per chat, then a person takes over
    knowledge TEXT NOT NULL DEFAULT '',                   -- the FAQ / script the bot may answer from (edited in WA Control > Sales)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per private chat the bot has touched.
CREATE TABLE IF NOT EXISTS public.wa_bot_chats (
    group_id UUID PRIMARY KEY REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'bot' CHECK (status IN ('bot', 'human', 'off')),   -- human = a salesperson took over (or the bot handed over)
    replies INT NOT NULL DEFAULT 0,
    reason TEXT,                                          -- why it went to a person
    lead JSONB,                                           -- what the bot learned: name, store, need
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_bot_chats_status ON public.wa_bot_chats (workspace_id, status, updated_at DESC);

-- Everything the bot said, for review.
CREATE TABLE IF NOT EXISTS public.wa_bot_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    in_reply_to TEXT,
    reply TEXT,
    handoff BOOLEAN NOT NULL DEFAULT false,
    ok BOOLEAN NOT NULL DEFAULT true,
    detail TEXT,
    model TEXT,
    tokens_in INT,
    tokens_out INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_bot_log_chat ON public.wa_bot_log (workspace_id, group_id, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_bot_config','wa_bot_chats','wa_bot_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;

GRANT SELECT (id, workspace_id, phone, label, active, created_at, role) ON public.wa_devices TO authenticated;
