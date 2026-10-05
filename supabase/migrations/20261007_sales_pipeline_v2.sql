-- Sales pipeline v2: Cold Case stage, follow-up / proposal tasks, negotiation notes + owner ACC, client store name.
-- Run in the Supabase SQL editor AFTER 20261003_sales_flow.sql.

BEGIN;

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiation_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS neg_acc_status TEXT CHECK (neg_acc_status IN ('requested', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS neg_acc_requested_from UUID,
  ADD COLUMN IF NOT EXISTS neg_acc_requested_from_name TEXT,
  ADD COLUMN IF NOT EXISTS neg_acc_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS neg_acc_by UUID,
  ADD COLUMN IF NOT EXISTS neg_acc_by_name TEXT,
  ADD COLUMN IF NOT EXISTS neg_acc_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS neg_acc_comment TEXT;

-- "Proposal Sent" is no longer a stage: it is a one-time task while a card is in Lead / Contacted.
-- Cards that were in that column were proposals already sent: move them to Contacted and mark the task done.
UPDATE public.crm_deals
   SET stage = 'Contacted', proposal_sent_at = COALESCE(proposal_sent_at, now()), stage_changed_at = now()
 WHERE stage = 'Proposal Sent';

-- Brand name is the client's existing "company / brand" field; the store name is new.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS store_name TEXT;

COMMIT;
