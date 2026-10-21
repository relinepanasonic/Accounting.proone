-- Admin > Fake Order: the fake orders made for a client (the client has an invoice for the Fake Order project).
-- Run in the Supabase SQL editor (safe to run more than once).
CREATE TABLE IF NOT EXISTS public.fake_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  order_no text NOT NULL,
  buyer_name text,
  total numeric NOT NULL DEFAULT 0,
  proof_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fake_orders_ws ON public.fake_orders (workspace_id, created_at DESC);

ALTER TABLE public.fake_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage fake_orders of their workspace" ON public.fake_orders;
CREATE POLICY "Members manage fake_orders of their workspace"
  ON public.fake_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = fake_orders.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = fake_orders.workspace_id AND wm.user_id = auth.uid()));

-- The proof images (screenshots). The server uploads them; the files are shown through their link.
INSERT INTO storage.buckets (id, name, public) VALUES ('fake-order-proofs', 'fake-order-proofs', true) ON CONFLICT (id) DO NOTHING;
