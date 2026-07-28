-- Run this in your Supabase SQL Editor
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS is_quotation BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bank_account_id TEXT,
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
