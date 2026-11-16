-- New leads that Fefe puts in the pipeline are shared between these salespeople in turn (the one with the fewest new leads in the last 30 days goes first).
-- A list of { id, name }. Empty = nobody in the rotation: the chat's salesperson, else the default one from Jadwal, else no owner.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS lead_owners JSONB NOT NULL DEFAULT '[]'::jsonb;
