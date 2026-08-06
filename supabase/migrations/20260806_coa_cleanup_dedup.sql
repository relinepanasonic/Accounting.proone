-- COA Cleanup: Rename, deduplicate, and clarify account names
-- Run: 2026-08-06

-- 1. Rename 1201 "Office Equipment" → "Equipment" 
--    (to avoid duplication with the original Fixed Assets 1500 / similar naming)
UPDATE public.global_chart_of_accounts
SET account_name = 'Equipment', description = 'Fixed assets: office equipment, machinery, tools, and appliances (e.g. fridges, computers, printers)', updated_at = NOW()
WHERE account_code = '1201';

-- 2. Rename generic "Fixed Assets" (1500) to be more specific → "Property & Vehicles"
--    so it doesn't conflict with "Equipment" (1201)
UPDATE public.global_chart_of_accounts
SET account_name = 'Property & Vehicles', description = 'Long-term assets: property, land, and company vehicles', updated_at = NOW()
WHERE account_code = '1500';

-- 3. Rename "Accounts Receivable" (1200) to avoid confusion with the AR number range (12xx = Fixed Assets)
--    Move it to 1100 if 1100 doesn't exist yet, or just rename it to be crystal clear
UPDATE public.global_chart_of_accounts
SET account_name = 'Accounts Receivable (A/R)', description = 'Money owed by customers for goods/services provided', updated_at = NOW()
WHERE account_code = '1200';

-- 4. Rename "Bank Fees" 6100 → "Bank Charges & Fees"
--    (avoids future confusion with Depreciation Expense 6900 range)
UPDATE public.global_chart_of_accounts
SET account_name = 'Bank Charges & Fees', updated_at = NOW()
WHERE account_code = '6100';

-- 5. If there is a duplicate account named "Depreciation Expense" with a different code from 6900, remove it
--    (6900 is the correct one seeded)
DELETE FROM public.global_chart_of_accounts
WHERE account_name ILIKE '%Depreciation%' AND account_code != '6900';

-- 6. Rename 1202 (Accumulated Depreciation if it exists) to a clear name
UPDATE public.global_chart_of_accounts
SET account_name = 'Accumulated Depreciation', description = 'Contra-asset: total accumulated depreciation charged against fixed assets', updated_at = NOW()
WHERE account_code = '1202';

-- 7. Rename "Cash & Cash Equivalents" 1000 to be clearer
UPDATE public.global_chart_of_accounts
SET account_name = 'Cash & Cash Equivalents', updated_at = NOW()
WHERE account_code = '1000';

-- 8. Remove any exact duplicate account_names (keep lowest account_code, delete the rest)
DELETE FROM public.global_chart_of_accounts a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (LOWER(account_name)) id
  FROM public.global_chart_of_accounts
  ORDER BY LOWER(account_name), account_code ASC
);
