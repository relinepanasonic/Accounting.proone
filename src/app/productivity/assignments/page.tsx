import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { AssignmentManager } from '@/components/productivity/AssignmentManager';
import { ShieldAlert, Users } from 'lucide-react';

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role } = await getAuthenticatedWorkspaceContext(supabase);

  if (role !== 'superadmin' && role !== 'founder') {
    return (
      <div className="p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-[#0e0f14] border border-red-500/20 rounded-3xl p-10 max-w-2xl mx-auto text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-white font-serif">
            SECURITY CLEARANCE RESTRICTED
          </h2>
          <p className="text-sm text-zinc-400">
            Client assignment management is restricted to Superadmins only. Your current role is <span className="text-[#d4af37] font-mono uppercase">{role}</span>.
          </p>
        </div>
      </div>
    );
  }

  // Fetch clients for current workspace
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  // Fetch staff for current workspace (Advertiser/Admin)
  const { data: staff } = await supabase
    .from('workspace_members')
    .select(`
      user_id, 
      role,
      profiles (full_name, email)
    `)
    .eq('workspace_id', activeWorkspaceId)
    .in('role', ['admin', 'advertiser', 'accounting', 'superadmin']) // Show assignable roles
    .not('user_id', 'is', null);

  // Fetch all assignments for current workspace
  const { data: assignments, error } = await supabase
    .from('client_assignments')
    .select('client_id, user_id')
    .eq('workspace_id', activeWorkspaceId);

  // If table doesn't exist yet, we pass empty array so UI doesn't crash
  const safeAssignments = assignments || [];

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]">
          <Users className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Client Assignments</h1>
          <p className="text-sm text-zinc-400 mt-1">Assign clients to specific Advertiser and Admin staff members.</p>
        </div>
      </div>

      <AssignmentManager 
        clients={clients || []} 
        staff={(staff as any) || []} 
        assignments={safeAssignments} 
      />
    </div>
  );
}
