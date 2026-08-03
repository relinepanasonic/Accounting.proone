-- Add parent_code to global_chart_of_accounts
ALTER TABLE public.global_chart_of_accounts
ADD COLUMN IF NOT EXISTS parent_code TEXT REFERENCES public.global_chart_of_accounts(account_code) ON DELETE SET NULL;
