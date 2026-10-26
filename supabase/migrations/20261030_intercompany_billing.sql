-- Back-to-back invoicing: PT Pintu invoices the client, New Wave invoices PT PLIG for the DPP of that invoice, PT books the same amount as cost (COA 5050).
-- invoices.intercompany_of: on the New Wave invoice, the PT invoice it bills for.
-- invoices.intercompany_invoice_id: on the PT invoice, the New Wave invoice made for it (so the PT invoice counts as PT's own revenue).
-- transactions.intercompany_of: on PT's cost line, the PT invoice it pays for.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS intercompany_of uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS intercompany_invoice_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS intercompany_of uuid;
CREATE INDEX IF NOT EXISTS invoices_intercompany_of_idx ON public.invoices (intercompany_of) WHERE intercompany_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_intercompany_invoice_idx ON public.invoices (intercompany_invoice_id) WHERE intercompany_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_intercompany_of_idx ON public.transactions (intercompany_of) WHERE intercompany_of IS NOT NULL;
