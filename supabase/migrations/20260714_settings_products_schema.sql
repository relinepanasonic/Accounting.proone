-- ==============================================================================
-- SETTINGS MODULE & PRODUCT CATALOG SCHEMA MIGRATION
-- ==============================================================================

-- 1. UPDATE TABLE workspaces: Add company_logo_url, tax_rate_percent, payment_instructions
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC DEFAULT 11,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- 2. CREATE TABLE products: Product & Service Catalog
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ENABLE ROW LEVEL SECURITY ON products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES FOR products
DROP POLICY IF EXISTS "Enable read access for workspace members" ON public.products;
CREATE POLICY "Enable read access for workspace members"
ON public.products
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable insert for workspace members" ON public.products;
CREATE POLICY "Enable insert for workspace members"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable update for workspace members" ON public.products;
CREATE POLICY "Enable update for workspace members"
ON public.products
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable delete for workspace members" ON public.products;
CREATE POLICY "Enable delete for workspace members"
ON public.products
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- 5. SEED INITIAL PRODUCTS CATALOG FOR SEED WORKSPACE ('11111111-1111-1111-1111-111111111111')
INSERT INTO public.products (id, workspace_id, name, description, unit_price)
VALUES
  (
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    'TikTok Live Commerce Retainer',
    'Monthly dedicated TikTok Live studio setup, host curation, and dynamic shopping stream management',
    85000000
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    'Custom HD Video Creator Package',
    '40 high-converting short-form HD video ads with custom graphics & script writing',
    1621750
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    'Full-Funnel Brand Consulting & Strategy',
    'Comprehensive e-commerce strategy, omnichannel conversion optimization & attribution modeling',
    120000000
  ),
  (
    '44444444-4444-4444-4444-444444444404',
    'Shopee & Tokopedia Mall Storefront Management',
    'Official store visual merchandising, campaign flash sale orchestration, and stock sync architecture',
    45000000
  )
ON CONFLICT (id) DO NOTHING;
