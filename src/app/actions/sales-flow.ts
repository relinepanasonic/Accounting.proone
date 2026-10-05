'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { MANUAL_STAGES, PIPELINE_STAGES, PROPOSAL_STAGES, computeProjectTerms, requestTotal, type NegotiationNote, type RequestItem } from '@/lib/sales/flow';
import { dealItems, notify, resolveNotifications } from '@/lib/sales/server';

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

const SALES_ROLES = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];
const FINANCE = ['accounting', 'admin', 'superadmin', 'founder'];
const OWNERS = ['superadmin', 'founder'];
const MIGRATION_HINT = 'Run supabase/migrations/20261003_sales_flow.sql in Supabase first.';
const isMissing = (e: any) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST204';
const fail = (e: any): { success: false; error: string } => ({ success: false, error: isMissing(e) ? MIGRATION_HINT : e?.message || 'Something went wrong.' });

async function actor() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || !ctx.activeWorkspaceId) return null;
  return { ctx, db: createAdminClient() };
}

/** A salesman only touches his own deals; owners and finance touch all of them. */
function mayTouch(ctx: { role: string; userId: string | null }, deal: { salesman_id: string | null }) {
  if (FINANCE.includes(ctx.role)) return true;
  return ctx.role === 'sales' && (!deal.salesman_id || deal.salesman_id === ctx.userId);
}

const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max);

// ------------------------------------------------------------------------------------------------ 1. leads
export interface LeadInput {
  name: string; // the client's name, exactly as in the accounting client form
  contact_name?: string;
  email?: string;
  phone?: string;
  company_name?: string; // brand
  store_name?: string;
  company_legal_name?: string;
  billing_address?: string;
  title: string; // what the deal is about
  value?: number;
  expected_close_date?: string;
  notes?: string;
  salesman_id?: string; // owners / finance may pick who owns it; a salesman always owns his own
}

export async function createLead(input: LeadInput): Promise<Result<{ dealId: string }>> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;

  const name = str(input.name, 160);
  const title = str(input.title, 160);
  if (!name) return { success: false, error: 'Write the client name.' };
  if (!title) return { success: false, error: 'Write what the deal is about.' };

  let salesmanId = ctx.userId!;
  if (ctx.role !== 'sales' && input.salesman_id) salesmanId = input.salesman_id;
  const { data: sm } = await db.from('profiles').select('full_name, email').eq('id', salesmanId).maybeSingle();
  const salesmanName = sm?.full_name || sm?.email?.split('@')[0] || ctx.userName || null;

  // Same fields as the accounting client form. Hidden from Accounting until an invoice is requested.
  const { data: client, error: cErr } = await db
    .from('clients')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      name,
      contact_name: str(input.contact_name) || null,
      email: str(input.email) || null,
      phone: str(input.phone, 40) || null,
      company_name: str(input.company_name) || null,
      store_name: str(input.store_name) || null,
      company_legal_name: str(input.company_legal_name) || null,
      billing_address: str(input.billing_address, 600) || null,
      contact_type: 'client',
      is_prospect: true,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (cErr || !client) return fail(cErr);

  const { data: deal, error: dErr } = await db
    .from('crm_deals')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      client_id: client.id,
      lead_name: name,
      title,
      value: Number(input.value) > 0 ? Number(input.value) : 0,
      stage: 'Lead',
      salesman_id: salesmanId,
      salesman_name: salesmanName,
      expected_close_date: input.expected_close_date || null,
      notes: str(input.notes, 1000) || null,
      pipeline_month: new Date().toISOString().slice(0, 7),
      stage_changed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (dErr || !deal) {
    await db.from('clients').delete().eq('id', client.id); // never leave an orphan prospect behind
    return fail(dErr);
  }
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales');
  return { success: true, dealId: deal.id };
}

