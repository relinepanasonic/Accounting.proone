'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

// Absensi
export async function getMonthlyAbsensi(month: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sales_attendance')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .eq('user_id', user.id)
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`)
    .order('date', { ascending: false });

  // If table doesn't exist yet, return empty
  if (error && error.message.includes('sales_attendance')) return [];
  if (error) throw new Error(error.message);
  return data || [];
}

export async function submitCheckIn(photoBase64: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('sales_attendance')
    .upsert({
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      date: today,
      check_in_time: new Date().toISOString(),
      check_in_photo: photoBase64
    }, { onConflict: 'workspace_id,user_id,date' });

  if (error) throw new Error(error.message);
  revalidatePath('/sales/absensi');
}

export async function submitCheckOut(photoBase64: string) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  // We must update the existing record for today
  const { error } = await supabase
    .from('sales_attendance')
    .update({
      check_out_time: new Date().toISOString(),
      check_out_photo: photoBase64
    })
    .eq('workspace_id', activeWorkspaceId)
    .eq('user_id', user.id)
    .eq('date', today);

  if (error) throw new Error(error.message);
  revalidatePath('/sales/absensi');
}

// Reimbursement
export async function getReimbursements() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data, error } = await supabase
    .from('sales_reimbursements')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .order('created_at', { ascending: false });

  if (error && error.message.includes('sales_reimbursements')) return [];
  if (error) throw new Error(error.message);
  return data || [];
}

export async function submitReimbursement(formData: FormData) {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload = {
    workspace_id: activeWorkspaceId,
    user_id: user.id,
    client_name: formData.get('client_name') as string,
    brand: formData.get('brand') as string,
    shopee_store: formData.get('shopee_store') as string,
    phone: formData.get('phone') as string,
    resto_name: formData.get('resto_name') as string,
    notes: formData.get('notes') as string,
    total_amount: parseFloat((formData.get('total_amount') as string).replace(/,/g, '')),
    receipt_photo: formData.get('receipt_photo') as string,
    client_photo: formData.get('client_photo') as string,
  };

  const { error } = await supabase.from('sales_reimbursements').insert(payload);

  if (error) throw new Error(error.message);
  revalidatePath('/sales/reimbursement');
}
