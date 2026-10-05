-- AI Office Studio: marketing image jobs (interview -> sample -> approval -> all images saved to Google Drive).
-- Run in the Supabase SQL editor AFTER 20260930_ai_office.sql and 20260930_ai_teams.sql.
-- Access: founder / superadmin only (same rule as the rest of the AI Office).

BEGIN;

-- The Google account the owner signed in with. The refresh token never leaves the server.
CREATE TABLE IF NOT EXISTS public.ai_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    account_email TEXT,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS public.ai_studio_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.ai_teams(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'interview'
        CHECK (status IN ('interview', 'briefed', 'sampling', 'review', 'generating', 'done', 'failed')),
    interview JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{role: 'producer' | 'owner', text}]
    brief JSONB,                                    -- the creative brief the producer wrote from the interview
    input_folder_id TEXT,
    input_folder_name TEXT,
    output_folder_id TEXT,
    output_folder_name TEXT,
    research TEXT,
    feedback TEXT,                                  -- the owner's remarks on the last sample
    error TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_studio_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.ai_studio_jobs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_files JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id, name, mimeType}] product photos in Drive
    prompts JSONB,                                   -- {images: [..5], video: ".."}
    is_sample BOOLEAN NOT NULL DEFAULT false,
    drive_folder_id TEXT,                            -- this product's folder inside the output folder
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'prompted', 'done', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_studio_products_job ON public.ai_studio_products (job_id);

CREATE TABLE IF NOT EXISTS public.ai_studio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.ai_studio_jobs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.ai_studio_products(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
    idx INT NOT NULL DEFAULT 0,
    prompt TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    drive_file_id TEXT,
    drive_file_name TEXT,
    is_sample BOOLEAN NOT NULL DEFAULT false,
    cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0,
    qc_note TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_studio_assets_job ON public.ai_studio_assets (job_id, status);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_integrations', 'ai_studio_jobs', 'ai_studio_products', 'ai_studio_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_office_owner_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ai_office_owner_all ON public.%I FOR ALL USING (public.is_workspace_owner_role(workspace_id)) WITH CHECK (public.is_workspace_owner_role(workspace_id))',
      t);
  END LOOP;
END $$;

COMMIT;
