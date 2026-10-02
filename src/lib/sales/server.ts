// Server-only helpers for the sales flow (not server actions: nothing here is callable from the browser).
// They take a service-role client; the caller has already checked who is asking.
type Db = any;

const isMissingTable = (e: any) => e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST204';

export interface NewNotification {
  workspaceId: string;
  audience: 'finance' | 'owners' | 'user';
  userId?: string | null;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  refId?: string | null;
}

/** Adds a task-style notification. Never throws: the flow must go on even if notifications are not set up yet. */
export async function notify(db: Db, n: NewNotification) {
  const { error } = await db.from('notifications').insert({
    workspace_id: n.workspaceId,
    audience: n.audience,
    user_id: n.userId ?? null,
    kind: n.kind,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    ref_id: n.refId ?? null,
  });
  if (error && !isMissingTable(error)) console.error('notify failed:', error.message);
}

/** The work behind a notification is done: take it off everyone's list. */
export async function resolveNotifications(db: Db, workspaceId: string, kind: string, refId: string) {
  const { error } = await db
    .from('notifications')
    .update({ resolved_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('kind', kind)
    .eq('ref_id', refId)
    .is('resolved_at', null);
  if (error && !isMissingTable(error)) console.error('resolve notification failed:', error.message);
}

/** An invoice was created for a request: link them, stamp the card, tell the salesman. */
export async function completeInvoiceRequest(db: Db, requestId: string, invoiceId: string, userId: string | null, workspaceId: string) {
  const { data: req } = await db.from('invoice_requests').select('*').eq('id', requestId).eq('workspace_id', workspaceId).maybeSingle();
  if (!req || req.status !== 'requested') return;
  const now = new Date().toISOString();

  await db.from('invoice_requests').update({ status: 'generated', invoice_id: invoiceId, generated_at: now, generated_by: userId }).eq('id', requestId);
  await db.from('crm_deals').update({ invoice_id: invoiceId, invoice_generated_at: now, stage: 'Invoice' }).eq('id', req.deal_id);
  await resolveNotifications(db, req.workspace_id, 'invoice_request', requestId);

  const [{ data: inv }, { data: client }] = await Promise.all([
    db.from('invoices').select('invoice_number').eq('id', invoiceId).maybeSingle(),
    db.from('clients').select('name').eq('id', req.client_id).maybeSingle(),
  ]);
  if (req.requested_by) {
    await notify(db, {
      workspaceId: req.workspace_id,
      audience: 'user',
      userId: req.requested_by,
      kind: 'invoice_ready',
      title: `Invoice ready: ${client?.name || 'client'}`,
      body: `${inv?.invoice_number || 'Invoice'} was generated. Open the card to share it.`,
      link: '/sales/pipeline',
      refId: req.deal_id,
    });
  }
}

/**
 * An invoice became fully paid: its deal is won. The card moves to Deal and the salesman is asked for the project
 * start date. Safe to call many times (and for invoices that have no deal).
 */
export async function onInvoicePaid(db: Db, invoiceId: string) {
  const { data: deal } = await db.from('crm_deals').select('id, workspace_id, stage, title, client_id, salesman_id, paid_at').eq('invoice_id', invoiceId).maybeSingle();
  if (!deal || deal.paid_at) return;
  const now = new Date().toISOString();
  await db.from('crm_deals').update({ stage: 'Deal', paid_at: now }).eq('id', deal.id);

  const { data: client } = await db.from('clients').select('name').eq('id', deal.client_id).maybeSingle();
  if (deal.salesman_id) {
    await notify(db, {
      workspaceId: deal.workspace_id,
      audience: 'user',
      userId: deal.salesman_id,
      kind: 'deal_paid',
      title: `Paid: ${client?.name || deal.title}`,
      body: 'Set the project start date on the card.',
      link: '/sales/pipeline',
      refId: deal.id,
    });
  }
}
