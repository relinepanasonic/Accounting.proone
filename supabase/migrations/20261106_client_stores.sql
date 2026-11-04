-- The stores of a client: one client can have several. Each is "Company - Store" (company: ProOne, Reline, Alpha or Lighting Solution).
-- The server reads and writes this table (service role); no policy is added on purpose.
CREATE TABLE IF NOT EXISTS public.client_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company text NOT NULL,
  store text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, company, store)
);
ALTER TABLE public.client_stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS client_stores_client_idx ON public.client_stores (client_id);

-- The store that was linked to each client so far becomes its first store.
INSERT INTO public.client_stores (workspace_id, client_id, company, store)
SELECT c.workspace_id, c.id,
  CASE lower(m[1]) WHEN 'proone' THEN 'ProOne' WHEN 'reline' THEN 'Reline' WHEN 'alpha' THEN 'Alpha' ELSE 'Lighting Solution' END,
  btrim(m[2])
FROM public.clients c, LATERAL regexp_match(c.store_name, '^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-\s+(\S.*)$', 'i') AS m
WHERE c.store_name IS NOT NULL AND m IS NOT NULL -- only the ones that have a company and a store ("ProOne -" alone is skipped)
ON CONFLICT DO NOTHING;
