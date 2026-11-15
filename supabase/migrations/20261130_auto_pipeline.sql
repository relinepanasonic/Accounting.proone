-- The AI puts leads in the CRM pipeline: a switch (off until turned on), the trigger words (null = the built-in lists), and the link from a chat to
-- its ERP deal (Instagram and Messenger chats have no phone number to match a client by).
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS stage_auto BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS stage_words JSONB;
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;
