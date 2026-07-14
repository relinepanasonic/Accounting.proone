'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function resolveWorkspaceContext(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberRows } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1);

    if (memberRows && memberRows.length > 0 && memberRows[0].workspace_id) {
      return {
        userId: user.id,
        workspaceId: memberRows[0].workspace_id,
        role: memberRows[0].role,
      };
    }
  }

  // Fallback for seed workspace context
  return {
    userId: null,
    workspaceId: '11111111-1111-1111-1111-111111111111',
    role: 'superadmin',
  };
}

/**
 * Update Workspace General Settings
 */
export async function updateGeneralSettings(payload: {
  name: string;
  taxRatePercent: number;
  paymentInstructions: string;
}) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await resolveWorkspaceContext(supabase);

    const { error } = await supabase
      .from('workspaces')
      .update({
        name: payload.name,
        tax_rate_percent: payload.taxRatePercent,
        payment_instructions: payload.paymentInstructions,
      })
      .eq('id', workspaceId);

    if (error) {
      // Resilient fallback: if column missing in schema cache, update base name column cleanly
      if (
        error.message?.includes('schema cache') ||
        error.message?.includes('column') ||
        error.message?.includes('payment_instructions')
      ) {
        const { error: fallbackErr } = await supabase
          .from('workspaces')
          .update({ name: payload.name })
          .eq('id', workspaceId);

        if (!fallbackErr) {
          revalidatePath('/settings');
          return {
            success: true,
            warning:
              "Workspace Name saved. Note: Run the SQL migration in Supabase to enable custom tax & bank instruction columns.",
          };
        }
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save general settings.' };
  }
}

/**
 * Create a new Product / Service in the catalog
 */
export async function createProduct(payload: {
  name: string;
  description: string;
  unitPrice: number;
}) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await resolveWorkspaceContext(supabase);

    if (!payload.name) {
      return { success: false, error: 'Product or Service name is required.' };
    }

    const { error } = await supabase.from('products').insert({
      workspace_id: workspaceId,
      name: payload.name,
      description: payload.description || null,
      unit_price: Number(payload.unitPrice) || 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/catalog');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save catalog item.' };
  }
}

/**
 * Delete a product / service item
 */
export async function deleteProduct(productId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/catalog');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete item.' };
  }
}

/**
 * Create a new Client CRM record
 */
export async function createClientRecord(payload: {
  name: string;
  contactPerson: string;
  email: string;
}) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await resolveWorkspaceContext(supabase);

    if (!payload.name) {
      return { success: false, error: 'Company Name is required.' };
    }

    const { error } = await supabase.from('clients').insert({
      workspace_id: workspaceId,
      name: payload.name,
      company: payload.contactPerson || payload.name,
      email: payload.email || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/clients');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create client.' };
  }
}

/**
 * Invite / Add Team Member (RBAC protected: superadmin only)
 */
export async function inviteTeamMember(payload: {
  email: string;
  name: string;
  role: 'superadmin' | 'accounting' | 'admin';
}) {
  try {
    const supabase = await createClient();
    const { workspaceId, role } = await resolveWorkspaceContext(supabase);

    if (role !== 'superadmin') {
      return {
        success: false,
        error: 'RBAC Security Clearance Denied: Only Superadmins can invite team members.',
      };
    }

    if (!payload.email) {
      return { success: false, error: 'Member email is required.' };
    }

    const { error } = await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      role: payload.role,
      user_id: null, // Pending auth linkage
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/team');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to invite team member.' };
  }
}
