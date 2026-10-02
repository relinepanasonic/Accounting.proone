import React from 'react';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { ShieldAlert } from 'lucide-react';
import { JoinForm } from '@/components/auth/JoinForm';
import { hashInviteToken } from '@/lib/auth/invites';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Join | Professor Toko Online' };

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  accounting: 'Accounting',
  admin: 'Admin',
  advertiser: 'Advertiser',
  sales: 'Sales',
  client: 'Client',
};

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const db = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: invite } = await db
    .from('workspace_invites')
    .select('full_name, role, workspace_ids, expires_at, used_at')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();

  const valid = invite && !invite.used_at && new Date(invite.expires_at).getTime() > Date.now();

  let workspaceNames: string[] = [];
  if (valid) {
    const { data: ws } = await db.from('workspaces').select('name').in('id', invite.workspace_ids as string[]);
    workspaceNames = (ws || []).map((w: any) => w.name);
  }

  return (
    <main className="min-h-screen bg-[#0b0c10] flex items-center justify-center p-4 sm:p-6">
      {valid ? (
        <JoinForm token={token} name={invite.full_name} roleLabel={ROLE_LABEL[invite.role] || invite.role} workspaces={workspaceNames} />
      ) : (
        <div className="gold-glass-panel border-red-500/40 rounded-2xl p-10 text-center max-w-md">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h1 className="text-sm font-black uppercase tracking-widest text-red-400 mb-2">Invitation not valid</h1>
          <p className="text-xs text-zinc-300 leading-relaxed">
            This link has expired or was already used. Ask your admin to send you a new invitation.
          </p>
        </div>
      )}
    </main>
  );
}
