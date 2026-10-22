'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';

const BUCKET = 'fake-order-proofs';
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MIGRATION_HINT = 'Run supabase/migrations/20261017_fake_order_projects.sql in Supabase first.';

export interface FakeOrderRow { id: string; projectId: string | null; clientId: string | null; clientName: string; orderNo: string; buyerName: string; total: number; proofUrl: string; createdAt: string }
export interface FakeOrderProject { id: string; clientId: string | null; clientName: string; invoiceId: string | null; invoiceNumber: string; productName: string; startDate: string; finishedAt: string | null }

type Result = { success: boolean; error?: string };
const isMissing = (e: { code?: string; message: string }) => e.code === '42P01' || e.code === '42703' || /fake_order_projects|project_id/.test(e.message);

async function allowed() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  return { supabase, ctx, ok: FINANCE_ROLES.includes(ctx.role) };
}

/** Start a project for a client invoice (Friends Order / Paket Optimize Shopee New Store). The start date is put by hand. */
export async function createFakeOrderProject(input: { clientId: string; clientName: string; invoiceId: string; invoiceNumber: string; productName: string; startDate: string }): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { success: false, error: 'Choose the start date.' };
    const { error } = await supabase.from('fake_order_projects').insert({
      workspace_id: ctx.activeWorkspaceId, client_id: input.clientId, client_name: input.clientName, invoice_id: input.invoiceId,
      invoice_number: input.invoiceNumber, product_name: input.productName, start_date: input.startDate, created_by: ctx.userId,
    });
    if (error) return { success: false, error: isMissing(error) ? MIGRATION_HINT : error.code === '23505' ? 'That invoice already has a project.' : error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not start the project.' };
  }
}

/** Finish a project: it moves to the Finished page. A renewal is a new invoice, which starts a new project. */
export async function finishFakeOrderProject(id: string, finishedAt: string): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(finishedAt)) return { success: false, error: 'Choose the finish date.' };
    const { data, error } = await supabase.from('fake_order_projects').update({ finished_at: finishedAt }).eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.message };
    return data && data.length ? { success: true } : { success: false, error: 'Project not found.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not finish.' };
  }
}

/** Put a finished project back to active (a wrong finish). */
export async function reopenFakeOrderProject(id: string): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };
    const { data, error } = await supabase.from('fake_order_projects').update({ finished_at: null }).eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.message };
    return data && data.length ? { success: true } : { success: false, error: 'Project not found.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not reopen.' };
  }
}

export async function deleteFakeOrderProject(id: string): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };
    const { data, error } = await supabase.from('fake_order_projects').delete().eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.message };
    return data && data.length ? { success: true } : { success: false, error: 'Project not found.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not delete.' };
  }
}

/** Add one fake order (with its proof image) to a project. */
export async function addFakeOrder(formData: FormData): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };

    const projectId = String(formData.get('projectId') || '');
    const orderNo = String(formData.get('orderNo') || '').trim();
    const buyerName = String(formData.get('buyerName') || '').trim();
    const total = Number(String(formData.get('total') || '0').replace(/[^\d.-]/g, ''));
    if (!projectId) return { success: false, error: 'Choose the project.' };
    if (!orderNo) return { success: false, error: 'Fill the Fake Order number.' };
    if (!Number.isFinite(total) || total < 0) return { success: false, error: 'Check the total.' };

    const { data: project, error: pErr } = await supabase.from('fake_order_projects').select('id, client_id, client_name, finished_at').eq('id', projectId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (pErr) return { success: false, error: isMissing(pErr) ? MIGRATION_HINT : pErr.message };
    if (!project) return { success: false, error: 'That project is not in this company.' };
    if (project.finished_at) return { success: false, error: 'That project is finished.' };

    let proofUrl: string | null = null;
    const file = formData.get('proof');
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith('image/')) return { success: false, error: 'The proof must be an image (screenshot).' };
      if (file.size > MAX_PROOF_BYTES) return { success: false, error: 'The proof is bigger than 5 MB.' };
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
      const path = `${ctx.activeWorkspaceId}/${crypto.randomUUID()}.${ext}`;
      const admin = createAdminClient();
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (upErr) return { success: false, error: /bucket/i.test(upErr.message) ? 'Run supabase/migrations/20261016_fake_orders.sql in Supabase first.' : upErr.message };
      proofUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('fake_orders').insert({
      workspace_id: ctx.activeWorkspaceId, project_id: project.id, client_id: project.client_id, client_name: project.client_name, order_no: orderNo,
      buyer_name: buyerName || null, total, proof_url: proofUrl, created_by: ctx.userId,
    });
    if (error) return { success: false, error: isMissing(error) ? MIGRATION_HINT : error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save.' };
  }
}

export async function deleteFakeOrder(id: string): Promise<Result> {
  try {
    const { supabase, ctx, ok } = await allowed();
    if (!ok) return { success: false, error: 'Not allowed.' };
    const { data: row } = await supabase.from('fake_orders').select('proof_url').eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    const { data, error } = await supabase.from('fake_orders').delete().eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).select('id');
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'Not found.' };
    const marker = `/${BUCKET}/`;
    if (row?.proof_url && row.proof_url.includes(marker)) {
      await createAdminClient().storage.from(BUCKET).remove([row.proof_url.split(marker)[1]]).catch(() => undefined);
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not delete.' };
  }
}
