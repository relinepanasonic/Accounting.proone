-- Subscriptions page (founder only): every app, tool and AI the company pays for, and what it costs.
-- Only the server (service role) reads and writes it; no policy is added on purpose, so nobody else can read it.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  purpose text,
  plan text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD')),
  cycle text NOT NULL DEFAULT 'monthly' CHECK (cycle IN ('monthly', 'yearly')),
  renew_day integer CHECK (renew_day BETWEEN 1 AND 31),
  paid_with text,
  url text,
  note text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
