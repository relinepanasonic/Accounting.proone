-- Client table: the paid date is filled in by hand by Accounting (the ledger does not always know it).
-- Run in the Supabase SQL editor.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_paid_date DATE;
