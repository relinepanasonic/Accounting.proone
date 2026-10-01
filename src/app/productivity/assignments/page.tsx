import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { founderEmails } from '@/lib/auth/founders';
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
    .or('contact_type.eq.client,contact_type.is.null')
    .order('name');

  // Everyone who can hold a job: the workspace members, plus the founder (who may have no membership row).
  // profiles can't be embedded from workspace_members, so they are read in a second query.
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, display_name, email')
    .eq('workspace_id', activeWorkspaceId)
    .not('user_id', 'is', null)
    .in('role', ['superadmin', 'accounting', 'admin', 'advertiser']);

  const { data: founderProfiles } = await supabase.from('profiles').select('id, full_name, email').in('email', founderEmails());

  const ids = Array.from(new Set([...(members || []).map((m: any) => m.user_id as string), ...(founderProfiles || []).map((p: any) => p.id as string)]));
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] as any[] };
  const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
  const founderIds = new Set((founderProfiles || []).map((p: any) => p.id as string));

  const staffById = new Map<string, { user_id: string; role: string; name: string; email: string }>();
  for (const m of (members || []) as any[]) {
    const p = byId.get(m.user_id);
    const email = String(p?.email || m.email || '');
    staffById.set(m.user_id, {
      user_id: m.user_id,
      role: founderIds.has(m.user_id) ? 'founder' : m.role,
      name: String(p?.full_name || m.display_name || email.split('@')[0] || 'Unknown'),
      email,
    });
  }
  for (const f of (founderProfiles || []) as any[]) {
    if (staffById.has(f.id)) continue;
    staffById.set(f.id, { user_id: f.id, role: 'founder', name: String(f.full_name || f.email.split('@')[0]), email: String(f.email || '') });
  }
  const rank: Record<string, number> = { founder: 0, superadmin: 1, accounting: 2, admin: 3, advertiser: 4 };
  const staff = Array.from(staffById.values()).sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name));

  // All assignments. Before the job migration is run there is no job column: those rows count as advertising.
  let jobsReady = true;
  let { data: assignments, error } = await supabase
    .from('client_assignments')
    .select('client_id, user_id, job')
    .eq('workspace_id', activeWorkspaceId);
  if (error) {
    jobsReady = false;
    const legacy = await supabase.from('client_assignments').select('client_id, user_id').eq('workspace_id', activeWorkspaceId);
    assignments = (legacy.data || []).map((a: any) => ({ ...a, job: 'advertising' }));
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]">
          <Users className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Client Assignments</h1>
          <p className="text-sm text-zinc-400 mt-1">Pick a job, pick a person, then tick the clients they handle for that job.</p>
        </div>
      </div>

      {!jobsReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Only <b>Advertising</b> can be saved until <span className="font-mono">supabase/migrations/20260930_assignment_jobs.sql</span> is run in Supabase.
        </div>
      )}

      <AssignmentManager clients={clients || []} staff={staff} assignments={(assignments || []) as any} />
    </div>
  );
}
