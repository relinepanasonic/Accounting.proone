-- Lead sources: which ad (Meta Ads, Google Ads...) a WhatsApp lead came from, found from the first message the ad pre-fills for the customer.
-- Written by the app (service role); finance members can read.

CREATE TABLE IF NOT EXISTS public.lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                        -- e.g. "Meta Ads: Promo Paket Sultan"
    channel TEXT NOT NULL DEFAULT 'other' CHECK (channel IN ('meta_ads', 'google_ads', 'tiktok_ads', 'organic', 'referral', 'other')),
    first_message TEXT NOT NULL,               -- the text the ad pre-fills in WhatsApp; a new lead's first message is compared with it
    active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_sources_ws ON public.lead_sources (workspace_id, active);

-- The first message of each chat and the source found for it.
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS first_message TEXT;
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMPTZ;
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL;
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS source_label TEXT;      -- kept as text, so it survives a deleted source
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS source_channel TEXT;    -- meta_ads | google_ads | ... | unknown
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS source_by TEXT;         -- 'auto' (matched the message) or the name of the person who set it
CREATE INDEX IF NOT EXISTS idx_chat_state_first ON public.chat_state (workspace_id, first_message_at DESC);

-- The ERP's client record carries the source too, so Sales and reports can use it.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_channel TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_contact_message TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_finance_read ON public.lead_sources;
CREATE POLICY wa_finance_read ON public.lead_sources FOR SELECT USING (public.is_finance_member(workspace_id));
