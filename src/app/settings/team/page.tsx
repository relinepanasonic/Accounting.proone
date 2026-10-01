import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isFounderEmail } from '@/lib/auth/founders';
import { TeamManager, type TeamMemberRecord } from '@/components/settings/TeamManager';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole = 'superadmin';
  let activeWorkspaceId = '11111111-1111-1111-1111-111111111111';

  const wsCtx = await getAuthenticatedWorkspaceContext();
  if (wsCtx && wsCtx.activeWorkspaceId) {
    currentUserRole = wsCtx.role;
    activeWorkspaceId = wsCtx.activeWorkspaceId;
  } else if (user) {
    const { data: memberRow } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('user_id', user.id)
      .limit(1);

    if (memberRow && memberRow.length > 0) {
      currentUserRole = memberRow[0].role;
      activeWorkspaceId = memberRow[0].workspace_id;
    }
  }

  // Strict RBAC check: only superadmin and founder can view or modify team settings
  if (user && currentUserRole !== 'superadmin' && currentUserRole !== 'founder') {
    return (
      <div className="gold-glass-panel rounded-3xl p-10 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center mx-auto text-[#f5d77f]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-wider text-white font-serif">
          SECURITY CLEARANCE RESTRICTED
        </h2>
        <p className="text-xs font-mono text-zinc-400">
          TEAM CREDENTIAL MANAGEMENT IS STRICTLY RESTRICTED TO WORKSPACE SUPERADMINS. CURRENT ROLE:{' '}
          <span className="text-[#f5d77f] uppercase">{currentUserRole}</span>
        </p>
      </div>
    );
  }

  let queryClient = supabase;
  if (currentUserRole === 'founder') {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    queryClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any;
  }

  const { data: rawMembers } = await queryClient
    .from('workspace_members')
    .select('id, role, user_id')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: true });

  const { data: profiles } = await queryClient
    .from('profiles')
    .select('id, email, full_name');

  // Workspaces this person manages (founder: all). Access can only be granted to these.
  const manageableWorkspaces = (wsCtx?.availableWorkspaces || [])
    .filter((w) => w.role === 'founder' || w.role === 'superadmin')
    .map((w) => ({ id: w.id, name: w.name }));

  // Which of those workspaces each member can already enter.
  const memberUserIds = (rawMembers || []).map((m: any) => m.user_id).filter(Boolean);
  const accessByUser = new Map<string, string[]>();
  if (memberUserIds.length > 0 && manageableWorkspaces.length > 0) {
    const { data: access } = await queryClient
      .from('workspace_members')
      .select('user_id, workspace_id')
      .in('workspace_id', manageableWorkspaces.map((w) => w.id))
      .in('user_id', memberUserIds);
    (access || []).forEach((a: any) => {
      accessByUser.set(a.user_id, [...(accessByUser.get(a.user_id) || []), a.workspace_id]);
    });
  }

  const memberList: TeamMemberRecord[] = (rawMembers || [])
    .map((m: any, idx: number) => {
      const profile = profiles?.find((p) => p.id === m.user_id);
      const email = profile?.email || `staff-${idx + 1}@professortokoonline.com`;
      const isFounderUser = isFounderEmail(email);
      
      return {
        id: m.id,
        email,
        name: profile?.full_name || `Workspace Staff #${idx + 1}`,
        role: isFounderUser ? 'founder' : (m.role || 'accounting'),
        isCurrentUser: user?.id === m.user_id,
        workspaceIds: accessByUser.get(m.user_id) || [activeWorkspaceId],
      };
    })
    .filter((m: any) => {
      // Superadmins cannot see founders in the UI. Only founders see founders.
      if (currentUserRole !== 'founder' && m.role === 'founder') {
        return false;
      }
      return true;
    });

  // Invitations that have not been used yet, for the workspaces this person manages.
  const adminForInvites = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: inviteRows } = await adminForInvites
    .from('workspace_invites')
    .select('id, full_name, role, workspace_ids, expires_at')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .overlaps('workspace_ids', manageableWorkspaces.map((w) => w.id))
    .order('created_at', { ascending: false });
  const pendingInvites = (inviteRows || []).map((i: any) => ({
    id: i.id as string,
    fullName: i.full_name as string,
    role: i.role as string,
    expiresAt: i.expires_at as string,
    workspaceIds: i.workspace_ids as string[],
  }));

  return (
    <TeamManager
      initialMembers={memberList}
      currentUserRole={currentUserRole}
      workspaces={manageableWorkspaces}
      activeWorkspaceId={activeWorkspaceId}
      pendingInvites={pendingInvites}
    />
  );
}
