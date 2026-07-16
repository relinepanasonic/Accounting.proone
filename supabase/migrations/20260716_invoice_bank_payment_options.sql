-- ==============================================================================
-- INVOICE & QUOTATION BANK PAYMENT OPTIONS SCHEMA MIGRATION
-- ==============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bank_account_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS bank_account_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