/** Drag between the early stages. Invoice and Deal are reached through the request / payment flow only. */
export async function moveDeal(dealId: string, stage: string): Promise<Result> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  if (!(PIPELINE_STAGES as readonly string[]).includes(stage)) return { success: false, error: 'Unknown stage.' };
  if (!MANUAL_STAGES.includes(stage)) {
    return { success: false, error: stage === 'Invoice' ? 'A card moves to Waiting Payment when Accounting makes its invoice. Use "Request invoice" in Negotiation.' : 'A card becomes a Deal when its invoice is paid (or Accounting approves it).' };
  }
  const { ctx, db } = a;
  const { data: deal } = await db.from('crm_deals').select('id, stage, salesman_id, workspace_id').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Deal not found.' };
  if (!mayTouch(ctx, deal)) return { success: false, error: 'This deal belongs to another salesman.' };
  if (deal.stage === 'Invoice' || deal.stage === 'Deal') return { success: false, error: 'An invoiced deal cannot move back.' };

  const now = new Date().toISOString();
  const { error } = await db.from('crm_deals').update({ stage, stage_changed_at: now, updated_at: now }).eq('id', dealId);
  if (error) return fail(error);
  revalidatePath('/sales/pipeline');
  revalidatePath('/sales');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ 2. invoice request
export async function requestInvoice(dealId: string, items: RequestItem[], note: string): Promise<Result<{ requestId: string }>> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;

  const clean: RequestItem[] = (items || [])
    .map((i) => ({
      product_id: i.product_id || null,
      name: str(i.name, 160),
      quantity: Math.max(0, Number(i.quantity) || 0),
      unit_price: Math.max(0, Math.round(Number(i.unit_price) || 0)),
      scale: i.scale ? str(i.scale, 30) : null,
      duration_type: (['none', 'day', 'month', 'deliverable'].includes(i.duration_type) ? i.duration_type : 'none') as RequestItem['duration_type'],
      duration_value: Math.max(0, Math.round(Number(i.duration_value) || 0)),
      deliverable_unit: i.deliverable_unit ? str(i.deliverable_unit, 30) : null,
    }))
    .filter((i) => i.name && i.quantity > 0);
  if (clean.length === 0) return { success: false, error: 'Add at least one product with a quantity.' };

  const { data: deal } = await db.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Deal not found.' };
  if (!mayTouch(ctx, deal)) return { success: false, error: 'This deal belongs to another salesman.' };
  if (deal.stage !== 'Negotiation') return { success: false, error: 'Invoices are requested from the Negotiation column.' };
  if (deal.neg_acc_status !== 'approved') return { success: false, error: 'A superadmin or the founder must ACC the negotiation first.' };
  // Leads entered before the new lead form have a name but no client record: create it now.
  if (!deal.client_id) {
    if (!deal.lead_name) return { success: false, error: 'This deal has no client yet.' };
    const { data: made, error: mErr } = await db
      .from('clients')
      .insert({ workspace_id: ctx.activeWorkspaceId, name: deal.lead_name, contact_type: 'client', is_prospect: true, created_by: ctx.userId })
      .select('id')
      .single();
    if (mErr || !made) return fail(mErr);
    await db.from('crm_deals').update({ client_id: made.id }).eq('id', dealId);
    deal.client_id = made.id;
  }

  const { data: open } = await db.from('invoice_requests').select('id').eq('deal_id', dealId).eq('status', 'requested').limit(1);
  if (open && open.length) return { success: false, error: 'An invoice request is already waiting for Accounting.' };
  if (deal.invoice_id) return { success: false, error: 'This deal already has an invoice.' };

  const now = new Date().toISOString();
  const { data: req, error } = await db
    .from('invoice_requests')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      deal_id: dealId,
      client_id: deal.client_id,
      requested_by: ctx.userId,
      requested_by_name: ctx.userName || ctx.userEmail || null,
      items: clean,
      note: str(note, 1000) || null,
      requested_at: now,
    })
    .select('id')
    .single();
  if (error || !req) return fail(error);

  const total = requestTotal(clean);
  // The card stays in Negotiation ("waiting for Accounting") until the invoice exists; then it moves to Waiting Payment.
  await db.from('crm_deals').update({ invoice_requested_at: now, value: total, updated_at: now }).eq('id', dealId);
  await db.from('clients').update({ is_prospect: false }).eq('id', deal.client_id); // Accounting can see the client from now on

  const { data: client } = await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();
  await notify(db, {
    workspaceId: ctx.activeWorkspaceId,
    audience: 'finance',
    kind: 'invoice_request',
    title: `New invoice request: ${client?.name || deal.lead_name || 'client'}`,
    body: `${ctx.userName || 'Sales'} · ${clean.length} product${clean.length === 1 ? '' : 's'} · Rp ${Math.round(total).toLocaleString('id-ID')}`,
    link: '/invoices',
    refId: req.id,
  });

  revalidatePath('/sales/pipeline');
  revalidatePath('/invoices/requests');
  return { success: true, requestId: req.id };
}

