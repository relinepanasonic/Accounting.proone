'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export interface BankAccountItem {
  id?: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
}

async function resolveWorkspaceContext(supabase: any) {
  const wsCtx = await getAuthenticatedWorkspaceContext();
  if (wsCtx && wsCtx.activeWorkspaceId) {
    return {
      userId: wsCtx.userId,
      workspaceId: wsCtx.activeWorkspaceId,
      role: wsCtx.role,
    };
  }

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
 * Save Workspace General Settings & Dynamic Bank Accounts
 */
export async function saveWorkspaceSettings(payload: {
  name: string;
  isTaxRegistered: boolean;
  taxRatePercent: number;
  bankAccounts: BankAccountItem[];
}) {
  try {
    const supabase = await createClient();
    const { workspaceId } = await resolveWorkspaceContext(supabase);

    if (!workspaceId) {
      return { success: false, error: 'No active workspace context found.' };
    }

    const effectiveTaxRate = payload.isTaxRegistered ? Number(payload.taxRatePercent) || 0 : 0;

    // 1. Update workspaces table
    const { error: wsError } = await supabase
      .from('workspaces')
      .update({
        name: payload.name.trim(),
        is_tax_registered: payload.isTaxRegistered,
        tax_rate_percent: effectiveTaxRate,
      })
      .eq('id', workspaceId);

    if (wsError) {
      // Resilient fallback if is_tax_registered column hasn't been migrated yet
      if (wsError.message?.includes('column') || wsError.code === '42703') {
        const { error: fallbackErr } = await supabase
          .from('workspaces')
          .update({
            name: payload.name.trim(),
            tax_rate_percent: effectiveTaxRate,
          })
          .eq('id', workspaceId);
        if (fallbackErr) {
          return { success: false, error: fallbackErr.message };
        }
      } else {
        return { success: false, error: wsError.message };
      }
    }

    // 2. Sync workspace_bank_accounts table
    const { data: existingAccounts, error: fetchErr } = await supabase
      .from('workspace_bank_accounts')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (!fetchErr && existingAccounts) {
      const payloadIds = new Set(payload.bankAccounts.filter((b) => b.id && !b.id.startsWith('temp-')).map((b) => b.id));
      const toDeleteIds = existingAccounts.filter((b) => !payloadIds.has(b.id)).map((b) => b.id);

      if (toDeleteIds.length > 0) {
        await supabase
          .from('workspace_bank_accounts')
          .delete()
          .in('id', toDeleteIds)
          .eq('workspace_id', workspaceId);
      }
    }

    // Insert or update remaining items
    for (const item of payload.bankAccounts) {
      if (item.id && !item.id.startsWith('temp-')) {
        await supabase
          .from('workspace_bank_accounts')
          .update({
            bank_name: item.bank_name.trim(),
            account_number: item.account_number.trim(),
            account_name: item.account_name.trim(),
            is_default: item.is_default,
          })
          .eq('id', item.id)
          .eq('workspace_id', workspaceId);
      } else {
        await supabase
          .from('workspace_bank_accounts')
          .insert({
            workspace_id: workspaceId,
            bank_name: item.bank_name.trim(),
            account_number: item.account_number.trim(),
            account_name: item.account_name.trim(),
            is_default: item.is_default,
          });
      }
    }

    revalidatePath('/settings');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save workspace settings.' };
  }
}

/**
 * Update Workspace General Settings (Legacy wrapper around basic update)
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
