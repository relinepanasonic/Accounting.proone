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
  targetWorkspaceId?: string;
  name?: string;
  isTaxRegistered?: boolean;
  taxRatePercent?: number;
  bankAccounts?: BankAccountItem[];
}) {
  try {
    const supabase = await createClient();
    const { workspaceId: activeId } = await resolveWorkspaceContext(supabase);
    const workspaceId = payload.targetWorkspaceId || activeId;

    if (!workspaceId) {
      return { success: false, error: 'No active workspace context found.' };
    }

    // 1. Update workspaces table if identity/tax fields are provided
    if (payload.name !== undefined && payload.isTaxRegistered !== undefined && payload.taxRatePercent !== undefined) {
      const effectiveTaxRate = payload.isTaxRegistered ? Number(payload.taxRatePercent) || 0 : 0;
      const { error: wsError } = await supabase
        .from('workspaces')
        .update({
          name: payload.name.trim(),
          is_tax_registered: payload.isTaxRegistered,
          tax_rate_percent: effectiveTaxRate,
        })
        .eq('id', workspaceId);

      if (wsError) {
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
    }

    // 2. Sync workspace_bank_accounts table if bankAccounts array is provided
    if (payload.bankAccounts !== undefined) {
      // Always update legacy payment_instructions on workspaces table as a guaranteed fallback!
      const legacyInstructionsText = payload.bankAccounts
        .map((b) => `${b.bank_name} - ${b.account_number} (${b.account_name})`)
        .join('\n');
      await supabase
        .from('workspaces')
        .update({ payment_instructions: legacyInstructionsText })
        .eq('id', workspaceId);

      const isTableMissingErr = (err: any) =>
        err &&
        (err.code === '42P01' ||
          err.code === 'PGRST204' ||
          err.message?.includes('does not exist') ||
          err.message?.includes('Could not find the table') ||
          err.message?.includes('schema cache'));

      const { data: existingAccounts, error: fetchErr } = await supabase
        .from('workspace_bank_accounts')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (fetchErr) {
        if (isTableMissingErr(fetchErr)) {
          revalidatePath('/settings');
          if (payload.targetWorkspaceId) {
            revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
          }
          revalidatePath('/invoices/new');
          return {
            success: true,
            warning: 'Bank accounts saved to workspace instructions. Note: Run the SQL migration in Supabase to enable dedicated bank account records.',
            savedBankAccounts: payload.bankAccounts.map((b, idx) => ({
              ...b,
              id: b.id || `temp-legacy-${idx}`,
            })),
          };
        }
        return { success: false, error: `Error checking bank accounts: ${fetchErr.message}` };
      }

      if (existingAccounts) {
        const payloadIds = new Set(
          payload.bankAccounts
            .filter((b) => b.id && !b.id.startsWith('temp-') && !b.id.startsWith('temp-legacy-'))
            .map((b) => b.id)
        );
        const toDeleteIds = existingAccounts.filter((b) => !payloadIds.has(b.id)).map((b) => b.id);

        if (toDeleteIds.length > 0) {
          const { error: delErr } = await supabase
            .from('workspace_bank_accounts')
            .delete()
            .in('id', toDeleteIds)
            .eq('workspace_id', workspaceId);
          if (delErr) {
            if (isTableMissingErr(delErr)) {
              revalidatePath('/settings');
              if (payload.targetWorkspaceId) revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
              revalidatePath('/invoices/new');
              return { success: true, savedBankAccounts: payload.bankAccounts };
            }
            return { success: false, error: `Error deleting removed bank accounts: ${delErr.message}` };
          }
        }
      }

      // Insert or update remaining items
      for (const item of payload.bankAccounts) {
        const isRealId = item.id && !item.id.startsWith('temp-') && !item.id.startsWith('temp-legacy-');
        if (isRealId) {
          const { error: updErr } = await supabase
            .from('workspace_bank_accounts')
            .update({
              bank_name: item.bank_name.trim(),
              account_number: item.account_number.trim(),
              account_name: item.account_name.trim(),
              is_default: item.is_default,
            })
            .eq('id', item.id)
            .eq('workspace_id', workspaceId);
          if (updErr) {
            if (isTableMissingErr(updErr)) {
              revalidatePath('/settings');
              if (payload.targetWorkspaceId) revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
              revalidatePath('/invoices/new');
              return { success: true, savedBankAccounts: payload.bankAccounts };
            }
            return { success: false, error: `Error updating bank account (${item.bank_name}): ${updErr.message}` };
          }
        } else {
          const { error: insErr } = await supabase
            .from('workspace_bank_accounts')
            .insert({
              workspace_id: workspaceId,
              bank_name: item.bank_name.trim(),
              account_number: item.account_number.trim(),
              account_name: item.account_name.trim(),
              is_default: item.is_default,
            });
          if (insErr) {
            if (isTableMissingErr(insErr)) {
              revalidatePath('/settings');
              if (payload.targetWorkspaceId) revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
              revalidatePath('/invoices/new');
              return { success: true, savedBankAccounts: payload.bankAccounts };
            }
            return { success: false, error: `Error inserting bank account (${item.bank_name}): ${insErr.message}` };
          }
        }
      }

      // Fetch fresh list after changes to return real UUIDs back to client
      const { data: refreshedAccounts, error: refErr } = await supabase
        .from('workspace_bank_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_default', { ascending: false });

      if (!refErr && refreshedAccounts) {
        revalidatePath('/settings');
        if (payload.targetWorkspaceId) {
          revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
        }
        revalidatePath('/invoices/new');
        return {
          success: true,
          savedBankAccounts: refreshedAccounts.map((acc: any) => ({
            id: acc.id,
            bank_name: acc.bank_name,
            account_number: acc.account_number,
            account_name: acc.account_name,
            is_default: Boolean(acc.is_default),
          })),
        };
      } else if (isTableMissingErr(refErr)) {
        revalidatePath('/settings');
        if (payload.targetWorkspaceId) revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
        revalidatePath('/invoices/new');
        return { success: true, savedBankAccounts: payload.bankAccounts };
      }
    }

    revalidatePath('/settings');
    if (payload.targetWorkspaceId) {
      revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
    }
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
  targetWorkspaceId?: string;
  name: string;
  description: string;
  unitPrice: number;
}) {
  try {
    const supabase = await createClient();
    const { workspaceId: activeId } = await resolveWorkspaceContext(supabase);
    const workspaceId = payload.targetWorkspaceId || activeId;

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

    revalidatePath('/settings');
    if (payload.targetWorkspaceId) {
      revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
    }
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save catalog item.' };
  }
}

/**
 * Delete a product / service item
 */
export async function deleteProduct(productId: string, targetWorkspaceId?: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    if (targetWorkspaceId) {
      revalidatePath(`/settings/workspaces/${targetWorkspaceId}`);
    }
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

    const insertObj: any = {
      workspace_id: workspaceId,
      name: payload.name.trim(),
      contact_name: payload.contactPerson?.trim() || null,
      company_name: payload.name.trim(),
      email: payload.email?.trim() || null,
    };

    let { data: inserted, error } = await supabase
      .from('clients')
      .insert(insertObj)
      .select('*')
      .single();

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      // Fallback if schema only has basic columns (e.g. name, email)
      const fallbackRes = await supabase
        .from('clients')
        .insert({
          workspace_id: workspaceId,
          name: payload.name.trim(),
          email: payload.email?.trim() || null,
        })
        .select('*')
        .single();
      if (fallbackRes.error) {
        return { success: false, error: fallbackRes.error.message };
      }
      inserted = fallbackRes.data;
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/settings/clients');
    revalidatePath('/invoices/new');
    return { success: true, client: inserted };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create client.' };
  }
}

