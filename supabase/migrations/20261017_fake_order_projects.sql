-- Admin > Fake Order: a project per client invoice (Friends Order / Paket Optimize Shopee New Store).
-- The admin puts the start date by hand; when the project is finished it moves to the Finished page.
-- A renewal is a new invoice, and it starts over as a new project. Run in the Supabase SQL editor (safe to run more than once).
CREATE TABLE IF NOT EXISTS public.fake_order_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number text,
  product_name text,
  start_date date NOT NULL,
  finished_at date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fake_order_projects_ws ON public.fake_order_projects (workspace_id, finished_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fake_order_projects_invoice ON public.fake_order_projects (workspace_id, invoice_id, product_name) WHERE invoice_id IS NOT NULL;

ALTER TABLE public.fake_order_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage fake_order_projects of their workspace" ON public.fake_order_projects;
CREATE POLICY "Members manage fake_order_projects of their workspace"
  ON public.fake_order_projects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = fake_order_projects.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = fake_order_projects.workspace_id AND wm.user_id = auth.uid()));

-- Every fake order belongs to a project.
ALTER TABLE public.fake_orders ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.fake_order_projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_fake_orders_project ON public.fake_orders (project_id);
