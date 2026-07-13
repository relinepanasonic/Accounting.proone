-- ============================================================================
-- 1. FRICTIONLESS ADVANCED ACCOUNTING & INVOICE GENERATOR SAAS
-- 2. 100% Bulletproof & Idempotent Seed Script for New Wave Agency
-- ============================================================================
-- NOTE ON AUTH.USERS:
-- To prevent Foreign Key constraint errors ("violates foreign key constraint workspaces_owner_id_fkey"),
-- seed records use NULL for owner_id/user_id so this script runs cleanly on ANY Supabase project!
-- ============================================================================

DO $$
DECLARE
    ws_id UUID := '11111111-1111-1111-1111-111111111111';
    client_prof_id UUID := '22222222-2222-2222-2222-222222222201';
    client_numan_id UUID := '22222222-2222-2222-2222-222222222202';
    inv_1_id UUID := '33333333-3333-3333-3333-333333333301';
    je_salary_id UUID := '44444444-4444-4444-4444-444444444401';
    je_camera_id UUID := '44444444-4444-4444-4444-444444444402';
BEGIN
    -- ========================================================================
    -- 3. IDEMPOTENT CLEANUP (Safe to run multiple times without duplicate slug errors)
    -- ========================================================================
    DELETE FROM public.journal_entry_lines WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.journal_entries WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.fixed_assets WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.payroll WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.transactions WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.invoice_line_items WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.invoices WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.clients WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.workspace_members WHERE workspace_id = '11111111-1111-1111-1111-111111111111' OR workspace_id IN (SELECT id FROM public.workspaces WHERE slug = 'new-wave-agency');
    DELETE FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111' OR slug = 'new-wave-agency';

    -- ========================================================================
    -- 4. WORKSPACE: New Wave Agency (owner_id = NULL to prevent auth.users FK error)
    -- ========================================================================
    INSERT INTO public.workspaces (id, name, slug, currency, default_payment_terms_days, owner_id)
    VALUES (
        ws_id,
        'New Wave Agency',
        'new-wave-agency',
        'USD',
        15,
        NULL
    );

    -- ========================================================================
    -- 5. RBAC USERS (3 Tiers: superadmin, accounting, admin)
    -- ========================================================================
    INSERT INTO public.workspace_members (workspace_id, user_id, email, display_name, role)
    VALUES
        (ws_id, NULL, 'owner@newwave.agency', 'Elena Vance (Agency Founder)', 'superadmin'),
        (ws_id, NULL, 'finance@newwave.agency', 'Marcus Sterling (Finance Lead)', 'accounting'),
        (ws_id, NULL, 'studio@newwave.agency', 'Chloe Chen (Studio Manager)', 'admin');

    -- ========================================================================
    -- 6. CLIENTS
    -- ========================================================================
    INSERT INTO public.clients (id, workspace_id, name, contact_name, email, company_name)
    VALUES
        (client_prof_id, ws_id, 'Prof Toko Online', 'Budi Santoso', 'budi@proftoko.id', 'Prof Toko Online ID'),
        (client_numan_id, ws_id, 'Nüman Kitchenware', 'Sarah Jenkins', 'sarah@numan.co', 'Nüman Global');

    -- ========================================================================
    -- 7. INVOICES & LINE ITEMS
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
    -- 8. PAYROLL MODULE (Team Salaries & Bonuses)
    -- ========================================================================
    INSERT INTO public.payroll (
        workspace_id, employee_name, role_title, department, base_salary, bonus_amount, pay_period_start, pay_period_end, payment_date, status
    ) VALUES
        (ws_id, 'Ariana Chen', 'Live-stream Host', 'Production', 4500.00, 750.00, '2026-06-01', '2026-06-30', '2026-06-30', 'paid'),
        (ws_id, 'Damon Vance', 'Video Editor', 'Creative', 5200.00, 300.00, '2026-06-01', '2026-06-30', '2026-06-30', 'paid'),
        (ws_id, 'Sophia Martinez', 'E-commerce Manager', 'Growth', 6100.00, 1200.00, '2026-06-01', '2026-06-30', '2026-06-30', 'paid'),
        (ws_id, 'Lucas Sterling', 'Live-stream Host (Part-time)', 'Production', 3100.00, 200.00, '2026-07-01', '2026-07-31', '2026-07-31', 'draft');

    -- ========================================================================
    -- 9. FIXED ASSETS MODULE (High-Value Equipment)
    -- ========================================================================
    INSERT INTO public.fixed_assets (
        workspace_id, asset_name, asset_tag, category, purchase_date, initial_value, salvage_value, useful_life_years, status
    ) VALUES
        (ws_id, '4K Studio Cameras (Sony FX6 Dual Kit)', 'FA-CAM-001', 'Studio Equipment', '2026-01-15', 18500.00, 2500.00, 4, 'active'),
        (ws_id, 'Professional Ring Light & Softbox Rig', 'FA-LGT-002', 'Studio Lighting', '2026-02-10', 4200.00, 400.00, 3, 'active'),
        (ws_id, 'Editing Workstations (Apple Mac Studio M3 Ultra x2)', 'FA-COMP-003', 'Computing Hardware', '2026-03-01', 12400.00, 1400.00, 3, 'active');

    -- ========================================================================
    -- 10. ACTIVITY LEDGER MODULE
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

    INSERT INTO public.journal_entries (id, workspace_id, entry_number, entry_date, description, source_type)
    VALUES (
        je_camera_id,
        ws_id,
        'JE-2026-015',
        '2026-01-15',
        'Acquisition of Sony FX6 Dual Studio Camera Kit',
        'fixed_asset'
    );

    INSERT INTO public.journal_entry_lines (workspace_id, journal_entry_id, account_name, account_code, debit_amount, credit_amount)
    VALUES
        (ws_id, je_camera_id, 'Studio Equipment (Capital Asset)', '1510', 18500.00, 0.00),
        (ws_id, je_camera_id, 'Operating Cash Account', '1010', 0.00, 18500.00);

    RAISE NOTICE 'New Wave Agency seed data successfully populated!';
END $$;
