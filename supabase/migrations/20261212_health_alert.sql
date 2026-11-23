-- When the team was last told that the sales WhatsApp number stopped delivering (at most one alert every 12 hours).
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS health_alert_at TIMESTAMPTZ;
