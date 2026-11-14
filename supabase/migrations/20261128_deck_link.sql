-- The sales deck as a link (Google Drive): the regular Fonnte package cannot send files, so the bot sends the link when a lead asks for the deck.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS deck_url TEXT;
