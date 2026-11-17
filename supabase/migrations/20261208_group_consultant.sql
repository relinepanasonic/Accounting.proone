-- Fefe in marketplace WhatsApp groups: a group must be switched on by the team, and every answer is logged (never the members' numbers: only a one-way hash,
-- used for the "not the same person again" pause).
ALTER TABLE public.wa_groups ADD COLUMN IF NOT EXISTS fefe_active BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.fefe_group_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.wa_groups(id) ON DELETE CASCADE,
  sender_hash TEXT,
  question TEXT,
  reply TEXT,
  ok BOOLEAN NOT NULL DEFAULT false,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fefe_group_answers_group_time ON public.fefe_group_answers (group_id, created_at DESC);
ALTER TABLE public.fefe_group_answers ENABLE ROW LEVEL SECURITY;
