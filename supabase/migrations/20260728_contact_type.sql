-- Add contact_type to distinguish Clients and Vendors
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'client' CHECK (contact_type IN ('client', 'vendor'));

-- Add is_quotation to invoices to deprecate the separate quotations table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_quotation BOOLEAN NOT NULL DEFAULT false;
