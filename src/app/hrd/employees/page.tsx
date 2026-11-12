import React from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { founderEmails, isFounderEmail } from '@/lib/auth/founders';
import { EmployeeDirectory, type Person, type PendingEmployeeInvite } from '@/components/hrd/EmployeeDirectory';

export const dynamic = 'force-dynamic';

const ROLE_ORDER = ['founder', 'superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'];

/**
 * HRD > Employee Directory: everyone who works in this company, and the place to add them. An employee is also a user of the company:
 * adding one creates an invitation with the role, the employment status (Tetap / Freelance, for tax) and the companies they can enter.
 */
export default async function EmployeeDirectoryPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">The Employee Directory is for accounting, admin, superadmin and the founder.</p>
      </div>
    );
  }
  const isOwner = ctx.role === 'superadmin' || ctx.role === 'founder';

  const db = createAdminClient();
  let membersRes: any = await db.from('workspace_members').select('id, user_id, role, created_at, employment_status').eq('workspace_id', ctx.activeWorkspaceId);
  if (membersRes.error) membersRes = await db.from('workspace_members').select('id, user_id, role, created_at').eq('workspace_id', ctx.activeWorkspaceId); // before 20261114_employment_status.sql
  const members: any[] = membersRes.data || [];
  const ids = members.map((m) => m.user_id).filter(Boolean);
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email, phone').in('id', ids) : { data: [] as any[] };
  const { data: founderProfiles } = await db.from('profiles').select('id, full_name, email, phone').in('email', founderEmails());

  // The companies this viewer manages: a person's access to them is shown and can be changed.
  const manageable = ctx.availableWorkspaces.filter((w) => w.role === 'founder' || w.role === 'superadmin').map((w) => ({ id: w.id, name: w.name }));
  const accessByUser = new Map<string, string[]>();
  if (ids.length && manageable.length) {
    const { data: access } = await db.from('workspace_members').select('user_id, workspace_id').in('workspace_id', manageable.map((w) => w.id)).in('user_id', ids);
    for (const a of access || []) accessByUser.set(a.user_id, [...(accessByUser.get(a.user_id) || []), a.workspace_id]);
  }

  const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
  const people: Person[] = members.map((m) => {
    const p = byId.get(m.user_id);
    const email = p?.email || '';
    return {
      memberId: m.id as string,
      userId: m.user_id as string,
      name: p?.full_name || email.split('@')[0] || 'Staff',
      email,
      phone: p?.phone || '',
      role: isFounderEmail(email) ? 'founder' : m.role,
      status: m.employment_status === 'tetap' || m.employment_status === 'freelance' ? m.employment_status : null,
      since: (m.created_at as string | null) || null,
      workspaceIds: accessByUser.get(m.user_id) || [ctx.activeWorkspaceId],
      isCurrentUser: m.user_id === ctx.userId,
    };
  });
  // The founder is not a member row in every company, but belongs in the directory.
  for (const f of founderProfiles || []) {
    if (!people.some((x) => x.userId === f.id)) {
      people.push({ memberId: null, userId: f.id, name: f.full_name || f.email.split('@')[0], email: f.email, phone: f.phone || '', role: 'founder', status: null, since: null, workspaceIds: manageable.map((w) => w.id), isCurrentUser: f.id === ctx.userId });
    }
  }

  // Founders are only visible to the founder. Clients with a login are not staff.
  const visible = people
    .filter((p) => (ctx.role === 'founder' ? true : p.role !== 'founder') && p.role !== 'client')
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));

  // Invitations that were not used yet (an employee that was added but has not opened the link).
  let pending: PendingEmployeeInvite[] = [];
  if (isOwner && manageable.length) {
    const { data: inviteRows } = await db
      .from('workspace_invites')
      .select('id, full_name, role, workspace_ids, expires_at')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .overlaps('workspace_ids', manageable.map((w) => w.id))
      .order('created_at', { ascending: false });
    pending = (inviteRows || []).map((i: any) => ({ id: i.id, fullName: i.full_name, role: i.role, expiresAt: i.expires_at, workspaceIds: i.workspace_ids }));
  }

  return (
    <div className="space-y-6 p-4 lg:p-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-[#d4af37]/10 p-3 text-[#d4af37]"><Users className="h-7 w-7" /></div>
        <div>
          <h1 className="font-serif text-2xl font-extrabold text-zinc-100">Employee Directory</h1>
          <p className="mt-1 text-sm text-zinc-400">{ctx.activeWorkspaceName} · everyone who works here. An employee is also a user of the company: add them here, set their role, tax status and the companies they can enter.</p>
        </div>
      </div>
      <EmployeeDirectory
        people={visible}
        companies={manageable}
        activeWorkspaceId={ctx.activeWorkspaceId}
        currentUserRole={ctx.role}
        canManage={isOwner}
        canSetStatus={isOwner || ctx.role === 'accounting'}
        pendingInvites={pending}
      />
    </div>
  );
}
