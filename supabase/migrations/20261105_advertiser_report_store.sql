-- The Input Log is kept per STORE, not per client: one client can have several stores.
-- store_label is "Company - Store" (for example "ProOne - japarutomo"), the same text as in the Clients table and the performance feeds.
ALTER TABLE public.advertiser_reports ADD COLUMN IF NOT EXISTS store_label text NOT NULL DEFAULT '';

-- The old rule allowed one log per client, day and session. Drop it (any unique rule on this table except the primary key)...
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = 'advertiser_reports' AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.advertiser_reports DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT i.relname FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'advertiser_reports' AND x.indisunique AND NOT x.indisprimary
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.relname);
  END LOOP;
END $$;

-- ...and replace it: one log per client, store, day and session.
CREATE UNIQUE INDEX IF NOT EXISTS advertiser_reports_store_session_key ON public.advertiser_reports (client_id, store_label, report_date, session);

-- The logs made so far belong to the store that was linked to their client.
UPDATE public.advertiser_reports r
SET store_label = c.store_name
FROM public.clients c
WHERE r.client_id = c.id AND r.store_label = '' AND c.store_name ~ '^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-\s+\S';
