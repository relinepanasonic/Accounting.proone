import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
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

  const memberList: TeamMemberRecord[] = (rawMembers || [])
    .map((m: any, idx: number) => {
      const profile = profiles?.find((p) => p.id === m.user_id);
      const email = profile?.email || `staff-${idx + 1}@professortokoonline.com`;
      const isFounderUser = email.toLowerCase() === 'nicojapar@gmail.com';
      
      return {
        id: m.id,
        email,
        name: profile?.full_name || `Workspace Staff #${idx + 1}`,
        role: isFounderUser ? 'founder' : (m.role || 'accounting'),
        isCurrentUser: user?.id === m.user_id,
      };
    })
    .filter((m: any) => {
      // Superadmins cannot see founders in the UI. Only founders see founders.
      if (currentUserRole !== 'founder' && m.role === 'founder') {
        return false;
      }
      return true;
    });

  return <TeamManager initialMembers={memberList} currentUserRole={currentUserRole} />;
}
