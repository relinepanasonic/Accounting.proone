-- Run this in your Supabase SQL Editor
ALTER TABLE public.invoice_line_items
ADD COLUMN IF NOT EXISTS package_name TEXT,
ADD COLUMN IF NOT EXISTS scale TEXT;
