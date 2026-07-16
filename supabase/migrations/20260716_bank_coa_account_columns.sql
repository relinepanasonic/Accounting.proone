-- Migration to add coa_account_code and coa_account_name columns to workspace_bank_accounts
ALTER TABLE public.workspace_bank_accounts 
ADD COLUMN IF NOT EXISTS coa_account_code TEXT DEFAULT '1010',
ADD COLUMN IF NOT EXISTS coa_account_name TEXT DEFAULT 'Operating Cash Account';
