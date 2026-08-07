-- Fix invoices_status_check constraint to include partial_paid and invoiced
-- The app uses these statuses but the original schema only allowed: draft, sent, paid, overdue, cancelled

ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('draft', 'sent', 'invoiced', 'paid', 'partial_paid', 'overdue', 'cancelled'));

-- Update any existing rows that may have old status values
UPDATE public.invoices 
SET status = 'sent'
WHERE status NOT IN ('draft', 'sent', 'invoiced', 'paid', 'partial_paid', 'overdue', 'cancelled');
