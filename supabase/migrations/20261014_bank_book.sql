-- Buku Bank: every uploaded bank statement line is kept (page /bank-book), per bank account. Run in the Supabase SQL editor.
-- bank_statement_lines already exists; it gets the columns of the statement feed and a fingerprint so that
-- uploading an overlapping statement twice does not store the same line twice.
ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS rek_from text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_lines_fp ON public.bank_statement_lines (bank_account_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_ws_date ON public.bank_statement_lines (workspace_id, date DESC);
