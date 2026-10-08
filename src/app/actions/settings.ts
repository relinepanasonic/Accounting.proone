'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isFounderEmail } from '@/lib/auth/founders';

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

  // No session / no membership: no access (never default to a workspace or a role).
  return {
    userId: null,
    workspaceId: '',
    role: 'none',
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
  logoUrl?: string;
  brandTagline?: string;
  tagline?: string;
  contactPhone?: string;
  phone?: string;
  officialEmail?: string;
  email?: string;
  websiteUrl?: string;
  website?: string;
  bankAccounts?: BankAccountItem[];
}) {
  try {
    const supabase = await createClient();
    const { workspaceId: activeId } = await resolveWorkspaceContext(supabase);
    const workspaceId = payload.targetWorkspaceId || activeId;

    if (!workspaceId) {
      return { success: false, error: 'No active workspace context found.' };
    }

    // 1. Update workspaces table if identity/tax/brand fields are provided
    if (
      payload.name !== undefined ||
      payload.isTaxRegistered !== undefined ||
      payload.taxRatePercent !== undefined ||
      payload.logoUrl !== undefined ||
      payload.brandTagline !== undefined ||
      payload.tagline !== undefined ||
      payload.contactPhone !== undefined ||
      payload.phone !== undefined ||
      payload.officialEmail !== undefined ||
      payload.email !== undefined ||
      payload.websiteUrl !== undefined ||
      payload.website !== undefined
    ) {
      const effectiveTaxRate =
        payload.isTaxRegistered !== undefined
          ? payload.isTaxRegistered
            ? Number(payload.taxRatePercent) || 0
            : 0
          : undefined;

      const updatePayload: any = {};
      if (payload.name !== undefined) updatePayload.name = payload.name.trim();
      if (payload.isTaxRegistered !== undefined) updatePayload.is_tax_registered = payload.isTaxRegistered;
      if (effectiveTaxRate !== undefined) updatePayload.tax_rate_percent = effectiveTaxRate;
      if (payload.logoUrl !== undefined) {
        updatePayload.company_logo_url = payload.logoUrl.trim();
        updatePayload.logo_url = payload.logoUrl.trim();
      }
      if (payload.brandTagline !== undefined || payload.tagline !== undefined) {
        const val = (payload.brandTagline ?? payload.tagline ?? '').trim();
        updatePayload.brand_tagline = val;
        updatePayload.tagline = val;
      }
      if (payload.contactPhone !== undefined || payload.phone !== undefined) {
        const val = (payload.contactPhone ?? payload.phone ?? '').trim();
        updatePayload.contact_phone = val;
        updatePayload.phone = val;
      }
      if (payload.officialEmail !== undefined || payload.email !== undefined) {
        const val = (payload.officialEmail ?? payload.email ?? '').trim();
        updatePayload.official_email = val;
        updatePayload.email = val;
      }
      if (payload.websiteUrl !== undefined || payload.website !== undefined) {
        const val = (payload.websiteUrl ?? payload.website ?? '').trim();
        updatePayload.website_url = val;
        updatePayload.website = val;
      }

      let currentData = { ...updatePayload };
      let lastErr = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const { error } = await supabase
          .from('workspaces')
          .update(currentData)
          .eq('id', workspaceId);

        if (!error) {
          lastErr = null;
          break;
        }
        lastErr = error;
        // Catch both single and double quotes, e.g. "column 'email'" or "find the 'email' column"
        const colMatch =
          error.message?.match(/column ['"]([^'"]+)['"]/i) ||
          error.message?.match(/find the ['"]([^'"]+)['"] column/i);

        if (colMatch && colMatch[1] && colMatch[1] in currentData) {
          delete currentData[colMatch[1]];
        } else if (
          error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache') ||
          error.message?.includes('Could not find the')
        ) {
          // Strip new columns progressively if regex didn't match
          const optionalCols = [
            'brand_tagline',
            'contact_phone',
            'official_email',
            'website_url',
            'email',
            'phone',
            'website',
            'tagline',
            'company_logo_url',
            'logo_url',
            'tax_rate_percent',
            'is_tax_registered',
          ];
          let removedAny = false;
          for (const col of optionalCols) {
            if (col in currentData) {
              delete currentData[col];
              removedAny = true;
              break;
            }
          }
          if (!removedAny) {
            currentData = { name: (payload.name || '').trim() };
          }
        } else {
          break;
        }
      }

      if (lastErr) {
        return { success: false, error: lastErr.message };
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
          // 1. Generate new COA code (101X)
          const { data: coaAccounts } = await supabase
            .from('global_chart_of_accounts')
            .select('account_code')
            .eq('workspace_id', workspaceId)
            .like('account_code', '101%');
          
          let nextCode = 1011;
          if (coaAccounts && coaAccounts.length > 0) {
            const codes = coaAccounts.map(c => parseInt(c.account_code, 10)).filter(c => !isNaN(c));
            if (codes.length > 0) {
              nextCode = Math.max(...codes) + 1;
            }
          }
          const accountCodeStr = nextCode.toString();

          // 2. Insert into COA
          await supabase.from('global_chart_of_accounts').insert({
            workspace_id: workspaceId,
            account_code: accountCodeStr,
            account_name: `${item.bank_name} - ${item.account_number.slice(-4)}`,
            account_type: 'Asset',
            description: `Auto-generated for ${item.account_name}`,
            parent_code: '1010', // Assuming 1010 is the parent Cash on Hand/Bank
            is_active: true
          });

          // 3. Insert into workspace_bank_accounts
          const { error: insErr } = await supabase
            .from('workspace_bank_accounts')
            .insert({
              workspace_id: workspaceId,
              bank_name: item.bank_name.trim(),
              account_number: item.account_number.trim(),
              account_name: item.account_name.trim(),
              is_default: item.is_default,
              coa_account_code: accountCodeStr
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
    revalidatePath('/settings/contacts');
    revalidatePath('/vendors');
    revalidatePath('/optimizing/clients');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save general settings.' };
  }
}

type ProjectLength = { durationType?: 'none' | 'day' | 'month' | 'deliverable'; durationValue?: number; deliverableUnit?: string };

/** Catalog columns for "how long the project lasts". Left out entirely until the sales-flow migration has been run. */
function lengthColumns(p: ProjectLength) {
  const type = p.durationType && ['day', 'month', 'deliverable'].includes(p.durationType) ? p.durationType : 'none';
  return {
    duration_type: type,
    duration_value: type === 'none' ? 0 : Math.max(0, Math.round(Number(p.durationValue) || 0)),
    deliverable_unit: type === 'deliverable' ? String(p.deliverableUnit || 'video').trim().slice(0, 30) : null,
  };
}
const isMissingLengthColumn = (e: any) => e?.code === '42703' || e?.code === 'PGRST204' || /duration_type|duration_value|deliverable_unit/.test(e?.message || '');

/**
 * Create a new Product / Service in the catalog
 */
export async function createProduct(payload: {
  targetWorkspaceId?: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity?: number;
  scale?: string;
} & ProjectLength) {
  try {
    const supabase = await createClient();
    const { workspaceId: activeId } = await resolveWorkspaceContext(supabase);
    const workspaceId = payload.targetWorkspaceId || activeId;

    if (!payload.name) {
      return { success: false, error: 'Product or Service name is required.' };
    }

    const row = {
      workspace_id: workspaceId,
      name: payload.name,
      description: payload.description || null,
      unit_price: Number(payload.unitPrice) || 0,
      quantity: Number(payload.quantity) || 1,
      scale: payload.scale || 'pc',
    };
    const wanted = lengthColumns(payload);
    let { data: created, error } = await supabase.from('products').insert(wanted.duration_type === 'none' ? row : { ...row, ...wanted }).select('*').single();
    if (error && isMissingLengthColumn(error)) {
      if (wanted.duration_type !== 'none') return { success: false, error: 'Run supabase/migrations/20261003_sales_flow.sql in Supabase to save project lengths.' };
      ({ data: created, error } = await supabase.from('products').insert(row).select('*').single());
    }

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    if (payload.targetWorkspaceId) {
      revalidatePath(`/settings/workspaces/${payload.targetWorkspaceId}`);
    }
    revalidatePath('/invoices/new');
    revalidatePath('/optimizing/catalog');
    return { success: true, product: created };
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
 * Update an existing Product / Service in the catalog
 */
export async function updateProduct(payload: {
  id: string;
  targetWorkspaceId?: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity?: number;
  scale?: string;
} & ProjectLength) {
  try {
    const supabase = await createClient();
    if (!payload.id || !payload.name) {
      return { success: false, error: 'Product ID and Name are required.' };
    }

    const row = {
      name: payload.name,
      description: payload.description || null,
      unit_price: Number(payload.unitPrice) || 0,
      quantity: Number(payload.quantity) || 1,
      scale: payload.scale || 'pc',
    };
    const wanted = lengthColumns(payload);
    let { error } = await supabase.from('products').update({ ...row, ...wanted }).eq('id', payload.id);
    if (error && isMissingLengthColumn(error)) {
      if (wanted.duration_type !== 'none') return { success: false, error: 'Run supabase/migrations/20261003_sales_flow.sql in Supabase to save project lengths.' };
      ({ error } = await supabase.from('products').update(row).eq('id', payload.id));
    }

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
    return { success: false, error: err?.message || 'Failed to update catalog item.' };
  }
}

/**
 * Duplicate an existing Product / Service in the catalog
 */
export async function duplicateProduct(productId: string, targetWorkspaceId?: string) {
  try {
    const supabase = await createClient();
    const { workspaceId: activeId } = await resolveWorkspaceContext(supabase);
    const workspaceId = targetWorkspaceId || activeId;

    // Fetch existing item
    const { data: item, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchErr || !item) {
      return { success: false, error: 'Original product not found for duplication.' };
    }

    const { data: inserted, error } = await supabase.from('products').insert({
      workspace_id: workspaceId,
      name: `${item.name} (Copy)`,
      description: item.description || null,
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 1,
      scale: item.scale || 'pc',
    }).select('*').single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    if (targetWorkspaceId) {
      revalidatePath(`/settings/workspaces/${targetWorkspaceId}`);
    }
    revalidatePath('/invoices/new');
    return { success: true, product: inserted };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to duplicate item.' };
  }
}

/**
 * Create a new Client CRM record
 */
export async function createClientRecord(payload: {
  name: string;
  company_legal_name?: string;
  contactPerson?: string;
  email?: string;
  contactType?: 'client' | 'vendor';
  cloneWorkspaceIds?: string[];
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
      company_legal_name: payload.company_legal_name?.trim() || null,
      contact_name: payload.contactPerson?.trim() || null,
      company_name: payload.name.trim(),
      email: payload.email?.trim() || null,
      contact_type: payload.contactType || 'client',
    };

    let inserts = [insertObj];
    
    // Add cloned entries
    if (payload.cloneWorkspaceIds && payload.cloneWorkspaceIds.length > 0) {
      for (const targetWs of payload.cloneWorkspaceIds) {
        if (targetWs !== workspaceId) {
          inserts.push({
            ...insertObj,
            workspace_id: targetWs
          });
        }
      }
    }

    let { data: inserted, error } = await supabase
      .from('clients')
      .insert(inserts)
      .select('*');

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      // Fallback if schema only has basic columns (e.g. name, email)
      const fallbackInserts = inserts.map(obj => ({
        workspace_id: obj.workspace_id,
        name: obj.name,
        email: obj.email,
      }));
      
      const fallbackRes = await supabase
        .from('clients')
        .insert(fallbackInserts)
        .select('*');
      if (fallbackRes.error) {
        return { success: false, error: fallbackRes.error.message };
      }
      inserted = fallbackRes.data;
    } else if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/settings/contacts');
    revalidatePath('/vendors');
    revalidatePath('/optimizing/clients');
    revalidatePath('/invoices/new');

    // Return the specific client record for the active workspace so UI can update
    const activeClient = (inserted || []).find((c: any) => c.workspace_id === workspaceId) || (inserted || [])[0];
    return { success: true, client: activeClient };
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
  company_legal_name?: string;
  contactPerson?: string;
  email: string;
  cloneWorkspaceIds?: string[];
}) {
  try {
    const supabase = await createClient();
    const { workspaceId, role } = await resolveWorkspaceContext(supabase);

    if (!['superadmin', 'founder'].includes(role)) {
      return { success: false, error: 'Access denied: Only Superadmin can edit client profiles.' };
    }

    if (!payload.name) {
      return { success: false, error: 'Company Name is required.' };
    }

    let { data: existing } = await supabase.from('clients').select('contact_type').eq('id', payload.id).single();
    const originalContactType = existing?.contact_type || 'client';

    const updateObj: any = {
      name: payload.name.trim(),
      company_legal_name: payload.company_legal_name?.trim() || null,
      contact_name: payload.contactPerson?.trim() || null,
      company_name: payload.name.trim(),
      email: payload.email?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from('clients')
      .update(updateObj)
      .eq('id', payload.id);

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const { error: fallbackErr } = await supabase
        .from('clients')
        .update({
          name: payload.name.trim(),
          company_legal_name: payload.company_legal_name?.trim() || null,
          email: payload.email?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id);
      if (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
    } else if (error) {
      return { success: false, error: error.message };
    }

    if (payload.cloneWorkspaceIds && payload.cloneWorkspaceIds.length > 0) {
      const inserts = payload.cloneWorkspaceIds.map(wsId => ({
        workspace_id: wsId,
        name: updateObj.name,
        company_legal_name: updateObj.company_legal_name,
        contact_name: updateObj.contact_name,
        company_name: updateObj.company_name,
        email: updateObj.email,
        contact_type: originalContactType
      }));
      
      const { error: cloneErr } = await supabase.from('clients').insert(inserts);
      if (cloneErr && (cloneErr.message?.includes('column') || cloneErr.code === '42703')) {
         const fallbackInserts = payload.cloneWorkspaceIds.map(wsId => ({
          workspace_id: wsId,
          name: updateObj.name,
          email: updateObj.email,
        }));
        await supabase.from('clients').insert(fallbackInserts);
      }
      
      for (const wsId of payload.cloneWorkspaceIds) {
        revalidatePath(`/settings/workspaces/${wsId}`);
      }
    }

    // ── RE-SYNC INVOICES TO NEW WAVE ─────────────────────────────────────────
    // If a client is renamed, all of their previously pushed invoices in New
    // Wave must be updated to reflect the new brand name.
    const { data: affectedInvoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('client_id', payload.id)
      .neq('status', 'draft');

    if (affectedInvoices && affectedInvoices.length > 0) {
      const { syncInvoiceToNewWave } = await import('@/app/actions/invoices');
      // Fire-and-forget sync for all affected invoices
      Promise.allSettled(
        affectedInvoices.map((inv: any) => syncInvoiceToNewWave(inv.id, supabase))
      ).catch(err => console.warn('Background client rename sync failed:', err));
    }
    // ─────────────────────────────────────────────────────────────────────────

    revalidatePath('/settings');
    revalidatePath('/settings/contacts');
    revalidatePath('/vendors');
    revalidatePath('/optimizing/clients');
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

    if (!['superadmin', 'founder'].includes(role)) {
      return { success: false, error: 'Access denied: Only Superadmin can delete client profiles.' };
    }

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      if (error.code === '23503') {
        return { success: false, error: 'Cannot delete this contact because they have existing invoices. Please delete the associated invoices first.' };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    revalidatePath('/settings/contacts');
    revalidatePath('/vendors');
    revalidatePath('/optimizing/clients');
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
  role: 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client';
}) {
  try {
    const supabase = await createClient();
    const { workspaceId, role } = await resolveWorkspaceContext(supabase);

    if (role !== 'superadmin' && role !== 'founder') {
      return {
        success: false,
        error: 'RBAC Security Clearance Denied: Only the Founder or a Superadmin can invite team members.',
      };
    }

    if (!payload.email) {
      return { success: false, error: 'Member email is required.' };
    }

    let targetUserId = null;
    let inviteError = null;
    let actionLink = null;

    // Use service_role client to invite user
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    try {
      const { data: inviteData, error: adminErr } = await adminSupabase.auth.admin.generateLink({
        type: 'invite',
        email: payload.email.trim(),
        options: {
          data: { full_name: payload.name.trim() }
        }
      });
      
      if (adminErr) {
        if (adminErr.message.includes('already exists') || adminErr.status === 422) {
          // User already exists, try to look up their ID
          const { data: usersData } = await adminSupabase.auth.admin.listUsers();
          const existingUser = usersData.users.find(u => u.email === payload.email.trim());
          if (existingUser) {
            targetUserId = existingUser.id;
          } else {
            inviteError = 'User already exists but could not find ID.';
          }
        } else {
          inviteError = adminErr.message;
        }
      } else if (inviteData?.user) {
        targetUserId = inviteData.user.id;
        actionLink = inviteData.properties?.action_link;
      }
    } catch (e: any) {
      inviteError = e.message;
    }

    if (inviteError) {
      return { success: false, error: `Failed to create invite: ${inviteError}` };
    }

    if (!targetUserId) {
      return { success: false, error: 'Failed to generate user ID for invite.' };
    }

    const { error } = await supabase.from('workspace_members').upsert({
      workspace_id: workspaceId,
      role: payload.role,
      user_id: targetUserId,
      email: payload.email.toLowerCase().trim(),
      display_name: payload.name.trim(),
    }, { onConflict: 'workspace_id,user_id' });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/team');
    return { success: true, inviteLink: actionLink };
  } catch (err: any) {
    console.error('Invite error:', err);
    return { success: false, error: err?.message || 'Failed to invite team member.' };
  }
}

/**
 * Server Action: Update a team member's role
 */
export async function updateTeamMemberRole(payload: { memberId: string; role: 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client' | 'founder' }) {
  try {
    const supabase = await createClient();
    const { workspaceId, role: currentRole } = await resolveWorkspaceContext(supabase);

    if (currentRole !== 'superadmin' && currentRole !== 'founder') {
      return { success: false, error: 'Only the Founder or a Superadmin can modify team roles.' };
    }

    // Only the Founder can change a Superadmin's role.
    if (currentRole !== 'founder') {
      const { data: target } = await supabase
        .from('workspace_members').select('role').eq('id', payload.memberId).eq('workspace_id', workspaceId).single();
      if (target?.role === 'superadmin') {
        return { success: false, error: 'Only the Founder can change Superadmin roles.' };
      }
    }

    // Founders are defined by email (see lib/auth/founders.ts), never by a membership row.
    if (!['superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'].includes(payload.role)) {
      return { success: false, error: 'Invalid role.' };
    }

    const { error } = await supabase
      .from('workspace_members')
      .update({ role: payload.role })
      .eq('id', payload.memberId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/settings/team');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update member role.' };
  }
}

/**
 * Server Action: Remove a team member from the workspace
 */
export async function deleteTeamMember(payload: { memberId: string }) {
  try {
    const supabase = await createClient();
    const { userId, workspaceId, role: currentRole } = await resolveWorkspaceContext(supabase);

    if (currentRole !== 'superadmin' && currentRole !== 'founder') {
      return { success: false, error: 'Only the Founder or a Superadmin can remove team members.' };
    }

    // Attempt to delete the member from the workspace
    const { data: member, error: fetchError } = await supabase
      .from('workspace_members')
      .select('user_id, role, email')
      .eq('id', payload.memberId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !member) {
      return { success: false, error: 'Member not found.' };
    }

    if (member.user_id && member.user_id === userId) {
      return { success: false, error: 'You cannot remove your own access.' };
    }

    // Founders are defined by email and are never removed from here.
    if (isFounderEmail(member.email)) {
      return { success: false, error: 'The Founder cannot be removed.' };
    }

    // Only the Founder can remove a Superadmin.
    if (member.role === 'superadmin' && currentRole !== 'founder') {
      return { success: false, error: 'Only the Founder can remove a Superadmin.' };
    }

    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', payload.memberId)
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // If that was their last workspace, delete the login itself so the email can be invited again as a new person.
    // (Past records they saved keep working, but show no name.)
    let loginDeleted = false;
    let loginError: string | null = null;
    if (member.user_id) {
      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { count } = await admin
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', member.user_id);

      if (!count) {
        await admin.from('profiles').delete().eq('id', member.user_id);
        const { error: authError } = await admin.auth.admin.deleteUser(member.user_id);
        if (authError) loginError = authError.message;
        else loginDeleted = true;
      }
    }

    revalidatePath('/settings/team');
    return { success: true, loginDeleted, loginError };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to remove team member.' };
  }
}

/**
 * Server Action: Get Invoice History for a Client
 */
export async function getClientInvoiceHistory(clientId: string) {
  try {
    const supabase = await createClient();
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, status, total_amount')
      .eq('client_id', clientId)
      .neq('status', 'void')
      .order('issue_date', { ascending: false });

    if (error) throw error;
    return { success: true, invoices: invoices || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch invoice history.' };
  }
}

/**
 * Server Action: Get Expense History for a Vendor
 */
export async function getClientExpenseHistory(clientId: string) {
  try {
    const supabase = await createClient();
    const { data: expenses, error } = await supabase
      .from('transactions')
      .select('id, description, transaction_date, amount, due_date')
      .eq('client_id', clientId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return { success: true, expenses: expenses || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch expense history.' };
  }
}

/**
 * Server Action: change a member's role here and which of the inviter's workspaces they can enter.
 * The role is applied to the current workspace and to workspaces being added; roles the person already has
 * in other workspaces are left alone.
 */
export async function updateTeamMemberAccess(payload: {
  memberId: string;
  role: 'superadmin' | 'accounting' | 'admin' | 'advertiser' | 'sales' | 'client';
  workspaceIds: string[];
}) {
  try {
    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);

    if (ctx.role !== 'superadmin' && ctx.role !== 'founder') {
      return { success: false, error: 'Only the Founder or a Superadmin can change access.' };
    }
    if (!['superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'].includes(payload.role)) {
      return { success: false, error: 'Invalid role.' };
    }

    const manageable = new Set(ctx.availableWorkspaces.filter((w) => w.role === 'founder' || w.role === 'superadmin').map((w) => w.id));
    const selected = Array.from(new Set(payload.workspaceIds.filter((id) => manageable.has(id))));
    if (selected.length === 0) {
      return { success: false, error: 'Choose at least one workspace (use the trash icon to remove the member).' };
    }

    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, user_id, email, display_name, role')
      .eq('id', payload.memberId)
      .eq('workspace_id', ctx.activeWorkspaceId)
      .single();
    if (!member) return { success: false, error: 'Member not found.' };
    if (member.user_id && member.user_id === ctx.userId) return { success: false, error: 'You cannot change your own access.' };
    if (member.role === 'superadmin' && ctx.role !== 'founder') {
      return { success: false, error: 'Only the Founder can change a Superadmin.' };
    }

    const identity = (workspaceId: string) => {
      const q = supabase.from('workspace_members').select('id, role').eq('workspace_id', workspaceId);
      return member.user_id ? q.eq('user_id', member.user_id) : q.ilike('email', member.email || '');
    };

    for (const workspaceId of manageable) {
      const { data: existing } = await identity(workspaceId).maybeSingle();
      const wanted = selected.includes(workspaceId);

      if (wanted && !existing) {
        const { error } = await supabase.from('workspace_members').insert({
          workspace_id: workspaceId,
          user_id: member.user_id,
          email: member.email,
          display_name: member.display_name,
          role: payload.role,
        });
        if (error) return { success: false, error: error.message };
      } else if (wanted && existing && workspaceId === ctx.activeWorkspaceId) {
        const { error } = await supabase.from('workspace_members').update({ role: payload.role }).eq('id', existing.id);
        if (error) return { success: false, error: error.message };
      } else if (!wanted && existing) {
        const { error } = await supabase.from('workspace_members').delete().eq('id', existing.id);
        if (error) return { success: false, error: error.message };
      }
    }

    revalidatePath('/settings/team');
    return { success: true, removedFromCurrent: !selected.includes(ctx.activeWorkspaceId) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update access.' };
  }
}
