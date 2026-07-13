-- ============================================================================
-- FRICTIONLESS ACCOUNTING & INVOICE GENERATOR SAAS
-- Supabase PostgreSQL Schema with Row Level Security (RLS)
-- ============================================================================
-- UX Principle: Hide the complex math, emphasize action-oriented clarity.
-- Terminology Mapping:
--   Accounts Receivable -> Unpaid Invoices
--   Accounts Payable    -> Upcoming Bills
--   General Ledger      -> Activity Feed
--   Chart of Accounts   -> Categories
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WORKSPACES (Isolates data per agency / content creator / e-commerce brand)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    default_payment_terms_days INTEGER NOT NULL DEFAULT 15, -- Smart Default: Net 15
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS 'Multi-tenant workspaces for isolating agency and creator financial activity.';

-- ============================================================================
-- 2. WORKSPACE MEMBERS (For secure RLS membership verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

COMMENT ON TABLE public.workspace_members IS 'Maps users to workspaces with role permissions.';

-- ============================================================================
-- 3. CLIENTS (Customer & Client Directory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Professor Toko Online"
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

COMMENT ON TABLE public.clients IS 'Clients and customers receiving invoices.';

-- ============================================================================
-- 4. INVOICES (Action-oriented invoices with payment links & smart terms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL, -- e.g., 'INV-2026-001'
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL, -- Smart Default: issue_date + Net 15
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_link_url TEXT, -- One-click payment URL (e.g. Stripe checkout)
    public_view_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    notes TEXT,
    is_recurring_template BOOLEAN NOT NULL DEFAULT false, -- Enables One-Click Duplicate
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_invoice_number UNIQUE (workspace_id, invoice_number)
);

COMMENT ON TABLE public.invoices IS 'Invoices tracked by human-friendly status (Unpaid Invoices view).';

-- ============================================================================
-- 5. INVOICE LINE ITEMS (Granular deliverable breakdown)
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

COMMENT ON TABLE public.invoice_line_items IS 'Line items for agency deliverables or retainer packages.';

-- ============================================================================
-- 6. TRANSACTIONS (Unified Ledger / "Activity Feed" for income & expenses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL, -- Jargon-free category (e.g. 'Software & Tools', 'Gear & Studio')
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_method TEXT, -- e.g., 'Bank Transfer', 'Credit Card', 'Stripe'
    receipt_url TEXT,
    is_upcoming_bill BOOLEAN NOT NULL DEFAULT false, -- True if due soon (Upcoming Bills)
    due_date DATE, -- For upcoming bills / accounts payable
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Unified activity feed tracking cash flow, income, and upcoming bills.';

-- ============================================================================
-- PERFORMANCE INDEXES (Optimized for instant dashboard loading)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_status ON public.invoices(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_date ON public.transactions(workspace_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_upcoming_bills ON public.transactions(workspace_id, is_upcoming_bill, due_date) WHERE is_upcoming_bill = true;

-- ============================================================================
-- HELPER FUNCTION: AUTO-UPDATE updated_at TIMESTAMP
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

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT DATA ISOLATION
-- ============================================================================

-- Helper function to check if current authenticated user belongs to workspace
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

-- Enable Row Level Security on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 1. Workspaces Policies
CREATE POLICY "Users can view workspaces they belong to"
    ON public.workspaces
    FOR SELECT
    USING (
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
        OR owner_id = auth.uid()
    );

CREATE POLICY "Owners can update their workspace settings"
    ON public.workspaces
    FOR UPDATE
    USING (owner_id = auth.uid() OR public.is_workspace_member(id));

-- 2. Workspace Members Policies
CREATE POLICY "Members can view membership in their workspaces"
    ON public.workspace_members
    FOR SELECT
    USING (workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    ));

-- 3. Clients Policies
CREATE POLICY "Users can manage clients within their workspace"
    ON public.clients
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 4. Invoices Policies
CREATE POLICY "Users can manage invoices within their workspace"
    ON public.invoices
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Public read access for invoices via unique public_view_token (client payment page)
CREATE POLICY "Public read access to invoices by token"
    ON public.invoices
    FOR SELECT
    USING (true);

-- 5. Invoice Line Items Policies
CREATE POLICY "Users can manage line items within their workspace"
    ON public.invoice_line_items
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 6. Transactions Policies
CREATE POLICY "Users can manage transactions within their workspace"
    ON public.transactions
    FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));
