-- Kampus Online workshop schedule, managed from Sales > Workshops in the ERP (sales, superadmins, founder) and read by the public
-- marketing site (profesoronline.id/kampus/ and /kampus/workshop/) with the anon key.
-- Only published events are visible to the public; nothing sensitive is stored here (it is the same info shown on the landing page).
-- Run in the Supabase SQL editor of the ERP project (htokejxhuwodgxlmadpr). Idempotent.

BEGIN;

-- Who may manage workshops (a sales jobdesk): the founder, or a superadmin or sales member of any workspace. SECURITY DEFINER so the policy can read
-- workspace_members without recursing into its own row rules.
CREATE OR REPLACE FUNCTION public.can_manage_workshops()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.is_founder() OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.role IN ('superadmin', 'sales')
      AND (wm.user_id = auth.uid()
           OR (wm.email IS NOT NULL AND lower(wm.email) = lower(auth.jwt() ->> 'email')))
  );
$$;

CREATE TABLE IF NOT EXISTS public.workshop_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    mode        TEXT NOT NULL DEFAULT 'online' CHECK (mode IN ('offline', 'online')),
    place       TEXT NOT NULL DEFAULT '',
    address     TEXT NOT NULL DEFAULT '',
    city        TEXT NOT NULL DEFAULT '',
    seats_total INT  NOT NULL DEFAULT 30 CHECK (seats_total > 0),
    seats_taken INT  NOT NULL DEFAULT 0  CHECK (seats_taken >= 0),
    published   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workshop_events_starts_idx ON public.workshop_events (starts_at);

ALTER TABLE public.workshop_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workshop_events_public_read ON public.workshop_events;
CREATE POLICY workshop_events_public_read ON public.workshop_events
  FOR SELECT TO anon, authenticated USING (published);

DROP POLICY IF EXISTS workshop_events_manage ON public.workshop_events;
CREATE POLICY workshop_events_manage ON public.workshop_events
  FOR ALL TO authenticated
  USING ((SELECT public.can_manage_workshops()))
  WITH CHECK ((SELECT public.can_manage_workshops()));

GRANT SELECT ON public.workshop_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_events TO authenticated;

-- First event: the 21 Nov 2026 batch (12:00 WIB), online. Only when the table is empty.
INSERT INTO public.workshop_events (title, starts_at, mode, seats_total, seats_taken)
SELECT 'Kampus Online: Bosan Boncos, Belajar untuk Cuan', '2026-11-21T12:00:00+07:00', 'online', 30, 20
WHERE NOT EXISTS (SELECT 1 FROM public.workshop_events);

COMMIT;

NOTIFY pgrst, 'reload config';
