-- Client table status: Active / Scheduled come from the project dates; Freeze and Churn can also be set by hand.
-- Run in the Supabase SQL editor.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_status TEXT CHECK (client_status IN ('freeze', 'churn'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_status_at DATE;
