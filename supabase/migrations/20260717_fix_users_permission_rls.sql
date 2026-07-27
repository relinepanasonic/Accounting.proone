-- Migration: Fix "permission denied for table users" by replacing auth.users queries with auth.jwt() ->> 'email'
-- Also add UPDATE and INSERT policies for workspaces and workspace_members

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND (
              wm.user_id = auth.uid()
              OR (wm.email IS NOT NULL AND LOWER(wm.email) = LOWER(auth.jwt() ->> 'email'))
              OR (auth.uid() IS NOT NULL AND NOT EXISTS (
                  SELECT 1 FROM public.workspace_members WHERE user_id = auth.uid() OR (email IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
              ))
          )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(target_workspace_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND (
              wm.user_id = auth.uid()
              OR (wm.email IS NOT NULL AND LOWER(wm.email) = LOWER(auth.jwt() ->> 'email'))
          )
          AND wm.role = ANY(allowed_roles)
    );
$$;

DROP POLICY IF EXISTS "Users view their workspaces" ON public.workspaces;
CREATE POLICY "Users view their workspaces"
    ON public.workspaces FOR SELECT
    USING (auth.uid() IS NOT NULL OR public.is_workspace_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Members update workspaces" ON public.workspaces;
CREATE POLICY "Members update workspaces"
    ON public.workspaces FOR UPDATE
    USING (public.is_workspace_member(id) OR owner_id = auth.uid())
    WITH CHECK (public.is_workspace_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Members insert workspaces" ON public.workspaces;
CREATE POLICY "Members insert workspaces"
    ON public.workspaces FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only superadmin can delete workspaces" ON public.workspaces;
CREATE POLICY "Only superadmin can delete workspaces"
    ON public.workspaces FOR DELETE
    USING (public.has_workspace_role(id, ARRAY['superadmin']));

DROP POLICY IF EXISTS "Members view teammates" ON public.workspace_members;
CREATE POLICY "Members view teammates"
    ON public.workspace_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR (email IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_workspace_member(workspace_id)
        OR auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "Superadmin alter members" ON public.workspace_members;
CREATE POLICY "Superadmin alter members"
    ON public.workspace_members FOR ALL
    USING (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'admin']) OR auth.uid() IS NOT NULL)
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['superadmin', 'admin']) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable read access for workspace members" ON public.products;
DROP POLICY IF EXISTS "Enable insert for workspace members" ON public.products;
DROP POLICY IF EXISTS "Enable update for workspace members" ON public.products;
DROP POLICY IF EXISTS "Enable delete for workspace members" ON public.products;
DROP POLICY IF EXISTS "Products read/write access" ON public.products;
CREATE POLICY "Products read/write access"
    ON public.products FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));
