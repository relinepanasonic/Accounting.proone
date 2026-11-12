'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess, waFounderAccess, loadPeople } from '@/lib/wa/queries';
import { previewPerformance, sendPerformance } from '@/lib/wa/performance';
import { prepareClientWeekly, sendOutboxItem } from '@/lib/wa/weekly-job';
import { fetchFonnteGroups } from '@/lib/wa/fonnte-groups';
import { generateReports } from '@/lib/wa/report';
import { normalizeIdPhone } from '@/lib/wa/stats';

/**
 * Links a WhatsApp number to an ERP person (so their chats count for their role),
 * or, with no userId, marks the number as "not staff" again. Finance roles only.
 */
export async function linkWaNumber(phoneRaw: string, userId: string | null, displayName?: string) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const phone = normalizeIdPhone(phoneRaw);
  if (!phone) return { error: 'Missing phone' };
  const db = createAdminClient();

  if (userId) {
    // Only someone who really belongs to this company can be linked.
    const { data: member } = await db.from('workspace_members').select('user_id').eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', userId).maybeSingle();
    if (!member) return { error: 'That person is not in this company' };
    // One number per person: free any other number this person had.
    await db.from('wa_members').update({ user_id: null, is_team: false }).eq('workspace_id', ctx.activeWorkspaceId).eq('user_id', userId).neq('phone', phone);
  }
  const { error } = await db.from('wa_members').upsert(
    { workspace_id: ctx.activeWorkspaceId, phone, user_id: userId, is_team: !!userId, ...(displayName ? { display_name: displayName } : {}) },
    { onConflict: 'workspace_id,phone' },
  );
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** Gives a chat a name (Fonnte does not send group names). An empty name goes back to "Group ···123456". */
export async function renameWaGroup(groupId: string, name: string) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 80);
  const { error } = await createAdminClient().from('wa_groups').update({ name: clean || null }).eq('id', groupId).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** "Generate now" button: writes today's reports for this company (the same job the 18:00 cron runs). */
export async function generateWaReportNow() {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  try {
    const run = await generateReports(ctx.activeWorkspaceId);
    revalidatePath('/hrd/wa', 'layout');
    return { ok: true, run };
  } catch (e: any) {
    return { error: e?.message || 'Report failed' };
  }
}

/** Marks a follow-up done, dismissed, or open again. */
export async function setWaActionStatus(itemId: string, status: 'open' | 'done' | 'dismissed') {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  if (!['open', 'done', 'dismissed'].includes(status)) return { error: 'Bad status' };
  const { error } = await createAdminClient().from('wa_action_items').update({ status }).eq('id', itemId).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** Turns a follow-up into an ERP task for its owner (matched by phone), or for you when the owner is unknown. */
export async function convertWaActionToTask(itemId: string) {
  const ctx = await waAccess();
  if (!ctx || !ctx.userId) return { error: 'Not allowed' };
  const db = createAdminClient();
  const { data: item } = await db.from('wa_action_items').select('id, title, detail, owner_phone, due_date, staff_task_id').eq('id', itemId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!item) return { error: 'Follow-up not found' };
  if (item.staff_task_id) return { error: 'Already a task' };

  const { byPhone } = await loadPeople(ctx.activeWorkspaceId);
  const owner = item.owner_phone ? byPhone.get(item.owner_phone) : undefined;
  const assignedTo = owner?.userId || ctx.userId;

  const { data: task, error } = await db.from('staff_tasks').insert({
    workspace_id: ctx.activeWorkspaceId,
    title: item.title,
    note: [item.detail, 'From WhatsApp (WA Control).'].filter(Boolean).join('\n'),
    assigned_to: assignedTo,
    assigned_by: ctx.userId,
    due_date: item.due_date,
    priority: 'medium',
  }).select('id').single();
  if (error || !task) return { error: error?.message || 'Could not create the task' };
  await db.from('wa_action_items').update({ staff_task_id: task.id }).eq('id', itemId);
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true, assignedToYou: assignedTo === ctx.userId };
}

