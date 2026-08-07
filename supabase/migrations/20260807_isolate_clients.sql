-- Revert global clients and enforce workspace isolation
-- 1. Drop global policies
DROP POLICY IF EXISTS "Global: authenticated can view clients" ON public.clients;
DROP POLICY IF EXISTS "Global: authenticated can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Global: authenticated can update clients" ON public.clients;
DROP POLICY IF EXISTS "Global: authenticated can delete clients" ON public.clients;

-- 2. Add workspace isolation policies
-- We allow viewing NULL workspace_id so existing legacy global contacts don't break, 
-- but new ones must have a workspace_id.
CREATE POLICY "Users can view their workspace clients" ON public.clients FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()) OR workspace_id IS NULL
);

CREATE POLICY "Users can insert clients for their workspace" ON public.clients FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update clients for their workspace" ON public.clients FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete clients for their workspace" ON public.clients FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
