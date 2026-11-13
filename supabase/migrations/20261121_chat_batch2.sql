-- Chat dashboard, batch 2: labels on chats, follow-up reminders (also an ERP task), and images kept in our own storage.
-- Written by the app (service role); finance members can read.

CREATE TABLE IF NOT EXISTS public.chat_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_labels_name ON public.chat_labels (workspace_id, lower(name));

CREATE TABLE IF NOT EXISTS public.chat_label_links (
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.chat_labels(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_label_links_label ON public.chat_label_links (workspace_id, label_id);

CREATE TABLE IF NOT EXISTS public.chat_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    due_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    assigned_to UUID,
    assigned_name TEXT,
    created_by_name TEXT,
    done_at TIMESTAMPTZ,
    done_by TEXT,
    staff_task_id UUID REFERENCES public.staff_tasks(id) ON DELETE SET NULL,   -- the same follow-up in the ERP planner
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_reminders_open ON public.chat_reminders (workspace_id, done_at, due_at);
CREATE INDEX IF NOT EXISTS idx_chat_reminders_chat ON public.chat_reminders (group_id, due_at);

-- An image (or file) of a chat kept in our storage, bucket "wa-files": Fonnte's own links may not last.
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS media_path TEXT;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['chat_labels','chat_label_links','chat_reminders'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;
