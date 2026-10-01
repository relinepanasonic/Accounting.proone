'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { loadPeople, nameKeys } from '@/lib/productivity/activity';
import { revalidatePath } from 'next/cache';

const isOwner = (role: string) => role === 'founder' || role === 'superadmin';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/** May this person act on this client for this job? Owners always; staff only for clients assigned to them. */
async function mayHandle(clientId: string, job: 'admin' | 'sales') {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId) return { ok: false as const, error: 'Not signed in.' };
  const db = createAdminClient();

  const { data: client } = await db.from('clients').select('id, workspace_id').eq('id', clientId).maybeSingle();
  if (!client || client.workspace_id !== ctx.activeWorkspaceId) return { ok: false as const, error: 'Client not found.' };
  if (isOwner(ctx.role)) return { ok: true as const, ctx, db };

  const { data: a } = await db.from('client_assignments').select('client_id').eq('client_id', clientId).eq('user_id', ctx.userId).eq('job', job).limit(1);
  if (a && a.length) return { ok: true as const, ctx, db };

  if (job === 'sales') {
    // A salesperson also looks after the clients of their own deals.
    const person = (await loadPeople(db, ctx.activeWorkspaceId, ctx.userId))[0];
    if (person) {
      const keys = nameKeys(person);
      const { data: deals } = await db.from('crm_deals').select('salesman_name').eq('workspace_id', ctx.activeWorkspaceId).eq('client_id', clientId);
      if ((deals || []).some((d: any) => keys.has(String(d.salesman_name || '').trim().toLowerCase()))) return { ok: true as const, ctx, db };
    }
  }
  return { ok: false as const, error: 'This client is not assigned to you.' };
}

export async function setMonthlyReportSent(clientId: string, month: string, sent: boolean) {
  if (!MONTH.test(month)) return { success: false, error: 'Bad month.' };
  const gate = await mayHandle(clientId, 'admin');
  if (!gate.ok) return { success: false, error: gate.error };
  const { ctx, db } = gate;

  const { error } = sent
    ? await db.from('client_monthly_reports').upsert(
        { workspace_id: ctx.activeWorkspaceId, client_id: clientId, month, sent_by: ctx.userId, sent_at: new Date().toISOString() },
        { onConflict: 'client_id,month' }
      )
    : await db.from('client_monthly_reports').delete().eq('client_id', clientId).eq('month', month);
  if (error) return { success: false, error: error.message.includes('client_monthly_reports') ? 'Run supabase/migrations/20260930_kpi.sql in Supabase first.' : error.message };

  revalidatePath('/productivity/me');
  revalidatePath('/productivity/person', 'layout');
  return { success: true };
}

export async function setClientServiceEnd(clientId: string, endDate: string | null) {
  if (endDate !== null && !DAY.test(endDate)) return { success: false, error: 'Bad date.' };
  const gate = await mayHandle(clientId, 'sales');
  if (!gate.ok) return { success: false, error: gate.error };

  const { error } = await gate.db.from('clients').update({ service_end_date: endDate }).eq('id', clientId).eq('workspace_id', gate.ctx.activeWorkspaceId);
  if (error) return { success: false, error: error.message.includes('service_end_date') ? 'Run supabase/migrations/20260930_kpi.sql in Supabase first.' : error.message };

  revalidatePath('/productivity/me');
  revalidatePath('/productivity/person', 'layout');
  return { success: true };
}
