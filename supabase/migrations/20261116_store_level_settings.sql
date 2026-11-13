-- Each store of a client can have its own WhatsApp group, start date, advertiser and admin (empty = the client's own value).
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS wa_group_id uuid REFERENCES public.wa_groups(id) ON DELETE SET NULL;
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS advertiser_id uuid;
ALTER TABLE public.client_stores ADD COLUMN IF NOT EXISTS admin_id uuid;
