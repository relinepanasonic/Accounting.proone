-- ============================================================================
-- 1. FRICTIONLESS ADVANCED ACCOUNTING & INVOICE GENERATOR SAAS
-- 2. Bank Reconciliation Schema Migration (Numbered & Idempotent)
-- ============================================================================

-- ============================================================================
-- 3. ADD RECONCILIATION COLUMNS TO INVOICES TABLE
-- ============================================================================
ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS bank_reference TEXT;

-- ============================================================================
-- 4. ADD RECONCILIATION COLUMNS TO TRANSACTIONS TABLE (EXPENSES & BILLS)
-- ============================================================================
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS bank_reference TEXT;

-- ============================================================================
-- 5. PERFORMANCE INDEXES FOR RECONCILIATION FILTERING
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_reconciled ON public.invoices(workspace_id, reconciled);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled ON public.transactions(workspace_id, reconciled);
