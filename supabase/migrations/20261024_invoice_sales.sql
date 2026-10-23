-- Sales column of the Client table: who sold this project. Set by hand (Optimizing > Clients); without it the salesman of the pipeline card is shown.
-- Run in the Supabase SQL editor.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sales_name TEXT;
