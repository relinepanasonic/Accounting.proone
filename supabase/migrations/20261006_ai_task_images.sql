-- AI Office: design-reference pictures attached to a brief, shown to agents whose model can see images.
-- Run in the Supabase SQL editor AFTER 20260930_ai_office.sql. Kept in its own table so the office
-- screens (which reload often) never download picture data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_task_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL DEFAULT 'image/jpeg',
    data TEXT NOT NULL,                 -- base64, no "data:" prefix
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_task_images_task ON public.ai_task_images (task_id);

ALTER TABLE public.ai_task_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_office_owner_all ON public.ai_task_images;
CREATE POLICY ai_office_owner_all ON public.ai_task_images FOR ALL
  USING (public.is_workspace_owner_role(workspace_id))
  WITH CHECK (public.is_workspace_owner_role(workspace_id));

COMMIT;
