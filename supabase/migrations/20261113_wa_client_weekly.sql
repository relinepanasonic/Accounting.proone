-- WA Control: the weekly summary Oli sends to each client's WhatsApp group, after an admin approves it.
-- Numbers come from the store performance feed of Dashboard Prof / Reline. A store is linked to the client's WhatsApp group;
-- the weekly job prepares one DRAFT per store; an admin checks it and presses Send. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.wa_store_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    store_label TEXT NOT NULL,                    -- "ProOne - Toko A" (workspace - store, as the performance feed names it)
    group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, store_label)            -- a store has one group; a group may serve several stores of one client
);

CREATE TABLE IF NOT EXISTS public.wa_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'client-weekly',
    store_label TEXT NOT NULL,
    client_name TEXT,
    group_id UUID REFERENCES public.wa_groups(id) ON DELETE SET NULL,   -- null = no group linked yet (cannot be sent)
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'skipped')),
    detail TEXT,                                  -- Fonnte's answer or the error
    prepared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    sent_by UUID,
    UNIQUE (workspace_id, kind, store_label, period_from)
);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_period ON public.wa_outbox (workspace_id, period_from DESC, status);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['wa_store_groups','wa_outbox'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS wa_finance_read ON public.%I', t);
    EXECUTE format('CREATE POLICY wa_finance_read ON public.%I FOR SELECT USING (public.is_finance_member(workspace_id))', t);
  END LOOP;
END $$;
