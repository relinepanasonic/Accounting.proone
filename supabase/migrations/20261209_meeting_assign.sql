-- Who handles a meeting: when a lead books the free consultation, Herlan gets a WhatsApp and picks Herlan, Velly or both. The pick is kept here.
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS assign_status TEXT;          -- 'pending' (asked, no answer yet) | 'done'
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS assign_asked_at TIMESTAMPTZ;
ALTER TABLE public.chat_meetings ADD COLUMN IF NOT EXISTS assignees JSONB NOT NULL DEFAULT '[]'::jsonb;   -- [{ id, name, visitId }]
