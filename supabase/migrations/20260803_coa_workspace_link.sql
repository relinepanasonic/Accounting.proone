-- Add workspace_id to global_chart_of_accounts
ALTER TABLE public.global_chart_of_accounts
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
