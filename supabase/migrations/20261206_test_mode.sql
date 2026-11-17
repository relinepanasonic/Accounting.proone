-- Test mode: a team number (Nico, Herlan, Lucy, a salesperson) can chat with Fefe as if it were a lead, without a lead, a count or a follow-up being made.
ALTER TABLE public.chat_state ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT false;
