-- Chat dashboard, batch 1: who handles a chat, open/resolved, internal notes, quick replies. Written by the app (service role); finance members can read.

CREATE TABLE IF NOT EXISTS public.chat_state (
    group_id UUID PRIMARY KEY REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    assigned_to UUID,                         -- ERP user (auth.users id) handling the chat
    assigned_name TEXT,
    resolved_at TIMESTAMPTZ,                  -- set when the chat is marked resolved; a new message from the lead reopens it (shown as open)
    resolved_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_state_assignee ON public.chat_state (workspace_id, assigned_to);

CREATE TABLE IF NOT EXISTS public.chat_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    author_id UUID,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_notes_group ON public.chat_notes (group_id, created_at);

CREATE TABLE IF NOT EXISTS public.chat_quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,                   -- typed after "/" in the dashboard, lower case, no spaces
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, shortcut)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_state','chat_notes','chat_quick_replies'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;
