-- The salesman of a client that has no invoice yet (the Sales column of the Client table). With an invoice, the Sales of the invoice wins.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sales_name text;
