-- Remove the duplicate ledger postings of expenses.
-- 194 expense transactions are posted twice in the ledger: the real posting (reference_type 'quick_expense', credit to the bank account)
-- and a second one (reference_type 'expense', credit to 2000) created later by the ledger repair of 15 to 21 October. The second one
-- doubles the cost (and the 2000 liability). Only the second posting is removed, and only where the quick_expense lines already balance
-- the whole transaction. Run the three steps in the Supabase SQL editor, one after the other.

-- STEP 1: backup of what will be removed (a table you can restore from).
CREATE TABLE IF NOT EXISTS public.journal_entries_backup_20261024 AS
SELECT j.*
FROM public.journal_entries j
JOIN public.transactions t ON t.id = j.reference_id AND t.type = 'expense'
JOIN (
  SELECT reference_id, SUM(debit_amount) AS d, SUM(credit_amount) AS c
  FROM public.journal_entries
  WHERE reference_type = 'quick_expense'
  GROUP BY reference_id
) q ON q.reference_id = j.reference_id AND ABS(q.d - t.amount) < 1 AND ABS(q.c - t.amount) < 1
WHERE j.reference_type = 'expense';

-- STEP 2: check. Expected: 388 rows, debit 331,348,931 and credit 331,348,931 (194 transactions).
SELECT COUNT(*) AS rows_to_remove, COUNT(DISTINCT reference_id) AS transactions, SUM(debit_amount) AS debit, SUM(credit_amount) AS credit
FROM public.journal_entries_backup_20261024;

-- STEP 3: remove them.
DELETE FROM public.journal_entries
WHERE id IN (SELECT id FROM public.journal_entries_backup_20261024);
