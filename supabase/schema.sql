-- ============================================================================
-- FRICTIONLESS ADVANCED ACCOUNTING & INVOICE GENERATOR SAAS
-- Complete Supabase PostgreSQL Schema with RBAC & Advanced Accounting Modules
-- ============================================================================
-- Modules Included:
--   1. Workspaces & RBAC ('superadmin', 'accounting', 'admin')
--   2. Clients & Customers
--   3. Action-Oriented Invoices & Line Items
--   4. Transactions (Unified Cash Flow Activity Feed)
--   5. Payroll (Team Salaries & Bonuses - Restricted to Superadmin/Accounting)
--   6. Fixed Assets (Equipment & Straight-Line Depreciation)
--   7. Activity Ledger (Double-Entry Journal Entries & Lines)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WORKSPACES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 15,
    is_tax_registered BOOLEAN DEFAULT false,
    tax_rate_percent NUMERIC DEFAULT 11,
    company_logo_url TEXT,
    logo_url TEXT,
    brand_tagline TEXT,
    tagline TEXT,
    contact_phone TEXT,
    phone TEXT,
    official_email TEXT,
    email TEXT,
    website_url TEXT,
    website TEXT,
    payment_instructions TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS 'Multi-tenant workspaces isolating agency financial activity.';

-- ============================================================================
-- 2. WORKSPACE MEMBERS (RBAC: 'superadmin', 'accounting', 'admin')
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT, -- For seed / invite reference
    display_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'accounting', 'admin')) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

COMMENT ON TABLE public.workspace_members IS 'RBAC roles: superadmin (full access), accounting (finance modules), admin (ops invoices/bills).';

-- ============================================================================
-- 3. CLIENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    billing_address TEXT,
    preferred_currency TEXT DEFAULT 'USD',
    default_payment_terms_days INTEGER DEFAULT 15,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. INVOICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_link_url TEXT,
    public_view_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    notes TEXT,
    is_recurring_template BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_invoice_number UNIQUE (workspace_id, invoice_number)
);

-- ============================================================================
-- 5. INVOICE LINE ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. TRANSACTIONS (Unified Cash Flow Activity Feed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_method TEXT,
    receipt_url TEXT,
    is_upcoming_bill BOOLEAN NOT NULL DEFAULT false,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. PAYROLL MODULE (Restricted: superadmin & accounting ONLY)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    role_title TEXT NOT NULL, -- e.g. "Live-stream Host", "Video Editor"
    department TEXT DEFAULT 'Production',
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    bonus_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment NUMERIC(12, 2) GENERATED ALWAYS AS (base_salary + bonus_amount) STORED,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'paid')) DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll IS 'Team salaries and bonuses. Access restricted to superadmin and accounting roles.';

-- ============================================================================
-- 8. FIXED ASSETS MODULE (Equipment & Straight-Line Depreciation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL, -- e.g. "4K Studio Cameras"
    asset_tag TEXT,
    category TEXT NOT NULL DEFAULT 'Studio Equipment',
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    initial_value NUMERIC(12, 2) NOT NULL CHECK (initial_value >= 0),
    salvage_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    useful_life_years INTEGER NOT NULL DEFAULT 3 CHECK (useful_life_years > 0),
    annual_depreciation NUMERIC(12, 2) GENERATED ALWAYS AS (
        CASE WHEN useful_life_years > 0 THEN (initial_value - salvage_value) / useful_life_years ELSE 0 END
    ) STORED,
    status TEXT NOT NULL CHECK (status IN ('active', 'fully_depreciated', 'disposed')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fixed_assets IS 'Agency capital assets with straight-line depreciation.';

-- ============================================================================
-- 9. ACTIVITY LEDGER (Double-Entry Journal Entries Backbone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL, -- e.g. "JE-2026-001"
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('invoice', 'transaction', 'payroll', 'fixed_asset', 'manual')),
    source_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL, -- Human-centric account (e.g., "Cash", "Salaries Expense", "Equipment")
    account_code TEXT, -- Optional GAAP code
    debit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0) OR
        (debit_amount = 0 AND credit_amount = 0)
    )
);

COMMENT ON TABLE public.journal_entries IS 'Invisible double-entry general ledger tracking every debit/credit event.';

