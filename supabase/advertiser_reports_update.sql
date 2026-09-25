-- Add user_id and note to advertiser_reports
ALTER TABLE public.advertiser_reports
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS note TEXT;