export async function cancelInvoiceRequest(requestId: string): Promise<Result> {
  const a = await actor();
  if (!a) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;
  const { data: req } = await db.from('invoice_requests').select('*').eq('id', requestId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!req) return { success: false, error: 'Request not found.' };
  if (req.status !== 'requested') return { success: false, error: 'Accounting already made the invoice.' };
  if (!FINANCE.includes(ctx.role) && req.requested_by !== ctx.userId) return { success: false, error: 'Only the requester can cancel.' };

  await db.from('invoice_requests').update({ status: 'cancelled' }).eq('id', requestId);
  await db.from('crm_deals').update({ stage: 'Negotiation', invoice_requested_at: null, updated_at: new Date().toISOString() }).eq('id', req.deal_id);
  await resolveNotifications(db, ctx.activeWorkspaceId, 'invoice_request', requestId);
  revalidatePath('/sales/pipeline');
  revalidatePath('/invoices/requests');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ 3. invoice on the card
/** A link the client can open without logging in (the invoice page with a Download PDF button). */
export async function createInvoiceShare(dealId: string): Promise<Result<{ token: string; clientName: string; invoiceNumber: string; phone: string | null; total: number }>> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;

  const { data: deal } = await db.from('crm_deals').select('id, salesman_id, invoice_id, client_id, workspace_id').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal || !deal.invoice_id) return { success: false, error: 'There is no invoice on this card yet.' };
  if (!mayTouch(ctx, deal)) return { success: false, error: 'This deal belongs to another salesman.' };

  const [{ data: inv }, { data: client }] = await Promise.all([
    db.from('invoices').select('invoice_number, total_amount, status, assigned_workspace_id').eq('id', deal.invoice_id).maybeSingle(),
    db.from('clients').select('name, phone').eq('id', deal.client_id).maybeSingle(),
  ]);
  if (!inv) return { success: false, error: 'The invoice no longer exists.' };
  if (String(inv.status).toLowerCase() === 'draft') return { success: false, error: 'The invoice is still a draft. Ask Accounting to finalize it first.' };

  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  void mask; // the salesman owns this client; the share link shows the client's own invoice to the client

  const { data: existing } = await db
    .from('invoice_shares')
    .select('token')
    .eq('invoice_id', deal.invoice_id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  let token = existing?.[0]?.token as string | undefined;
  if (!token) {
    token = randomBytes(24).toString('base64url');
    const { error } = await db.from('invoice_shares').insert({
      token,
      workspace_id: ctx.activeWorkspaceId,
      invoice_id: deal.invoice_id,
      created_by: ctx.userId,
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    });
    if (error) return fail(error);
  }
  return { success: true, token, clientName: client?.name || 'Client', invoiceNumber: inv.invoice_number, phone: client?.phone || null, total: Number(inv.total_amount || 0) };
}