/** Turns reporting on or off for one group (its messages are still stored). */
export async function setWaGroupTracked(groupId: string, tracked: boolean) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_groups').update({ tracked }).eq('id', groupId).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

// ---- Founder page: the team performance report -------------------------------------------------------------

/** Builds the report (daily, weekly or monthly by the date) and returns it without sending. Takes up to ~30 seconds. */
export async function previewPerformanceReport(date?: string) {
  if (!(await waFounderAccess())) return { error: 'Not allowed' };
  try {
    const r = await previewPerformance(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
    return { ok: true, report: r };
  } catch (e: any) {
    return { error: e?.message || 'Could not build the report' };
  }
}

/** Sends the report now: to one recipient (a test) or to everyone active. */
export async function sendPerformanceReportNow(phone?: string) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  try {
    const out = await sendPerformance(ctx.activeWorkspaceId, phone ? { trigger: 'test', onlyPhones: [normalizeIdPhone(phone)] } : { trigger: 'manual' });
    revalidatePath('/hrd/wa', 'layout');
    return { ok: true, out };
  } catch (e: any) {
    return { error: e?.message || 'Could not send' };
  }
}

/** The 09:00 cron sends only while this is on. Turn it on when the Make.com scenario is off, so nobody gets it twice. */
export async function setPerformanceAutoSend(on: boolean) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_settings').upsert({ workspace_id: ctx.activeWorkspaceId, auto_send: on, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

export async function addReportRecipient(phoneRaw: string, name: string) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  const phone = normalizeIdPhone(phoneRaw);
  if (!/^62\d{8,13}$/.test(phone)) return { error: 'Use an Indonesian number, like 0812... or 62812...' };
  const { error } = await createAdminClient().from('wa_recipients').upsert({ workspace_id: ctx.activeWorkspaceId, phone, name: name.trim().slice(0, 60) || null, active: true }, { onConflict: 'workspace_id,phone' });
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

export async function updateReportRecipient(id: string, patch: { name?: string; active?: boolean }) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 60) || null;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await createAdminClient().from('wa_recipients').update(row).eq('id', id).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

export async function removeReportRecipient(id: string) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_recipients').delete().eq('id', id).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

// ---- Admin: client weekly summaries (Oli -> client groups, after an admin approves) --------------------------

/** Builds this week's drafts now (the Monday cron does the same). With refresh, unsent drafts are rebuilt from the latest numbers (edits are lost). */
export async function prepareWeeklyNow(refresh = false) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  try {
    const run = await prepareClientWeekly(ctx.activeWorkspaceId, { refresh });
    revalidatePath('/hrd/wa', 'layout');
    return { ok: true, run };
  } catch (e: any) {
    return { error: e?.message || 'Could not prepare the summaries' };
  }
}

/** Saves an admin's edit of a draft's text. */
export async function saveOutboxMessage(id: string, message: string) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const text = message.trim().slice(0, 4000);
  if (!text) return { error: 'The message is empty.' };
  const { error } = await createAdminClient().from('wa_outbox').update({ message: text }).eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).in('status', ['draft', 'failed']);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** The approval: an admin checked the text and presses Send. Oli's number sends it to the client's group. */
export async function sendOutbox(id: string, message?: string, asText = false) {
  const ctx = await waAccess();
  if (!ctx || !ctx.userId) return { error: 'Not allowed' };
  try {
    const r = await sendOutboxItem(ctx.activeWorkspaceId, ctx.userId, id, { message: message?.slice(0, 4000), asText });
    revalidatePath('/hrd/wa', 'layout');
    return r.ok ? { ok: true, detail: r.detail } : { error: r.detail };
  } catch (e: any) {
    return { error: e?.message || 'Could not send' };
  }
}

