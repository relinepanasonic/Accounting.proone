import React from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { founderEmails, isFounderEmail } from '@/lib/auth/founders';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  founder: 'Founder', superadmin: 'Superadmin', accounting: 'Accounting', admin: 'Admin', advertiser: 'Advertiser', sales: 'Sales', client: 'Client',
};
const ROLE_ORDER = ['founder', 'superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'];

const since = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '-';

/** HRD > Employee Directory: everyone who works in this workspace, with role and contact. */
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

  const db = createAdminClient();
  const { data: members } = await db.from('workspace_members').select('user_id, role, created_at').eq('workspace_id', ctx.activeWorkspaceId);
  const ids = (members || []).map((m: any) => m.user_id).filter(Boolean);
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, email, phone').in('id', ids) : { data: [] as any[] };
  const { data: founderProfiles } = await db.from('profiles').select('id, full_name, email, phone').in('email', founderEmails());

  const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
  const people = (members || []).map((m: any) => {
    const p = byId.get(m.user_id);
    const email = p?.email || '';
    return { id: m.user_id as string, name: p?.full_name || email.split('@')[0] || 'Staff', email, phone: p?.phone || '', role: isFounderEmail(email) ? 'founder' : m.role, since: m.created_at as string | null };
  });
  // The founder is not a member row in every workspace, but belongs in the directory.
  for (const f of founderProfiles || []) {
    if (!people.some((x) => x.id === f.id)) people.push({ id: f.id, name: f.full_name || f.email.split('@')[0], email: f.email, phone: f.phone || '', role: 'founder', since: null });
  }

  // Founders are only visible to the founder, like on the Team page. Clients with a login are not staff.
  const visible = people
    .filter((p) => (ctx.role === 'founder' ? true : p.role !== 'founder') && p.role !== 'client')
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 lg:px-6 animate-in fade-in duration-300">
      <div className="border-b border-[#d4af37]/20 pb-4">
        <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><Users className="h-5 w-5 text-[#d4af37]" /> Employee Directory</h1>
        <p className="mt-1 text-xs text-zinc-500">{ctx.activeWorkspaceName} · {visible.length} people. Add or remove people on the Team &amp; invites page (from the workspace chooser).</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d4af37]/20 bg-[#0e0f14] shadow-xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Phone</th>
              <th className="px-4 py-3 font-bold">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {visible.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No people found.</td></tr>}
            {visible.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/30">
                <td className="px-4 py-3 font-bold text-zinc-100">{p.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-[#d4af37]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f5d77f]">{ROLE_LABEL[p.role] || p.role}</span>
                </td>
                <td className="px-4 py-3 text-zinc-300">{p.email || '-'}</td>
                <td className="px-4 py-3 text-zinc-300">{p.phone || '-'}</td>
                <td className="px-4 py-3 text-zinc-500">{since(p.since)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
