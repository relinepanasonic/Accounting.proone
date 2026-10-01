-- One-time invitations: the admin sets name, role and workspaces; the person opens the link and creates
-- their own account (email, phone, username, password). Only a hash of the link token is stored.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'accounting', 'admin', 'advertiser', 'client')),
    workspace_ids UUID[] NOT NULL,
    invited_by UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No policies on purpose: only the server (service role) reads or writes invitations.
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Phone number given by the person when they accept the invitation.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
