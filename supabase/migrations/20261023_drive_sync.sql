-- Google Drive documentation sync (Make.com copies new invoice PDFs, Faktur Pajak and Bukti Potong into the Drive folders).
-- One row per document already copied, so the daily run only sends what is new. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.drive_sync (
  key           TEXT PRIMARY KEY,                -- invoice:<id>, faktur:<invoice id>, bukti:<invoice id>
  kind          TEXT NOT NULL,                   -- invoice | faktur | bukti
  name          TEXT,                            -- the file name in Drive
  drive_file_id TEXT,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the service role (the machine API) reads or writes it: no policy for normal users.
ALTER TABLE public.drive_sync ENABLE ROW LEVEL SECURITY;
