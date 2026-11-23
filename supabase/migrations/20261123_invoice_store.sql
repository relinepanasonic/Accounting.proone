-- The store an invoice is for ("Company - Store"), for a client that has several stores.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS store_label text;
