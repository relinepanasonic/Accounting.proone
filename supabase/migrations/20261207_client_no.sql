-- Client ID: every client (and every lead's prospect client) gets a permanent number that is easy to say: 1001, 1002, ... Old clients are numbered in the order
-- they were created; new ones get the next number by themselves.
CREATE SEQUENCE IF NOT EXISTS public.clients_client_no_seq START 1001;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_no INTEGER;
UPDATE public.clients c SET client_no = 1000 + o.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM public.clients WHERE client_no IS NULL) o
WHERE c.id = o.id AND c.client_no IS NULL;
SELECT setval('public.clients_client_no_seq', GREATEST(1000, COALESCE((SELECT max(client_no) FROM public.clients), 1000)));
ALTER TABLE public.clients ALTER COLUMN client_no SET DEFAULT nextval('public.clients_client_no_seq');
ALTER TABLE public.clients ALTER COLUMN client_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_client_no_key ON public.clients (client_no);
