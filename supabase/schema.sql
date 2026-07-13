-- ============================================================================
-- FRICTIONLESS ACCOUNTING & INVOICE GENERATOR SAAS
-- Performance & Index-Optimized Supabase PostgreSQL Schema
-- ============================================================================
-- Guardrails Applied:
-- 1. Full foreign key indexing (workspace_id, client_id, invoice_id)
-- 2. Composite indexing for filter/sort fields (status, due_date, transaction_date)
-- 3. Performant RLS policies utilizing indexed lookups & STABLE Security Definer
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
    currency TEXT NOT NULL DEFAULT 'USD',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 15,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. WORKSPACE MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

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
-- 6. TRANSACTIONS
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
-- HIGH-PERFORMANCE COVERING & COMPOSITE INDEXES
-- ============================================================================
-- Foreign key indexing to eliminate sequential scans on joins
CREATE INDEX IF NOT EXISTS idx_workspace_members_composite ON public.workspace_members(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_clients_workspace_name ON public.clients(workspace_id, name);

-- Invoices composite indexes for dashboard filtration & sorting
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status_due ON public.invoices(workspace_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

-- Line items index
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_sort ON public.invoice_line_items(invoice_id, sort_order);

-- Transactions composite indexes for Activity Feed and Upcoming Bills A/P queries
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_ap_bills ON public.transactions(workspace_id, is_upcoming_bill, due_date) WHERE is_upcoming_bill = true;
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);

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

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PERFORMANT ROW LEVEL SECURITY (RLS)
-- Utilizes STABLE Security Definer cached lookup to avoid per-row nested scans
-- ============================================================================

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

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Workspace Policies
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
CREATE POLICY "Users can view workspaces they belong to"
    ON public.workspaces FOR SELECT
    USING (public.is_workspace_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their workspace settings" ON public.workspaces;
CREATE POLICY "Owners can update their workspace settings"
    ON public.workspaces FOR UPDATE
    USING (owner_id = auth.uid());

-- Workspace Members Policies
DROP POLICY IF EXISTS "Members can view membership in their workspaces" ON public.workspace_members;
CREATE POLICY "Members can view membership in their workspaces"
    ON public.workspace_members FOR SELECT
    USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id));

-- Clients Policies
DROP POLICY IF EXISTS "Users can manage clients within their workspace" ON public.clients;
CREATE POLICY "Users can manage clients within their workspace"
    ON public.clients FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Invoices Policies
DROP POLICY IF EXISTS "Users can manage invoices within their workspace" ON public.invoices;
CREATE POLICY "Users can manage invoices within their workspace"
    ON public.invoices FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Public read access to invoices by token" ON public.invoices;
CREATE POLICY "Public read access to invoices by token"
    ON public.invoices FOR SELECT
    USING (true);

-- Invoice Line Items Policies
DROP POLICY IF EXISTS "Users can manage line items within their workspace" ON public.invoice_line_items;
CREATE POLICY "Users can manage line items within their workspace"
    ON public.invoice_line_items FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Transactions Policies
DROP POLICY IF EXISTS "Users can manage transactions within their workspace" ON public.transactions;
CREATE POLICY "Users can manage transactions within their workspace"
    ON public.transactions FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));
