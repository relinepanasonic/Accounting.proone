-- Buku Bank: keep the balance (Saldo) and the time of each statement line. The balance of the last line of a period is the
-- opening balance of the next one. Run in the Supabase SQL editor (safe to run more than once).
ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS balance numeric,
  ADD COLUMN IF NOT EXISTS txn_time text,
  ADD COLUMN IF NOT EXISTS bank_ref text;
