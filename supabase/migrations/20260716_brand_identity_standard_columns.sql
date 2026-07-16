-- ==============================================================================
-- BRAND IDENTITY STANDARD COLUMNS SCHEMA MIGRATION
-- ==============================================================================

-- Add standard brand identity columns to workspaces table without dropping or modifying existing data
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS brand_tagline TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS official_email TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

COMMENT ON COLUMN public.workspaces.brand_tagline IS 'Official brand subtitle/tagline displayed on PDF invoices and quotes.';
COMMENT ON COLUMN public.workspaces.contact_phone IS 'Official contact telephone number displayed on PDF invoices and quotes.';
COMMENT ON COLUMN public.workspaces.official_email IS 'Official contact email address displayed on PDF invoices and quotes.';
COMMENT ON COLUMN public.workspaces.website_url IS 'Official enterprise website URL displayed on PDF invoices and quotes.';
COMMENT ON COLUMN public.workspaces.logo_url IS 'URL or Base64 data URI of the official enterprise logo displayed on PDF invoices and quotes.';
