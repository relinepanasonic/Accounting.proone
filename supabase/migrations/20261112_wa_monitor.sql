-- WA Monitor: capture WhatsApp (Fonnte) group + private chats, daily AI reports, extracted tasks.
-- Run in the Supabase SQL editor (safe to run twice). Writes go through the app (service role); RLS lets
-- finance members (founder / superadmin / accounting / admin) read. Chats are private: no other role can read.

BEGIN;

-- 1. Connected Fonnte devices ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,                       -- device number, digits only (e.g. 628972341717)
    label TEXT,
    webhook_secret TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),  -- goes in the webhook URL
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, phone)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_devices_secret ON public.wa_devices (webhook_secret);

-- 2. Groups (and private chats, is_group = false) ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.wa_devices(id) ON DELETE SET NULL,
    wa_id TEXT NOT NULL,                       -- Fonnte "sender": group id or the contact number
    name TEXT,
    is_group BOOLEAN NOT NULL DEFAULT true,
    tracked BOOLEAN NOT NULL DEFAULT true,     -- untick to stop reporting on a group (messages still stored)
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, wa_id)
);

-- 3. People: a WhatsApp number mapped to an ERP user / employee --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    display_name TEXT,
    user_id UUID,                              -- ERP user (auth.users id), when known
    is_team BOOLEAN NOT NULL DEFAULT false,    -- true = our staff (used for response-time + "who has not replied")
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, phone)
);

-- 4. Messages ----------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    sender_phone TEXT,                         -- the real author (Fonnte "member" in groups, "sender" in private chats)
    sender_name TEXT,
    body TEXT,
    media_type TEXT,                           -- image | video | audio | document | location | poll | null
    media_url TEXT,
    media_filename TEXT,
    is_from_me BOOLEAN NOT NULL DEFAULT false, -- sent by the connected device itself
    external_id TEXT,                          -- Fonnte inboxid, when present (dedupe)
    dedupe_key TEXT NOT NULL,                  -- sha256 of device+group+sender+body+minute when no external id
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw JSONB,                                 -- full webhook payload, for debugging new Fonnte fields
    source TEXT NOT NULL DEFAULT 'webhook',    -- webhook | make-import
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_group_time ON public.wa_messages (workspace_id, group_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_time ON public.wa_messages (workspace_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_sender ON public.wa_messages (workspace_id, sender_phone, sent_at DESC);

-- 5. AI reports (one per group per day, plus an "all groups" row with group_id NULL) ------------------------------
CREATE TABLE IF NOT EXISTS public.wa_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,                 -- Jakarta day the report covers
    message_count INT NOT NULL DEFAULT 0,
    summary TEXT NOT NULL,
    model TEXT,
    sent_to TEXT[],                            -- emails / numbers the report was delivered to
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_reports_day ON public.wa_reports (workspace_id, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid), report_date);

-- 6. Action items the AI pulled out of chats ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE SET NULL,
    report_id UUID REFERENCES public.wa_reports(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    detail TEXT,
    owner_phone TEXT,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
    staff_task_id UUID REFERENCES public.staff_tasks(id) ON DELETE SET NULL,  -- set once converted to an ERP task
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_action_items_open ON public.wa_action_items (workspace_id, status, created_at DESC);

-- 7. Row rules: read for finance members only; everything is written by the app (service role) --------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_devices','wa_groups','wa_members','wa_messages','wa_reports','wa_action_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;

-- The webhook secret is a credential: no client role may read it, even a finance member.
REVOKE SELECT ON public.wa_devices FROM anon, authenticated;
GRANT SELECT (id, workspace_id, phone, label, active, created_at) ON public.wa_devices TO authenticated;

COMMIT;
