'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';

const BUCKET = 'fake-order-proofs';
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export interface FakeOrderRow { id: string; clientId: string | null; clientName: string; orderNo: string; buyerName: string; total: number; proofUrl: string; createdAt: string }

/** Add one fake order with its proof (an image). Needs supabase/migrations/20261016_fake_orders.sql. */
export async function addFakeOrder(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };

    const clientId = String(formData.get('clientId') || '') || null;
    const orderNo = String(formData.get('orderNo') || '').trim();
    const buyerName = String(formData.get('buyerName') || '').trim();
    const total = Number(String(formData.get('total') || '0').replace(/[^\d.-]/g, ''));
    if (!clientId) return { success: false, error: 'Choose the client.' };
    if (!orderNo) return { success: false, error: 'Fill the Fake Order number.' };
    if (!Number.isFinite(total) || total < 0) return { success: false, error: 'Check the total.' };

    const { data: client } = await supabase.from('clients').select('id, name').eq('id', clientId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!client) return { success: false, error: 'That client is not in this company.' };

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
      workspace_id: ctx.activeWorkspaceId, client_id: client.id, client_name: client.name, order_no: orderNo,
      buyer_name: buyerName || null, total, proof_url: proofUrl, created_by: ctx.userId,
    });
    if (error) return { success: false, error: error.code === '42P01' ? 'Run supabase/migrations/20261016_fake_orders.sql in Supabase first.' : error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not save.' };
  }
}

export async function deleteFakeOrder(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return { success: false, error: 'Not allowed.' };
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
