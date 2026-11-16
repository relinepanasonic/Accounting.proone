-- Who the salespeople of the chat dashboard are: a list of { id, name }. These people can open the chat dashboard (whatever their ERP role is, for example an
-- advertiser who also sells) and are the choices for "assign this chat", the default salesperson in Jadwal and the lead rotation. Empty = everyone with a chat role.
ALTER TABLE public.wa_bot_config ADD COLUMN IF NOT EXISTS sales_team JSONB NOT NULL DEFAULT '[]'::jsonb;
