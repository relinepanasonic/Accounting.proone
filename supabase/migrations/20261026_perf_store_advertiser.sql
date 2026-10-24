-- Advertiser Dashboard: which advertiser handles a store (Profesor Dashboard) or a dealer (Reline) that cannot be matched automatically
-- through the Clients table (client store name + the advertiser assigned to that client). Set from the Store Detail table. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.perf_store_advertiser (
  store_key     TEXT PRIMARY KEY,              -- "dashboard:<store>" or "reline:<dealer>|<workspace>"
  advertiser_id UUID NOT NULL,                 -- profiles.id of the advertiser
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Read and written only by the server (service role).
ALTER TABLE public.perf_store_advertiser ENABLE ROW LEVEL SECURITY;