-- ============================================================================
-- HIGH-PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_composite ON public.workspace_members(workspace_id, user_id, role);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status ON public.invoices(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_workspace_status ON public.payroll(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_workspace ON public.fixed_assets(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_workspace ON public.journal_entries(workspace_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);

-- ============================================================================
-- AUTO-UPDATE TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payroll_updated_at ON public.payroll;
CREATE TRIGGER trg_payroll_updated_at
    BEFORE UPDATE ON public.payroll
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fixed_assets_updated_at ON public.fixed_assets;
CREATE TRIGGER trg_fixed_assets_updated_at
    BEFORE UPDATE ON public.fixed_assets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PERFORMANT RBAC SECURITY DEFINER FUNCTIONS & RLS POLICIES
-- ============================================================================

-- Check if current authenticated user belongs to workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id = auth.uid()
    );
$$;

-- Check if user has specific RBAC role(s) in workspace
CREATE OR REPLACE FUNCTION public.has_workspace_role(target_workspace_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role = ANY(allowed_roles)
    );
$$;

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- 1. WORKSPACE POLICIES
DROP POLICY IF EXISTS "Users view their workspaces" ON public.workspaces;
CREATE POLICY "Users view their workspaces"
    ON public.workspaces FOR SELECT
    USING (public.is_workspace_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Only superadmin can delete workspaces" ON public.workspaces;
CREATE POLICY "Only superadmin can delete workspaces"
    ON public.workspaces FOR DELETE
    USING (public.has_workspace_role(id, ARRAY['superadmin']));

-- 2. WORKSPACE MEMBERS POLICIES
DROP POLICY IF EXISTS "Members view teammates" ON public.workspace_members;
CREATE POLICY "Members view teammates"
    ON public.workspace_members FOR SELECT
    USING (public.is_workspace_member(workspace_id));

-- 3. CLIENTS, INVOICES, TRANSACTIONS (Accessible by superadmin, accounting, admin)
DROP POLICY IF EXISTS "General modules read/write access" ON public.clients;
CREATE POLICY "General modules read/write access"
    ON public.clients FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Invoices read/write access" ON public.invoices;
CREATE POLICY "Invoices read/write access"
    ON public.invoices FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Public invoice view token access" ON public.invoices;
CREATE POLICY "Public invoice view token access"
    ON public.invoices FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Transactions read/write access" ON public.transactions;
CREATE POLICY "Transactions read/write access"
    ON public.transactions FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 4. PAYROLL POLICIES (RBAC GUARDRAIL: ONLY 'superadmin' & 'accounting' can access)
DROP POLICY IF EXISTS "RBAC Payroll superadmin and accounting access" ON public.payroll;
CREATE POLICY "RBAC Payroll superadmin and accounting access"
    ON public.payroll FOR ALL
    USING (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']))
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']));

-- 5. FIXED ASSETS POLICIES
DROP POLICY IF EXISTS "Fixed assets read/write access" ON public.fixed_assets;
CREATE POLICY "Fixed assets read/write access"
    ON public.fixed_assets FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 6. ACTIVITY LEDGER POLICIES (RBAC GUARDRAIL: ONLY 'superadmin' & 'accounting' can alter)
DROP POLICY IF EXISTS "Ledger read access for members" ON public.journal_entries;
CREATE POLICY "Ledger read access for members"
    ON public.journal_entries FOR SELECT
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Ledger alter access for superadmin and accounting" ON public.journal_entries;
CREATE POLICY "Ledger alter access for superadmin and accounting"
    ON public.journal_entries FOR ALL
    USING (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']))
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']));

DROP POLICY IF EXISTS "Ledger lines read access" ON public.journal_entry_lines;
CREATE POLICY "Ledger lines read access"
    ON public.journal_entry_lines FOR SELECT
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Ledger lines alter access" ON public.journal_entry_lines;
CREATE POLICY "Ledger lines alter access"
    ON public.journal_entry_lines FOR ALL
    USING (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']))
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'accounting']));

-- ==========================================
-- 8. WORKSPACE BANK ACCOUNTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.workspace_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspace_bank_accounts_workspace_id ON public.workspace_bank_accounts(workspace_id);

DROP POLICY IF EXISTS "Workspace bank accounts read/write access" ON public.workspace_bank_accounts;
CREATE POLICY "Workspace bank accounts read/write access"
    ON public.workspace_bank_accounts FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

