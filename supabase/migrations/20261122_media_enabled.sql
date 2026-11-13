-- Sending photos from the chat dashboard needs a Fonnte package with attachments (Super or higher) on the sales number. Off until an admin switches it on.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS media_enabled BOOLEAN NOT NULL DEFAULT false;
