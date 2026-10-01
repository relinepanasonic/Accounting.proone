-- "Sisa Saldo Iklan" (remaining ad balance) per advertiser session.
-- Stored as the text the advertiser typed, e.g. 'Rp 561,981'. Run in the Supabase SQL editor.
ALTER TABLE public.advertiser_reports ADD COLUMN IF NOT EXISTS sisa_saldo_iklan TEXT;
