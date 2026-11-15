-- Pipeline v2: New Lead > Contacted > Qualified > Warm > Meeting Offered > Meeting Booked > Meeting Done > Negotiation > Invoice Requested >
-- Invoice Sent > Active Client, and Lost. The stored names of the old stages are kept (Lead, Contacted, Negotiation, Invoice, Deal, Cold Case),
-- so nothing has to be renamed. Only deals whose invoice is already requested move to the new stage of that name.
UPDATE public.crm_deals d SET stage = 'Invoice Requested', stage_changed_at = COALESCE(d.invoice_requested_at, now())
WHERE d.stage = 'Negotiation' AND d.invoice_id IS NULL
  AND EXISTS (SELECT 1 FROM public.invoice_requests r WHERE r.deal_id = d.id AND r.status = 'requested');
CREATE INDEX IF NOT EXISTS crm_deals_ws_stage ON public.crm_deals (workspace_id, stage);