/** Special case: Accounting accepts the deal without waiting for the money. */
export async function approveWithoutPayment(dealId: string): Promise<Result> {
  const a = await actor();
  if (!a || !FINANCE.includes(a.ctx.role)) return { success: false, error: 'Only Accounting can approve.' };
  const { ctx, db } = a;
  const { data: deal } = await db.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Deal not found.' };
  if (!deal.invoice_id) return { success: false, error: 'Make the invoice first.' };
  if (deal.stage === 'Deal') return { success: false, error: 'Already a deal.' };

  const now = new Date().toISOString();
  await db.from('crm_deals').update({ stage: 'Deal', acc_approved_at: now, updated_at: now }).eq('id', dealId);
  const { data: client } = await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();
  if (deal.salesman_id) {
    await notify(db, {
      workspaceId: ctx.activeWorkspaceId,
      audience: 'user',
      userId: deal.salesman_id,
      kind: 'deal_paid',
      title: `Approved by Accounting: ${client?.name || deal.title}`,
      body: 'Set the project start date on the card.',
      link: '/sales/pipeline',
      refId: deal.id,
    });
  }
  revalidatePath('/sales/pipeline');
  revalidatePath('/invoices/requests');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ 4. project
export async function startProject(dealId: string, startDate: string): Promise<Result<{ endDate: string | null }>> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { success: false, error: 'Choose the start date.' };
  const { ctx, db } = a;

  const { data: deal } = await db.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Deal not found.' };
  if (!mayTouch(ctx, deal)) return { success: false, error: 'This deal belongs to another salesman.' };
  if (deal.stage !== 'Deal') return { success: false, error: 'The project can start once the invoice is paid or approved.' };

  const { data: exists } = await db.from('projects').select('id').eq('deal_id', dealId).maybeSingle();
  if (exists) return { success: false, error: 'This project has already started.' };

  const items = await dealItems(db, ctx.activeWorkspaceId, deal);

  const { endDate, deliverables } = computeProjectTerms(items, startDate);
  const today = new Date().toISOString().slice(0, 10);
  const { data: client } = await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();

  const { data: project, error } = await db
    .from('projects')
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      client_id: deal.client_id,
      deal_id: dealId,
      invoice_id: deal.invoice_id,
      name: deal.title || client?.name || 'Project',
      start_date: startDate,
      end_date: endDate,
      deliverables,
      status: startDate > today ? 'pre_start' : 'active',
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error || !project) return fail(error);

  // The end date feeds the "near churn" warning (30 days before the service ends).
  if (endDate) await db.from('clients').update({ service_end_date: endDate }).eq('id', deal.client_id);

  await notify(db, {
    workspaceId: ctx.activeWorkspaceId,
    audience: 'owners',
    kind: 'project_needs_handler',
    title: `New project: ${client?.name || deal.title}`,
    body: `Starts ${startDate}${endDate ? `, ends ${endDate}` : ''}. Choose the advertiser and admin.`,
    link: '/productivity/assignments',
    refId: project.id,
  });
  await resolveNotifications(db, ctx.activeWorkspaceId, 'deal_paid', dealId);

  revalidatePath('/sales/pipeline');
  revalidatePath('/productivity/assignments');
  return { success: true, endDate };
}

