-- Make clients global: shared across all workspaces
-- 1. Drop the NOT NULL + FK constraint on workspace_id
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_workspace_id_fkey;

ALTER TABLE public.clients
  ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Set all existing rows to NULL workspace_id (they become global)
UPDATE public.clients SET workspace_id = NULL;

-- 3. Drop old workspace-scoped RLS policies
DROP POLICY IF EXISTS "Users can view their workspace clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients for their workspace" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients for their workspace" ON public.clients;
DROP POLICY IF EXISTS "Users can delete clients for their workspace" ON public.clients;
DROP POLICY IF EXISTS "workspace_members can select clients" ON public.clients;
DROP POLICY IF EXISTS "workspace_members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "workspace_members can update clients" ON public.clients;
DROP POLICY IF EXISTS "workspace_members can delete clients" ON public.clients;

-- 4. Create simple global policies: any authenticated user can see/add/edit/delete
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Global: authenticated can view clients'
  ) THEN
    CREATE POLICY "Global: authenticated can view clients"
      ON public.clients FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Global: authenticated can insert clients'
  ) THEN
    CREATE POLICY "Global: authenticated can insert clients"
      ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Global: authenticated can update clients'
  ) THEN
    CREATE POLICY "Global: authenticated can update clients"
      ON public.clients FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Global: authenticated can delete clients'
  ) THEN
    CREATE POLICY "Global: authenticated can delete clients"
      ON public.clients FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
