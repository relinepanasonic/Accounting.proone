-- PT Pintu pays for the group: an expense can be assigned to the workspace it belongs to (like invoices already can).
-- The workspace then sees it read-only in its own Expenses list. Run in the Supabase SQL editor.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS assigned_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_ws ON public.transactions (assigned_workspace_id) WHERE assigned_workspace_id IS NOT NULL;
