-- ============================================================================
-- FRICTIONLESS ACCOUNTING & INVOICE GENERATOR SAAS - INITIAL SEED SCRIPT
-- ============================================================================
-- Populates database with realistic dummy data for "New Wave Agency"
-- (Digital Marketing & Live-Streaming Agency)
-- ============================================================================

DO $$
DECLARE
    v_workspace_id UUID := gen_random_uuid();
    v_client_toko_id UUID := gen_random_uuid();
    v_client_numan_id UUID := gen_random_uuid();
    v_client_niko_id UUID := gen_random_uuid();
    v_invoice_1_id UUID := gen_random_uuid();
    v_invoice_2_id UUID := gen_random_uuid();
    v_invoice_3_id UUID := gen_random_uuid();
BEGIN
    -- ========================================================================
    -- 1. WORKSPACE: "New Wave Agency"
    -- ========================================================================
    INSERT INTO public.workspaces (id, name, slug, currency, default_payment_terms_days)
    VALUES (
        v_workspace_id,
        'New Wave Agency',
        'new-wave-agency',
        'USD',
        15 -- Smart default: Net 15
    );

    -- ========================================================================
    -- 2. CLIENTS
    -- ========================================================================
    -- Client A: Professor Toko Online
    INSERT INTO public.clients (id, workspace_id, name, contact_name, email, company_name, default_payment_terms_days, notes)
    VALUES (
        v_client_toko_id,
        v_workspace_id,
        'Professor Toko Online',
        'Dr. Kenji Sato',
        'billing@professortoko.online',
        'Professor Toko Online LLC',
        15,
        'Monthly e-commerce content & TikTok scripts retainer.'
    );

    -- Client B: Nüman Kitchenware
    INSERT INTO public.clients (id, workspace_id, name, contact_name, email, company_name, default_payment_terms_days, notes)
    VALUES (
        v_client_numan_id,
        v_workspace_id,
        'Nüman Kitchenware',
        'Elena Rostova',
        'accounts@numankitchenware.com',
        'Nüman Kitchenware Co.',
        15,
        'Live-stream shopping events & TikTok shop activation.'
    );

    -- Client C: Niko Elektronik
    INSERT INTO public.clients (id, workspace_id, name, contact_name, email, company_name, default_payment_terms_days, notes)
    VALUES (
        v_client_niko_id,
        v_workspace_id,
        'Niko Elektronik',
        'Nikolai Jensen',
        'finance@nikoelektronik.io',
        'Niko Elektronik AB',
        15,
        'High-converting product launch videos & influencer campaigns.'
    );

    -- ========================================================================
    -- 3. INVOICES & LINE ITEMS
    -- ========================================================================

    -- INVOICE 1: Sent / Unpaid (Professor Toko Online) - Net 15
    INSERT INTO public.invoices (
        id, workspace_id, client_id, invoice_number, status,
        issue_date, due_date, subtotal, tax_rate, tax_amount,
        total_amount, amount_paid, currency, notes
    ) VALUES (
        v_invoice_1_id, v_workspace_id, v_client_toko_id, 'INV-2026-001', 'sent',
        CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '12 days',
        3600.00, 0.00, 0.00, 3600.00, 0.00, 'USD',
        'Deliverables for Q3 TikTok organic growth campaign.'
    );

    INSERT INTO public.invoice_line_items (workspace_id, invoice_id, description, quantity, unit_price, sort_order)
    VALUES
        (v_workspace_id, v_invoice_1_id, '30 TikTok Marketing Scripts (Hooks, CTA & Creative Direction)', 30, 80.00, 1),
        (v_workspace_id, v_invoice_1_id, 'Commercial coffee shop review video (Full Production & Edit)', 1, 1200.00, 2);

    -- INVOICE 2: Sent / Unpaid (Nüman Kitchenware) - Due Soon
    INSERT INTO public.invoices (
        id, workspace_id, client_id, invoice_number, status,
        issue_date, due_date, subtotal, tax_rate, tax_amount,
        total_amount, amount_paid, currency, is_recurring_template, notes
    ) VALUES (
        v_invoice_2_id, v_workspace_id, v_client_numan_id, 'INV-2026-002', 'sent',
        CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '5 days',
        4800.00, 0.00, 0.00, 4800.00, 0.00, 'USD', true,
        'Monthly live-stream sales production retainer (Recurring One-Click Duplicate template).'
    );

    INSERT INTO public.invoice_line_items (workspace_id, invoice_id, description, quantity, unit_price, sort_order)
    VALUES
        (v_workspace_id, v_invoice_2_id, 'Live-stream sales production retainer (4 Weekly Studio Broadcasts)', 1, 4000.00, 1),
        (v_workspace_id, v_invoice_2_id, 'Live-Stream OBS Overlay & Dynamic Graphic Asset Pack', 1, 800.00, 2);

    -- INVOICE 3: Paid (Niko Elektronik)
    INSERT INTO public.invoices (
        id, workspace_id, client_id, invoice_number, status,
        issue_date, due_date, subtotal, tax_rate, tax_amount,
        total_amount, amount_paid, currency, notes
    ) VALUES (
        v_invoice_3_id, v_workspace_id, v_client_niko_id, 'INV-2026-003', 'paid',
        CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days',
        2500.00, 0.00, 0.00, 2500.00, 2500.00, 'USD',
        'Flagship product launch campaign assets.'
    );

    INSERT INTO public.invoice_line_items (workspace_id, invoice_id, description, quantity, unit_price, sort_order)
    VALUES
        (v_workspace_id, v_invoice_3_id, 'Short-form social media teaser cutdown package (5 videos)', 5, 500.00, 1);

    -- ========================================================================
    -- 4. TRANSACTIONS (Unified Ledger / "Activity Feed")
    -- ========================================================================

    -- INCOME: Paid Invoice from Niko Elektronik
    INSERT INTO public.transactions (
        workspace_id, type, category, amount, transaction_date,
        description, client_id, invoice_id, payment_method
    ) VALUES (
        v_workspace_id, 'income', 'Client Payment', 2500.00, CURRENT_DATE - INTERVAL '5 days',
        'Payment received for INV-2026-003 (Niko Elektronik)', v_client_niko_id, v_invoice_3_id, 'Stripe'
    );

    -- EXPENSE: Gear & Studio Equipment
    INSERT INTO public.transactions (
        workspace_id, type, category, amount, transaction_date,
        description, payment_method, is_upcoming_bill
    ) VALUES (
        v_workspace_id, 'expense', 'Gear & Studio', 640.00, CURRENT_DATE - INTERVAL '7 days',
        'Ring lights and studio gear (Aputure Amaran LED kit & diffusion stands)', 'Credit Card', false
    );

    -- EXPENSE: Team & Agency Culture
    INSERT INTO public.transactions (
        workspace_id, type, category, amount, transaction_date,
        description, payment_method, is_upcoming_bill
    ) VALUES (
        v_workspace_id, 'expense', 'Meals & Entertainment', 135.50, CURRENT_DATE - INTERVAL '2 days',
        'Office staff lunches (Creative brainstorming catering)', 'Credit Card', false
    );

    -- EXPENSE (UPCOMING BILL DUE THIS WEEK): Software & Tools
    INSERT INTO public.transactions (
        workspace_id, type, category, amount, transaction_date,
        description, is_upcoming_bill, due_date
    ) VALUES (
        v_workspace_id, 'expense', 'Software & Tools', 299.00, CURRENT_DATE,
        'Frame.io & Adobe Creative Cloud Team Subscription renewal', true, CURRENT_DATE + INTERVAL '4 days'
    );

    -- EXPENSE (UPCOMING BILL DUE THIS WEEK): Contractor Payout
    INSERT INTO public.transactions (
        workspace_id, type, category, amount, transaction_date,
        description, is_upcoming_bill, due_date
    ) VALUES (
        v_workspace_id, 'expense', 'Contractor / Affiliate Payout', 850.00, CURRENT_DATE,
        'Video Editor Freelance Invoice #902 - TikTok edits', true, CURRENT_DATE + INTERVAL '3 days'
    );

    RAISE NOTICE 'Seed script successfully populated workspace New Wave Agency with clients, invoices, line items, and activity feed transactions.';
END $$;