// ------------------------------------------------------------------------------------------------ 5. handlers
export async function assignProjectHandlers(projectId: string, advertiserId: string | null, adminId: string | null): Promise<Result> {
  const a = await actor();
  if (!a || !OWNERS.includes(a.ctx.role)) return { success: false, error: 'Only a superadmin can assign.' };
  if (!advertiserId && !adminId) return { success: false, error: 'Choose an advertiser or an admin.' };
  const { ctx, db } = a;

  const { data: project } = await db.from('projects').select('id, client_id').eq('id', projectId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!project) return { success: false, error: 'Project not found.' };

  const rows: any[] = [];
  if (advertiserId) rows.push({ workspace_id: ctx.activeWorkspaceId, client_id: project.client_id, user_id: advertiserId, job: 'advertising', assigned_by: ctx.userId });
  if (adminId) rows.push({ workspace_id: ctx.activeWorkspaceId, client_id: project.client_id, user_id: adminId, job: 'admin', assigned_by: ctx.userId });
  for (const row of rows) {
    const { error } = await db.from('client_assignments').insert(row);
    if (error && error.code !== '23505') return fail(error); // 23505 = already assigned
  }
  await db.from('projects').update({ handler_assigned_at: new Date().toISOString() }).eq('id', projectId);
  await resolveNotifications(db, ctx.activeWorkspaceId, 'project_needs_handler', projectId);
  revalidatePath('/productivity/assignments');
  revalidatePath('/productivity/advertiser');
  revalidatePath('/productivity/admin');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ notifications
export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const a = await actor();
  if (!a) return [];
  const { ctx, db } = a;
  const { data, error } = await db
    .from('notifications')
    .select('id, audience, user_id, kind, title, body, link, created_at')
    .eq('workspace_id', ctx.activeWorkspaceId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return [];
  return (data || [])
    .filter((n: any) => (n.audience === 'finance' && FINANCE.includes(ctx.role)) || (n.audience === 'owners' && OWNERS.includes(ctx.role)) || (n.audience === 'user' && n.user_id === ctx.userId))
    .map(({ audience, user_id, ...rest }: any) => rest);
}

/** The person has seen a personal notification ("invoice ready"): remove it. Task notifications clear themselves. */
export async function dismissNotification(id: string): Promise<void> {
  const a = await actor();
  if (!a) return;
  await a.db.from('notifications').update({ resolved_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', a.ctx.activeWorkspaceId).eq('audience', 'user').eq('user_id', a.ctx.userId);
}

// ------------------------------------------------------------------------------------------------ 6. tasks on the card
async function ownDeal(dealId: string) {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { error: 'Not allowed.' as const };
  const { data: deal } = await a.db.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', a.ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { error: 'Deal not found.' as const };
  if (!mayTouch(a.ctx, deal)) return { error: 'This deal belongs to another salesman.' as const };
  return { a, deal };
}

/** The proposal is a one-time task while the card is in Lead / Contacted. */
export async function markProposalSent(dealId: string): Promise<Result> {
  const r = await ownDeal(dealId);
  if (!r.a || !r.deal) return { success: false, error: r.error || 'Not allowed.' };
  if (!PROPOSAL_STAGES.includes(r.deal.stage)) return { success: false, error: 'The proposal task is for Lead and Contacted cards.' };
  if (r.deal.proposal_sent_at) return { success: false, error: 'The proposal was already marked as sent.' };
  const { error } = await r.a.db.from('crm_deals').update({ proposal_sent_at: new Date().toISOString() }).eq('id', dealId);
  if (error) return fail(error);
  revalidatePath('/sales/pipeline');
  revalidatePath('/productivity/me');
  return { success: true };
}

/** The follow-up was done: the next one is due in 2 days (Lead) or a week (Contacted). */
export async function markFollowedUp(dealId: string): Promise<Result> {
  const r = await ownDeal(dealId);
  if (!r.a || !r.deal) return { success: false, error: r.error || 'Not allowed.' };
  const { error } = await r.a.db
    .from('crm_deals')
    .update({ last_followup_at: new Date().toISOString(), followup_count: Number(r.deal.followup_count || 0) + 1 })
    .eq('id', dealId);
  if (error) return fail(error);
  revalidatePath('/sales/pipeline');
  revalidatePath('/productivity/me');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ 7. negotiation + ACC
export async function addNegotiationNote(dealId: string, text: string): Promise<Result> {
  const r = await ownDeal(dealId);
  if (!r.a || !r.deal) return { success: false, error: r.error || 'Not allowed.' };
  const clean = str(text, 1500);
  if (clean.length < 2) return { success: false, error: 'Write the note first.' };
  const notes: NegotiationNote[] = Array.isArray(r.deal.negotiation_notes) ? r.deal.negotiation_notes : [];
  notes.push({ at: new Date().toISOString(), by: r.a.ctx.userName || r.a.ctx.userEmail || 'Sales', text: clean });
  const { error } = await r.a.db.from('crm_deals').update({ negotiation_notes: notes.slice(-60), updated_at: new Date().toISOString() }).eq('id', dealId);
  if (error) return fail(error);
  revalidatePath('/sales/pipeline');
  return { success: true };
}

/** Asks one superadmin or the founder to ACC the negotiated deal. The invoice cannot be requested before that. */
export async function askAcc(dealId: string, approverId: string): Promise<Result> {
  const r = await ownDeal(dealId);
  if (!r.a || !r.deal) return { success: false, error: r.error || 'Not allowed.' };
  const { a, deal } = r;
  if (deal.stage !== 'Negotiation') return { success: false, error: 'ACC is asked in the Negotiation column.' };
  if (deal.neg_acc_status === 'approved') return { success: false, error: 'Already approved.' };
  if (!approverId) return { success: false, error: 'Choose who should ACC.' };

  const [{ data: member }, { data: profile }] = await Promise.all([
    a.db.from('workspace_members').select('role').eq('workspace_id', a.ctx.activeWorkspaceId).eq('user_id', approverId).maybeSingle(),
    a.db.from('profiles').select('full_name, email').eq('id', approverId).maybeSingle(),
  ]);
  const isFounder = (profile?.email || '').toLowerCase() === 'nicojapar@gmail.com';
  if (member?.role !== 'superadmin' && !isFounder) return { success: false, error: 'Only a superadmin or the founder can ACC.' };
  const approverName = profile?.full_name || profile?.email?.split('@')[0] || 'Owner';

  const now = new Date().toISOString();
  const { error } = await a.db
    .from('crm_deals')
    .update({ neg_acc_status: 'requested', neg_acc_requested_from: approverId, neg_acc_requested_from_name: approverName, neg_acc_requested_at: now, neg_acc_comment: null, updated_at: now })
    .eq('id', dealId);
  if (error) return fail(error);

  const { data: client } = await a.db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();
  await notify(a.db, {
    workspaceId: a.ctx.activeWorkspaceId,
    audience: 'user',
    userId: approverId,
    kind: 'neg_acc_request',
    title: `ACC needed: ${client?.name || deal.title}`,
    body: `${a.ctx.userName || 'Sales'} finished negotiating. Open the card to read the notes and approve.`,
    link: '/sales/pipeline',
    refId: deal.id,
  });
  revalidatePath('/sales/pipeline');
  return { success: true };
}

/** A superadmin or the founder approves (or sends back) the negotiation. The card records who. */
export async function decideAcc(dealId: string, approve: boolean, comment: string): Promise<Result> {
  const a = await actor();
  if (!a || !OWNERS.includes(a.ctx.role)) return { success: false, error: 'Only a superadmin or the founder can ACC.' };
  const { ctx, db } = a;
  const { data: deal } = await db.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!deal) return { success: false, error: 'Deal not found.' };
  if (deal.stage !== 'Negotiation') return { success: false, error: 'The card is not in Negotiation.' };

  const now = new Date().toISOString();
  const { error } = await db
    .from('crm_deals')
    .update({
      neg_acc_status: approve ? 'approved' : 'rejected',
      neg_acc_by: ctx.userId,
      neg_acc_by_name: ctx.userName || ctx.userEmail || 'Owner',
      neg_acc_at: now,
      neg_acc_comment: str(comment, 500) || null,
      updated_at: now,
    })
    .eq('id', dealId);
  if (error) return fail(error);
  await resolveNotifications(db, ctx.activeWorkspaceId, 'neg_acc_request', dealId);

  if (deal.salesman_id) {
    const { data: client } = await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();
    await notify(db, {
      workspaceId: ctx.activeWorkspaceId,
      audience: 'user',
      userId: deal.salesman_id,
      kind: 'neg_acc_result',
      title: `${approve ? 'ACC approved' : 'ACC sent back'}: ${client?.name || deal.title}`,
      body: approve ? 'You can request the invoice now.' : str(comment, 200) || 'Check the comment on the card.',
      link: '/sales/pipeline',
      refId: deal.id,
    });
  }
  revalidatePath('/sales/pipeline');
  return { success: true };
}

// ------------------------------------------------------------------------------------------------ 8. client table
/** Picks (or changes) the project start date. The end date follows from each product length. */
export async function setProjectStart(dealId: string, startDate: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { success: false, error: 'Choose the start date.' };
  const r = await ownDeal(dealId);
  if (!r.a || !r.deal) return { success: false, error: r.error || 'Not allowed.' };
  const { a, deal } = r;
  if (deal.stage !== 'Deal') return { success: false, error: 'The project can start once the invoice is paid or approved.' };

  const { data: project } = await a.db.from('projects').select('id').eq('deal_id', dealId).maybeSingle();
  if (!project) {
    const res = await startProject(dealId, startDate);
    revalidatePath('/sales/clients');
    return res.success ? { success: true } : res;
  }

  const items = await dealItems(a.db, a.ctx.activeWorkspaceId, deal);
  const { endDate, deliverables } = computeProjectTerms(items, startDate);
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await a.db.from('projects').update({ start_date: startDate, end_date: endDate, deliverables, status: startDate > today ? 'pre_start' : 'active' }).eq('id', project.id);
  if (error) return fail(error);
  if (endDate) await a.db.from('clients').update({ service_end_date: endDate }).eq('id', deal.client_id);
  revalidatePath('/sales/clients');
  revalidatePath('/sales/pipeline');
  return { success: true };
}

/** Brand and store name of a client, edited in the Client table. */
export async function updateClientNames(clientId: string, brand: string, store: string): Promise<Result> {
  const a = await actor();
  if (!a || !SALES_ROLES.includes(a.ctx.role)) return { success: false, error: 'Not allowed.' };
  const { ctx, db } = a;
  if (ctx.role === 'sales') {
    const { data: own } = await db.from('crm_deals').select('id').eq('client_id', clientId).eq('salesman_id', ctx.userId).limit(1);
    if (!own?.length) return { success: false, error: 'This client belongs to another salesman.' };
  }
  const { error } = await db.from('clients').update({ company_name: str(brand) || null, store_name: str(store) || null }).eq('id', clientId).eq('workspace_id', ctx.activeWorkspaceId);
  if (error) return fail(error);
  revalidatePath('/sales/clients');
  revalidatePath('/productivity/advertiser/clients');
  revalidatePath('/productivity/admin/clients');
  return { success: true };
}

/** Superadmin / founder: who handles this client. Replaces the current handler(s) of that job; empty = unassign. */
export async function setClientHandler(clientId: string, job: 'advertising' | 'admin', userId: string | null): Promise<Result> {
  const a = await actor();
  if (!a || !OWNERS.includes(a.ctx.role)) return { success: false, error: 'Only a superadmin can assign.' };
  if (job !== 'advertising' && job !== 'admin') return { success: false, error: 'Unknown job.' };
  const { ctx, db } = a;
  const { data: client } = await db.from('clients').select('id').eq('id', clientId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
  if (!client) return { success: false, error: 'Client not found.' };

  await db.from('client_assignments').delete().eq('workspace_id', ctx.activeWorkspaceId).eq('client_id', clientId).eq('job', job);
  if (userId) {
    const { error } = await db.from('client_assignments').insert({ workspace_id: ctx.activeWorkspaceId, client_id: clientId, user_id: userId, job, assigned_by: ctx.userId });
    if (error) return fail(error);
  }
  revalidatePath('/sales/clients');
  revalidatePath('/productivity/advertiser/clients');
  revalidatePath('/productivity/admin/clients');
  revalidatePath('/productivity/assignments');
  return { success: true };
}
