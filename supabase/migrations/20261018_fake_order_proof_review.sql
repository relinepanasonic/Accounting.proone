-- Fake Order: two proofs per order, Proof VA (the payment) and Proof Review (the review). Run in the Supabase SQL editor.
ALTER TABLE public.fake_orders ADD COLUMN IF NOT EXISTS proof_review_url text;
