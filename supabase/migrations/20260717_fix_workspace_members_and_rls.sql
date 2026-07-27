-- Migration: Allow email-invited staff and authenticated users to view real workspaces and auto-link upon login
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

DROP POLICY IF EXISTS "Members view teammates" ON public.workspace_members;
CREATE POLICY "Members view teammates"
    ON public.workspace_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR (email IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        OR public.is_workspace_member(workspace_id)
        OR auth.uid() IS NOT NULL
    );
