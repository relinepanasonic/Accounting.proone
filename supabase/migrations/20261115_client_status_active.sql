-- Status "Active" can be picked by hand (a finished project whose client is running again).
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_status_check CHECK (client_status IN ('freeze', 'churn', 'finished', 'active'));
