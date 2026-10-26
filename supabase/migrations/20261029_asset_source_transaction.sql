-- The main payment of a fixed asset (the expense line that bought it). The small monthly lines of its Schedule Expense follow the
-- reconcile state of that payment: when the payment is reconciled with the bank, all the monthly lines show as reconciled too.
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS source_transaction_id uuid;
