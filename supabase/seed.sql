-- ============================================================================
-- 1. FRICTIONLESS ADVANCED ACCOUNTING & INVOICE GENERATOR SAAS
-- 2. Seed Script for Accounting.proone Linked to User UID: 850bedd6-eeaf-4d10-9532-a783379fca44
-- ============================================================================

-- ============================================================================
-- 3. SCHEMA & CHECK CONSTRAINT FIX (Ensures roles and columns match 3-Tier RBAC)
-- ============================================================================
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Drop any outdated role check constraint and apply the updated 3-Tier RBAC check
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check 
    CHECK (role IN ('superadmin', 'accounting', 'admin'));

DO $$
DECLARE
    -- Real Supabase Auth UID for professortokoonline@gmail.com
    ws_id UUID := '11111111-1111-1111-1111-111111111111';
    owner_uid UUID := '850bedd6-eeaf-4d10-9532-a783379fca44';
    
    client_prof_id UUID := '22222222-2222-2222-2222-222222222201';
    client_numan_id UUID := '22222222-2222-2222-2222-222222222202';
    inv_1_id UUID := '33333333-3333-3333-3333-333333333301';
    je_salary_id UUID := '44444444-4444-4444-4444-444444444401';
    je_camera_id UUID := '44444444-4444-4444-4444-444444444402';
BEGIN
    -- ========================================================================
    -- 4. IDEMPOTENT CLEANUP
    -- ========================================================================
    DELETE FROM public.journal_entry_lines WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.journal_entries WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.fixed_assets WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.payroll WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.transactions WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.invoice_line_items WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.invoices WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.clients WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.workspace_members WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug IN ('accounting-proone', 'new-wave-agency'));
    DELETE FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111' OR slug IN ('accounting-proone', 'new-wave-agency');

    -- ========================================================================
    -- 5. WORKSPACE: Accounting.proone
    -- ========================================================================
    INSERT INTO public.workspaces (id, name, slug, currency, default_payment_terms_days, owner_id)
    VALUES (
        ws_id,
        'Accounting.proone',
        'accounting-proone',
        'USD',
        15,
        owner_uid
    );

    -- ========================================================================
    -- 6. RBAC USERS (Your real UID is set as 'superadmin')
    -- ========================================================================
    INSERT INTO public.workspace_members (workspace_id, user_id, email, display_name, role)
    VALUES
        (ws_id, owner_uid, 'professortokoonline@gmail.com', 'Professor Toko Online (Superadmin Owner)', 'superadmin');

    -- ========================================================================
    -- 7. CLIENTS
    -- ========================================================================
    INSERT INTO public.clients (id, workspace_id, name, contact_name, email, company_name)
    VALUES
        (client_prof_id, ws_id, 'Prof Toko Online', 'Budi Santoso', 'budi@proftoko.id', 'Prof Toko Online ID'),
        (client_numan_id, ws_id, 'Nüman Kitchenware', 'Sarah Jenkins', 'sarah@numan.co', 'Nüman Global');

    -- ========================================================================
    -- 8. INVOICES & LINE ITEMS
    -- ========================================================================
    INSERT INTO public.invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, subtotal, total_amount)
    VALUES (
        inv_1_id,
        ws_id,
        client_prof_id,
        'INV-2026-001',
        'paid',
        '2026-07-01',
        '2026-07-16',
        149870.00,
        149870.00
    );

    INSERT INTO public.invoice_line_items (workspace_id, invoice_id, description, quantity, unit_price, sort_order)
    VALUES
        (ws_id, inv_1_id, 'TikTok Shop Live Production retainer (Month 1)', 1, 85000.00, 1),
        (ws_id, inv_1_id, 'Content Creator Ad Package (40 HD Reels)', 40, 1621.75, 2);

    -- ========================================================================
    -- 9. PAYROLL MODULE
    -- ========================================================================
    INSERT INTO public.payroll (
        workspace_id, employee_name, role_title, department, base_salary, bonus_amount, pay_period_start, pay_period_end, payment_date, status
    ) VALUES
        (ws_id, 'Ariana Chen', 'Live-stream Host', 'Production', 4500.00, 750.00, '2026-06-01', '2026-06-30', '2026-06-30', 'paid'),
        (ws_id, 'Damon Vance', 'Video Editor', 'Creative', 5200.00, 300.00, '2026-06-01', '2026-06-30', '2026-06-30', 'paid');

    -- ========================================================================
    -- 10. FIXED ASSETS MODULE
    -- ========================================================================
    INSERT INTO public.fixed_assets (
        workspace_id, asset_name, asset_tag, category, purchase_date, initial_value, salvage_value, useful_life_years, status
    ) VALUES
        (ws_id, '4K Studio Cameras (Sony FX6 Dual Kit)', 'FA-CAM-001', 'Studio Equipment', '2026-01-15', 18500.00, 2500.00, 4, 'active'),
        (ws_id, 'Editing Workstations (Apple Mac Studio M3 Ultra)', 'FA-COMP-003', 'Computing Hardware', '2026-03-01', 12400.00, 1400.00, 3, 'active');

    -- ========================================================================
    -- 11. ACTIVITY LEDGER MODULE
    -- ========================================================================
    INSERT INTO public.journal_entries (id, workspace_id, entry_number, entry_date, description, source_type)
    VALUES (
        je_salary_id,
        ws_id,
        'JE-2026-014',
        '2026-06-30',
        'June 2026 Production & Creative Payroll Disbursement',
        'payroll'
    );

    INSERT INTO public.journal_entry_lines (workspace_id, journal_entry_id, account_name, account_code, debit_amount, credit_amount)
    VALUES
        (ws_id, je_salary_id, 'Salaries & Wages Expense', '6010', 18050.00, 0.00),
        (ws_id, je_salary_id, 'Operating Cash Account', '1010', 0.00, 18050.00);

    RAISE NOTICE 'Accounting.proone seed data linked to Superadmin % successfully populated!', owner_uid;
END $$;
