-- A question Fefe asked a team member and is waiting to have answered ("Apakah ini sama dengan client kita?"): the original message is kept, so the answer
-- lets her carry on with exactly what was asked. Valid for 30 minutes.
CREATE TABLE IF NOT EXISTS public.staff_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  phone_tail TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_pending_who ON public.staff_pending (workspace_id, phone_tail, created_at DESC);
ALTER TABLE public.staff_pending ENABLE ROW LEVEL SECURITY;
