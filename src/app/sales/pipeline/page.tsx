import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { PipelineKanban } from '@/components/sales/PipelineKanban';
import { founderEmails } from '@/lib/auth/founders';

export const dynamic = 'force-dynamic';

const ALLOWED = ['sales', 'accounting', 'admin', 'superadmin', 'founder'];
const FINANCE = ['accounting', 'admin', 'superadmin', 'founder'];

const isMissing = (e: any) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST204';

export default async function SalesPipelinePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ALLOWED.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">The pipeline is for sales and finance roles.</p>
      </div>
    );
  }

  const month = (await searchParams).month || new Date().toISOString().slice(0, 7);
  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;

  // A salesman sees his own deals; owners and finance see everyone's.
  let q = db.from('crm_deals').select('*').eq('workspace_id', ws).neq('stage', 'Lost').order('created_at', { ascending: false });
  if (ctx.role === 'sales') q = q.or(`salesman_id.eq.${ctx.userId},salesman_id.is.null`);
  const { data: allDeals } = await q;
  const dealIds = (allDeals || []).map((d: any) => d.id);
  const clientIds = Array.from(new Set((allDeals || []).map((d: any) => d.client_id).filter(Boolean)));
  const invoiceIds = (allDeals || []).map((d: any) => d.invoice_id).filter(Boolean);

  const [clientsRes, requestsRes, invoicesRes, projectsRes, productsRes, membersRes] = await Promise.all([
    clientIds.length ? db.from('clients').select('id, name, phone').in('id', clientIds) : Promise.resolve({ data: [] as any[], error: null }),
    dealIds.length ? db.from('invoice_requests').select('id, deal_id, status, items, note, requested_at').in('deal_id', dealIds).order('requested_at', { ascending: false }) : Promise.resolve({ data: [] as any[], error: null }),
    invoiceIds.length ? db.from('invoices').select('id, invoice_number, status').in('id', invoiceIds) : Promise.resolve({ data: [] as any[], error: null }),
    dealIds.length ? db.from('projects').select('id, deal_id, start_date, end_date, deliverables, status, handler_assigned_at').in('deal_id', dealIds) : Promise.resolve({ data: [] as any[], error: null }),
    db.from('products').select('id, name, unit_price, scale, quantity, duration_type, duration_value, deliverable_unit').eq('workspace_id', ws).order('name'),
    db.from('workspace_members').select('user_id, role').eq('workspace_id', ws).eq('role', 'sales'),
  ]);

  // Until the sales-flow migration has been run, say so instead of showing an empty board.
  const needsMigration = [requestsRes, projectsRes].some((r: any) => isMissing(r.error)) || isMissing(productsRes.error);

  const clientById = new Map<string, any>((clientsRes.data || []).map((c: any) => [c.id, c]));
  const invoiceById = new Map<string, any>((invoicesRes.data || []).map((i: any) => [i.id, i]));
  const projectByDeal = new Map<string, any>((projectsRes.data || []).map((p: any) => [p.deal_id, p]));
  const requestByDeal = new Map<string, any>();
  for (const r of requestsRes.data || []) if (!requestByDeal.has(r.deal_id)) requestByDeal.set(r.deal_id, r); // newest first

  // A Deal sticks to the month it was paid (or approved by Accounting). Next month the column starts fresh;
  // older deals live on in the Client page.
  const dealMonth = (d: any) => String(d.paid_at || d.acc_approved_at || d.updated_at || d.created_at || '').slice(0, 7);
  const deals = (allDeals || [])
    .filter((d: any) => d.stage !== 'Deal' || dealMonth(d) === month)
    .map((d: any) => {
      const req = requestByDeal.get(d.id);
      const inv = d.invoice_id ? invoiceById.get(d.invoice_id) : null;
      const client = clientById.get(d.client_id);
      return {
        id: d.id,
        title: d.title,
        stage: d.stage,
        value: Number(d.value || 0),
        client_name: client?.name || d.lead_name || 'Client',
        client_phone: client?.phone || null,
        salesman_id: d.salesman_id || null,
        salesman_name: d.salesman_name || null,
        expected_close_date: d.expected_close_date || null,
        invoice_requested_at: d.invoice_requested_at || null,
        invoice_generated_at: d.invoice_generated_at || null,
        paid_at: d.paid_at || null,
        acc_approved_at: d.acc_approved_at || null,
        invoice_number: inv?.invoice_number || null,
        invoice_status: inv?.status || null,
        request: req && req.status !== 'cancelled' ? { id: req.id, status: req.status, items: req.items || [], note: req.note || null } : null,
        project: projectByDeal.get(d.id) || null,
        created_at: d.created_at,
        stage_changed_at: d.stage_changed_at || null,
        last_followup_at: d.last_followup_at || null,
        proposal_sent_at: d.proposal_sent_at || null,
        negotiation_notes: Array.isArray(d.negotiation_notes) ? d.negotiation_notes : [],
        neg_acc_status: d.neg_acc_status || null,
        neg_acc_requested_from_name: d.neg_acc_requested_from_name || null,
        neg_acc_by_name: d.neg_acc_by_name || null,
        neg_acc_at: d.neg_acc_at || null,
        neg_acc_comment: d.neg_acc_comment || null,
      };
    });

  // Names for the "salesman" picker (owners / finance create leads for a salesman).
  const memberIds = (membersRes.data || []).map((m: any) => m.user_id);
  const { data: profiles } = memberIds.length ? await db.from('profiles').select('id, full_name, email').in('id', memberIds) : { data: [] as any[] };
  const salesmen = (profiles || []).map((p: any) => ({ id: p.id, name: p.full_name || p.email }));

  // Who can ACC a negotiation: the superadmins of this workspace and the founder.
  const { data: owners } = await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'superadmin');
  const ownerIds = (owners || []).map((m: any) => m.user_id);
  const [{ data: ownerProfiles }, { data: founderProfiles }] = await Promise.all([
    ownerIds.length ? db.from('profiles').select('id, full_name, email').in('id', ownerIds) : Promise.resolve({ data: [] as any[] }),
    db.from('profiles').select('id, full_name, email').in('email', founderEmails()),
  ]);
  const seen = new Set<string>();
  const approvers = [...(founderProfiles || []), ...(ownerProfiles || [])]
    .filter((p: any) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .map((p: any) => ({ id: p.id, name: p.full_name || String(p.email).split('@')[0] }));

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
      {needsMigration && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 lg:mx-8">
          One database step is missing: run <span className="font-mono">supabase/migrations/20261003_sales_flow.sql</span> in Supabase to turn on invoice requests, projects and notifications.
        </div>
      )}
      <PipelineKanban
        initialDeals={deals}
        products={productsRes.data || []}
        salesmen={salesmen}
        approvers={approvers}
        viewer={{ role: ctx.role, userId: ctx.userId, isFinance: FINANCE.includes(ctx.role), isOwner: ctx.role === 'superadmin' || ctx.role === 'founder' }}
        currentMonth={month}
      />
    </div>
  );
}
