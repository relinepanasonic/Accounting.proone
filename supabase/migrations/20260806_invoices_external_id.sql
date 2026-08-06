-- Add external_id and source columns to invoices table for inbound sync from New Wave
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Create a unique index so upsert-on-(source, external_id) works
CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_external_id_idx
  ON public.invoices (source, external_id)
  WHERE source IS NOT NULL AND external_id IS NOT NULL;
