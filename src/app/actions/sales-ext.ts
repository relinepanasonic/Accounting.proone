'use server';

import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { revalidatePath } from 'next/cache';

// Absensi
export async function getMonthlyAbsensi(month: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('sales_attendance')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', user.id)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .order('date', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function submitCheckIn(photoBase64: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

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

    if (error) return { error: error.message };
    
    revalidatePath('/sales/absensi');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function submitCheckOut(photoBase64: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('sales_attendance')
      .update({
        check_out_time: new Date().toISOString(),
        check_out_photo: photoBase64
      })
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', user.id)
      .eq('date', today);

    if (error) return { error: error.message };
    
    revalidatePath('/sales/absensi');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// Reimbursement
export async function getReimbursements() {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

    const { data, error } = await supabase
      .from('sales_reimbursements')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function submitReimbursement(formData: FormData) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

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

    if (error) return { error: error.message };
    
    revalidatePath('/sales/reimbursement');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}


// Tasks & Schedule
export async function getTasks(dateStr?: string) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('sales_tasks')
      .select('*')
      .eq('workspace_id', activeWorkspaceId)
      .eq('user_id', user.id)
      .order('priority', { ascending: true }) // High first maybe, but we'll sort in client
      .order('created_at', { ascending: false });
      
    if (dateStr) {
      // Filter by date if needed
    }

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const priority = formData.get('priority') as string;
    const scheduled_time = formData.get('scheduled_time') as string;

    const payload: any = {
      workspace_id: activeWorkspaceId,
      user_id: user.id,
      title,
      type: type || 'task',
      priority: priority || 'Medium',
    };
    if (scheduled_time) payload.scheduled_time = scheduled_time;

    const { error } = await supabase.from('sales_tasks').insert(payload);
    if (error) return { error: error.message };
    
    revalidatePath('/sales/todo');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function toggleTaskComplete(taskId: string, currentStatus: boolean) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('sales_tasks')
      .update({ completed: !currentStatus })
      .eq('id', taskId);

    if (error) return { error: error.message };
    revalidatePath('/sales/todo');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
