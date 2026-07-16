-- ==============================================================================
-- BRAND IDENTITY, TAX TOGGLE & QUOTATIONS MODULE SCHEMA MIGRATION
-- ==============================================================================

-- 1. UPDATE TABLE workspaces: Add is_tax_registered, logo_url, tagline, phone, email, website
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS is_tax_registered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- 2. CREATE TABLE quotations: For pitching without totals
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  quotation_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CREATE TABLE quotation_line_items
CREATE TABLE IF NOT EXISTS public.quotation_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENABLE RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_line_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR quotations
DROP POLICY IF EXISTS "Enable read access for workspace members" ON public.quotations;
CREATE POLICY "Enable read access for workspace members"
ON public.quotations
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable insert for workspace members" ON public.quotations;
CREATE POLICY "Enable insert for workspace members"
ON public.quotations
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable update for workspace members" ON public.quotations;
CREATE POLICY "Enable update for workspace members"
ON public.quotations
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable delete for workspace members" ON public.quotations;
CREATE POLICY "Enable delete for workspace members"
ON public.quotations
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- 6. RLS POLICIES FOR quotation_line_items
DROP POLICY IF EXISTS "Enable read access for workspace members" ON public.quotation_line_items;
CREATE POLICY "Enable read access for workspace members"
ON public.quotation_line_items
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable insert for workspace members" ON public.quotation_line_items;
CREATE POLICY "Enable insert for workspace members"
ON public.quotation_line_items
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable update for workspace members" ON public.quotation_line_items;
CREATE POLICY "Enable update for workspace members"
ON public.quotation_line_items
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Enable delete for workspace members" ON public.quotation_line_items;
CREATE POLICY "Enable delete for workspace members"
ON public.quotation_line_items
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);
