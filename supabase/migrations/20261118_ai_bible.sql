-- AI Bible: the documents (Sales Deck, price list...) the sales bot and "Suggest reply" read. The file is kept in a private bucket; its text is read once
-- (by Claude) and kept here, where it can be corrected. Old versions stay (active = false). Written by the app (service role); finance members can read.

CREATE TABLE IF NOT EXISTS public.ai_bible_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'sales_deck',
    file_path TEXT,
    file_name TEXT,
    file_size BIGINT,
    text TEXT NOT NULL DEFAULT '',            -- what the AI reads (extracted from the file, then edited by hand when needed)
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    error TEXT,
    active BOOLEAN NOT NULL DEFAULT true,     -- only active documents are read by the AI
    version INT NOT NULL DEFAULT 1,
    replaces UUID REFERENCES public.ai_bible_docs(id) ON DELETE SET NULL,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    text_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    text_updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_bible_docs_ws ON public.ai_bible_docs (workspace_id, active, created_at DESC);

ALTER TABLE public.ai_bible_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_finance_read ON public.ai_bible_docs;
CREATE POLICY wa_finance_read ON public.ai_bible_docs FOR SELECT USING (public.is_finance_member(workspace_id));

INSERT INTO storage.buckets (id, name, public) VALUES ('ai-bible', 'ai-bible', false) ON CONFLICT (id) DO NOTHING;
