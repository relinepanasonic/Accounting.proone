-- The daily BOD PDF goes to Nico and Herlan only; Lucy gets the weekly and monthly reports. A per-person switch (Founder page > Who receives it).
ALTER TABLE public.wa_recipients ADD COLUMN IF NOT EXISTS receives_daily BOOLEAN NOT NULL DEFAULT true;
UPDATE public.wa_recipients SET receives_daily = false WHERE phone = '6282231939378';   -- Lucy