/** Do not send this one this week (it can be put back). */
export async function skipOutbox(id: string, skip = true) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_outbox').update({ status: skip ? 'skipped' : 'draft' }).eq('id', id).eq('workspace_id', ctx.activeWorkspaceId).in('status', skip ? ['draft', 'failed'] : ['skipped']);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** Links a store ("ProOne - Toko A") to the client's WhatsApp group, or unlinks it with no group. Drafts of that store follow. */
export async function linkStoreToGroup(storeLabel: string, groupId: string | null) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;
  if (!groupId) {
    await db.from('wa_store_groups').delete().eq('workspace_id', ws).eq('store_label', storeLabel);
    await db.from('wa_outbox').update({ group_id: null }).eq('workspace_id', ws).eq('store_label', storeLabel).in('status', ['draft', 'failed']);
  } else {
    const { data: g } = await db.from('wa_groups').select('id').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
    if (!g) return { error: 'That group is not in this company.' };
    const { error } = await db.from('wa_store_groups').upsert({ workspace_id: ws, store_label: storeLabel, group_id: groupId }, { onConflict: 'workspace_id,store_label' });
    if (error) return { error: error.message };
    await db.from('wa_outbox').update({ group_id: groupId }).eq('workspace_id', ws).eq('store_label', storeLabel).in('status', ['draft', 'failed']);
  }
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** The switch for sending PDFs as files. Turn it on only after Fonnte confirms the Super package can send files. */
export async function setSendFiles(on: boolean) {
  const ctx = await waFounderAccess();
  if (!ctx) return { error: 'Not allowed' };
  const { error } = await createAdminClient().from('wa_settings').upsert({ workspace_id: ctx.activeWorkspaceId, send_files: on, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  return { ok: true };
}

/** Links a client to its WhatsApp group (one group per client: its brands and stores share it), or unlinks it. */
export async function linkClientToGroup(clientId: string, groupId: string | null) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;
  if (groupId) {
    const { data: g } = await db.from('wa_groups').select('id').eq('id', groupId).eq('workspace_id', ws).maybeSingle();
    if (!g) return { error: 'That group is not in this company.' };
  }
  const { error } = await db.from('clients').update({ wa_group_id: groupId }).eq('id', clientId).eq('workspace_id', ws);
  if (error) return { error: error.message };
  revalidatePath('/hrd/wa', 'layout');
  revalidatePath('/contacts');
  revalidatePath('/optimizing/clients');
  return { ok: true };
}

/**
 * Fills the chat list from Fonnte: every WhatsApp group Oli's number is in, with its real name (the webhook never gives names). New groups are
 * added; a group that has no name yet gets it; names you typed yourself are never overwritten. With `refresh`, Fonnte's list is refreshed from
 * WhatsApp first: do that only after Oli joined a new group (Fonnte warns that overusing it can get the number banned).
 */
export async function syncWaGroups(refresh = false) {
  const ctx = await waAccess();
  if (!ctx) return { error: 'Not allowed' };
  const r = await fetchFonnteGroups({ refresh });
  if (!r.ok) return { error: r.error };

  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;
  const [{ data: dev }, { data: existing }] = await Promise.all([
    db.from('wa_devices').select('id').eq('workspace_id', ws).eq('active', true).limit(1).maybeSingle(),
    db.from('wa_groups').select('id, wa_id, name').eq('workspace_id', ws),
  ]);
  const byId = new Map((existing || []).map((g: any) => [g.wa_id as string, g as { id: string; wa_id: string; name: string | null }]));

  const inserts: Record<string, unknown>[] = [];
  let named = 0;
  for (const g of r.groups) {
    const ex = byId.get(g.waId);
    if (!ex) inserts.push({ workspace_id: ws, device_id: dev?.id || null, wa_id: g.waId, name: g.name || null, is_group: true });
    else if (!ex.name && g.name) {
      const { error } = await db.from('wa_groups').update({ name: g.name }).eq('id', ex.id);
      if (!error) named++;
    }
  }
  let created = 0;
  for (let i = 0; i < inserts.length; i += 100) {
    const chunk = inserts.slice(i, i + 100);
    const { error } = await db.from('wa_groups').insert(chunk);
    if (error) return { error: `Could not save the groups: ${error.message}` };
    created += chunk.length;
  }
  revalidatePath('/hrd/wa', 'layout');
  revalidatePath('/contacts');
  return { ok: true, found: r.groups.length, created, named };
}
