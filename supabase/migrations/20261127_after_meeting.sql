-- After the free consultation: a thank-you when the team marks it Done (and the ERP lead moves to Negotiation), and three new times when the
-- lead did not come. Both messages are on by default and can be switched off in Jadwal.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS after_thanks BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS after_no_show BOOLEAN NOT NULL DEFAULT true;