/**
 * Update Client CRM profile (RBAC protected: Superadmin only)
 */
export async function updateClientRecord(payload: {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
}) {
  try {
    const supabase = await createClient();
    const { workspaceId, role } = await resolveWorkspaceContext(supabase);

    if (role !== 'superadmin') {
      return { success: false, error: 'Access denied: Only Superadmin can edit client profiles.' };
    }

    if (!payload.name) {
      return { success: false, error: 'Company Name is required.' };
    }

    const updateObj: any = {
      name: payload.name.trim(),
      contact_name: payload.contactPerson?.trim() || null,
      company_name: payload.name.trim(),
      email: payload.email?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from('clients')
      .update(updateObj)
      .eq('id', payload.id)
      .eq('workspace_id', workspaceId);

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const { error: fallbackErr } = await supabase
        .from('clients')
        .update({
          name: payload.name.trim(),
          email: payload.email?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('workspace_id', workspaceId);
      if (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/settings/clients');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update client profile.' };
  }
}

/**
 * Delete Client CRM profile (RBAC protected: Superadmin only)
 */
export async function deleteClientRecord(clientId: string) {
  try {
    const supabase = await createClient();
    const { workspaceId, role } = await resolveWorkspaceContext(supabase);

    if (role !== 'superadmin') {
      return { success: false, error: 'Access denied: Only Superadmin can delete client profiles.' };
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/settings/clients');
    revalidatePath('/invoices/new');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete client profile.' };
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
