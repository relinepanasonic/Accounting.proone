-- When the team was last told about each WhatsApp number that stopped delivering: { "sales": "<time>", "admin": "<time>" }. A problem is told again every 12 hours.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS health_alerts JSONB NOT NULL DEFAULT '{}'::jsonb;
