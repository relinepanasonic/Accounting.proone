-- Cold leads: the educational broadcast on the 1st and the 15th (on/off per company), and the follow-ups go 1, 3 and 7 days after the last answer.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS cold_bc_enabled BOOLEAN NOT NULL DEFAULT false;
