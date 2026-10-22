-- Optimize Control (AI team): the reports of each agent per day, and Prof's WhatsApp message. Read and written by the server only.
-- Run in the Supabase SQL editor (safe to run more than once).
CREATE TABLE IF NOT EXISTS public.ai_control_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL,
  agent text NOT NULL,          -- prof | acu | adi | avi | selly | don
  cadence text NOT NULL,        -- daily | weekly
  content text NOT NULL,
  model text,
  tokens_in integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (run_date, agent, cadence)
);
CREATE INDEX IF NOT EXISTS idx_ai_control_reports_date ON public.ai_control_reports (run_date DESC);
-- No policy: only the server (service role) reads and writes it.
ALTER TABLE public.ai_control_reports ENABLE ROW LEVEL SECURITY;
