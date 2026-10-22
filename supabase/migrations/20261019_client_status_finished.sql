-- Client status: Finished (the project is done but the client is still with us). Churn stays for a client that left.
-- Run in the Supabase SQL editor (safe to run more than once).
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_status_check CHECK (client_status IN ('freeze', 'churn', 'finished'));
