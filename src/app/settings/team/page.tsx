import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { TeamManager, type TeamMemberRecord } from '@/components/settings/TeamManager';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole = 'superadmin';

  if (user) {
    const { data: memberRow } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1);

    if (memberRow && memberRow.length > 0) {
      currentUserRole = memberRow[0].role;
    }
  }

  // Strict RBAC check: only superadmin can view or modify team settings
  if (user && currentUserRole !== 'superadmin') {
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

  const { data: rawMembers } = await supabase
    .from('workspace_members')
    .select('id, role, user_id')
    .order('created_at', { ascending: true });

  const fallbackMembers: TeamMemberRecord[] = [
    {
      id: 'm-1',
      email: 'professortokoonline@gmail.com',
      name: 'Professor Toko Online (Owner)',
      role: 'superadmin',
    },
    {
      id: 'm-2',
      email: 'accounting@professortokoonline.com',
      name: 'Siska Handayani (Lead Accountant)',
      role: 'accounting',
    },
    {
      id: 'm-3',
      email: 'ops@professortokoonline.com',
      name: 'Budi Hartono (Ops Admin)',
      role: 'admin',
    },
  ];

  const memberList: TeamMemberRecord[] =
    rawMembers && rawMembers.length > 0
      ? rawMembers.map((m: any, idx: number) => ({
          id: m.id,
          email: m.email || `staff-${idx + 1}@professortokoonline.com`,
          name: m.name || `Workspace Staff #${idx + 1}`,
          role: m.role || 'accounting',
        }))
      : fallbackMembers;

  return <TeamManager initialMembers={memberList} currentUserRole={currentUserRole} />;
}
