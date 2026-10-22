// Optimize Control: the AI team that watches the whole group (all companies) and reports on WhatsApp.
// Server-side only (secret keys). Token-minimal by design: code computes every number into a small digest; the models only read
// that digest and write a short report. Haiku for the supervisors that only summarize data, Sonnet where judgement matters.
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { buildErpReport, loadErpDashboards } from '@/lib/api/erp-report';
import { getDashboardUploadLogRange, getRelineUploadLogRange, jakartaDay } from '@/lib/integrations/dashboard-uploads';
import { buildMonthTable, normalizeLogs } from '@/lib/integrations/upload-performance';
import { normalizeGroup, num } from '@/lib/advertiser/report-utils';
import { workspaceCode } from '@/lib/workspaces/known';
import { costUsd } from '@/lib/ai/costs';

export type AgentKey = 'prof' | 'acu' | 'adi' | 'avi' | 'selly' | 'don';
export type Cadence = 'daily' | 'weekly' | 'qc';

export interface ControlAgent {
  key: AgentKey;
  name: string;
  title: string;
  model: string;
  /** Sonnet only: how hard it thinks. Haiku runs without it. */
  effort?: 'low' | 'medium';
  cadence: Cadence[];
  maxTokens: number;
  why: string;
}

export const CONTROL_TEAM: ControlAgent[] = [
  { key: 'prof', name: 'Prof', title: 'Boss: orchestrates, QC, advice and recommendations', model: 'claude-sonnet-5-5', effort: 'medium', cadence: ['daily', 'weekly'], maxTokens: 1200, why: 'Reads only the short reports of the others and decides what matters: the judgement job, so Sonnet.' },
  { key: 'acu', name: 'Acu', title: 'Accounting supervisor', model: 'claude-sonnet-5-5', effort: 'low', cadence: ['weekly'], maxTokens: 700, why: 'Money needs careful reading (coverage, cash, overdue), but every number is pre-computed: Sonnet on low effort, once a week.' },
  { key: 'adi', name: 'Adi', title: 'Admin supervisor', model: 'claude-haiku-5-5', cadence: ['weekly'], maxTokens: 500, why: 'The upload log already says who is late: Haiku only has to summarize it.' },
  { key: 'avi', name: 'Avi', title: 'Advertiser supervisor', model: 'claude-haiku-5-5', cadence: ['daily', 'weekly'], maxTokens: 500, why: 'Spend, sales and ROAS are computed by the app; Haiku flags the weak stores. Daily, so the cheapest good model.' },
  { key: 'selly', name: 'Selly', title: 'Sales supervisor', model: 'claude-haiku-5-5', cadence: ['daily', 'weekly'], maxTokens: 500, why: 'Pipeline counts and follow-ups come from the app; Haiku writes the short daily sales note.' },
  { key: 'don', name: 'Don', title: 'Dream of AI supervisor', model: 'claude-haiku-5-5', cadence: ['weekly'], maxTokens: 400, why: 'Dream of AI is not set up yet: a short weekly note on its numbers is enough.' },
];
export const agentByKey = (k: AgentKey) => CONTROL_TEAM.find((a) => a.key === k)!;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const COMMON = 'You work for Profesor Online group (companies: ProOne / Prof Toko Online, PLIG = PT Pintu Langit, NW = New Wave, DOA = Dream of AI). ' +
  'Write in Bahasa Indonesia, plain text for WhatsApp (no markdown tables, no headings with #). Use only the numbers in the data; never invent any. ' +
  'If data is missing or zero, say so in one line. Be short.';

async function ask(agent: ControlAgent, system: string, digest: unknown): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }> {
  const params: any = {
    model: agent.model,
    max_tokens: agent.maxTokens,
    system: `${COMMON}\n${system}`,
    messages: [{ role: 'user', content: `DATA (JSON):\n${JSON.stringify(digest)}` }],
  };
  const res: any = agent.effort
    ? await anthropic().beta.messages.create({ ...params, output_config: { effort: agent.effort } })
    : await anthropic().messages.create(params);
  let text = '';
  for (const b of res.content) if (b.type === 'text') text += b.text;
  return { text: text.trim(), tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, model: res.model };
}

const daysAgo = (today: string, n: number) => jakartaDay(new Date(new Date(`${today}T12:00:00+07:00`).getTime() - n * 86400000));
const rupiah = (n: number) => Math.round(n);

// ------------------------------------------------------------------ digests (code, no tokens)

async function accountingDigest(today: string) {
  const r = await buildErpReport();
  const db = createAdminClient();
  const { data: ex } = await db.from('transactions').select('category, amount, workspace_id').eq('type', 'expense').gte('due_date', daysAgo(today, 7)).lte('due_date', today).limit(2000);
  const byCat = new Map<string, number>();
  for (const e of ex || []) byCat.set(e.category || 'Other', (byCat.get(e.category || 'Other') || 0) + Number(e.amount || 0));
  const { count: openBank } = await db.from('bank_statement_lines').select('id', { count: 'exact', head: true }).eq('status', 'unreconciled');
  return {
    month: r.period, thisMonth: r.total, yearToDate: r.yearTotal,
    companies: r.companies.map((c: any) => ({ code: c.code, revenue: c.revenue, paid: c.paidRevenue, mrr: c.mrr, overhead: c.monthlyOverhead, coverage: c.coverageRatio, cash: c.cash, receivable: c.receivable })),
    overdue: r.overdueInvoices,
    expensesLast7Days: Array.from(byCat.entries()).map(([category, amount]) => ({ category, amount: rupiah(amount) })).sort((a, b) => b.amount - a.amount).slice(0, 6),
    bankLinesNotReconciled: openBank ?? 0,
  };
}

async function adminDigest(today: string) {
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const from = `${today.slice(0, 7)}-01`;
  const [prof, reline] = await Promise.all([getDashboardUploadLogRange(from, today), getRelineUploadLogRange(from, today)]);
  const { rows, assigned, errors } = normalizeLogs(prof, reline);
  const table = buildMonthTable(rows, assigned, year, month, () => '');
  const late = table.filter((t) => t.status === 'late');
  const db = createAdminClient();
  const { data: projects } = await db.from('fake_order_projects').select('id, client_name, finished_at').is('finished_at', null).limit(500);
  const { count: ordersWeek } = await db.from('fake_order_projects').select('id', { count: 'exact', head: true }).gte('created_at', `${daysAgo(today, 7)}T00:00:00+07:00`);
  return {
    stores: table.length, onSchedule: table.length - late.length, late: late.length,
    lateStores: late.slice(0, 12).map((t) => ({ project: t.project, store: t.store, filesPerWeek: t.weekFiles.map((w) => (w === null ? null : w.length)) })),
    friendsOrderProjectsRunning: (projects || []).length, friendsOrderProjectsStartedLast7Days: ordersWeek ?? 0,
    feedErrors: errors,
  };
}

async function advertiserDigest(today: string, days: number) {
  const db = createAdminClient();
  const { data: reps } = await db.from('advertiser_reports').select('workspace_id, client_id, report_date, data_inkubasi, data_group, data_mandiri, sisa_saldo_iklan').gte('report_date', daysAgo(today, days - 1)).lte('report_date', today).limit(2000);
  const ids = Array.from(new Set((reps || []).map((r: any) => r.client_id).filter(Boolean)));
  const { data: clients } = ids.length ? await db.from('clients').select('id, name').in('id', ids) : { data: [] as any[] };
  const name = (id: string) => (clients || []).find((c: any) => c.id === id)?.name || 'Client';
  const per = new Map<string, { client: string; company: string; reports: number; spend: number; sales: number; saldo: string }>();
  for (const r of reps || []) {
    const rows = [...(Array.isArray(r.data_inkubasi) ? r.data_inkubasi : []), ...normalizeGroup(r.data_group), ...(Array.isArray(r.data_mandiri) ? r.data_mandiri : [])];
    const k = r.client_id;
    const cur = per.get(k) || { client: name(k), company: workspaceCode(r.workspace_id), reports: 0, spend: 0, sales: 0, saldo: '' };
    cur.reports++;
    cur.spend += rows.reduce((s: number, x: any) => s + num(x?.biayaIklan), 0);
    cur.sales += rows.reduce((s: number, x: any) => s + num(x?.penjualan), 0);
    cur.saldo = r.sisa_saldo_iklan || cur.saldo;
    per.set(k, cur);
  }
  const { data: assigned } = await db.from('client_assignments').select('client_id').eq('job', 'advertising').limit(2000);
  const reportedToday = new Set((reps || []).filter((r: any) => String(r.report_date).slice(0, 10) === today).map((r: any) => r.client_id));
  return {
    period: `last ${days} day(s)`,
    stores: Array.from(per.values()).map((p) => ({ ...p, spend: rupiah(p.spend), sales: rupiah(p.sales), roas: p.spend > 0 ? Number((p.sales / p.spend).toFixed(2)) : null })).sort((a, b) => (a.roas ?? 99) - (b.roas ?? 99)).slice(0, 15),
    assignedClients: new Set((assigned || []).map((a: any) => a.client_id)).size,
    reportedToday: reportedToday.size,
  };
}

async function salesDigest(today: string, days: number) {
  const db = createAdminClient();
  const { data: deals } = await db.from('crm_deals').select('workspace_id, stage, value, salesman_name, created_at, stage_changed_at, last_followup_at, invoice_requested_at, paid_at, lead_name').limit(3000);
  const since = `${daysAgo(today, days - 1)}T00:00:00+07:00`;
  const all = deals || [];
  const byStage: Record<string, number> = {};
  for (const d of all) byStage[d.stage || '?'] = (byStage[d.stage || '?'] || 0) + 1;
  const twoDaysAgo = `${daysAgo(today, 2)}T00:00:00+07:00`;
  const won = all.filter((d: any) => d.stage === 'Deal' && String(d.stage_changed_at || '') >= since);
  const bySalesman = new Map<string, { newLeads: number; deals: number; value: number }>();
  for (const d of all) {
    const s = d.salesman_name || '-';
    const cur = bySalesman.get(s) || { newLeads: 0, deals: 0, value: 0 };
    if (String(d.created_at) >= since) cur.newLeads++;
    if (d.stage === 'Deal' && String(d.stage_changed_at || '') >= since) { cur.deals++; cur.value += Number(d.value || 0); }
    bySalesman.set(s, cur);
  }
  return {
    period: `last ${days} day(s)`,
    pipelineByStage: byStage,
    newLeads: all.filter((d: any) => String(d.created_at) >= since).length,
    dealsWon: won.length, dealsWonValue: rupiah(won.reduce((s: number, d: any) => s + Number(d.value || 0), 0)),
    invoicesRequested: all.filter((d: any) => String(d.invoice_requested_at || '') >= since).length,
    followUpsOverdue: all.filter((d: any) => ['Lead', 'Contacted', 'Negotiation'].includes(d.stage) && String(d.last_followup_at || d.created_at) < twoDaysAgo).length,
    bySalesman: Array.from(bySalesman.entries()).map(([salesman, v]) => ({ salesman, ...v, value: rupiah(v.value) })),
  };
}

async function doaDigest(today: string) {
  const { companies } = await loadErpDashboards({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1, company: 'DOA' });
  const c: any = companies[0];
  return c ? { revenue: c.revenue, paid: c.paidRevenue, mrr: c.mrr, overhead: c.monthlyOverhead, cash: c.cash, receivable: c.receivable, activeClients: c.activeClients, note: 'Dream of AI workspace is not fully set up yet.' } : { note: 'No Dream of AI data yet.' };
}

const SYSTEM: Record<Exclude<AgentKey, 'prof'>, string> = {
  acu: 'You are Acu, the accounting supervisor. Weekly report: cash and coverage per company, overdue invoices to chase (top 3), unusual expenses, bank lines still to reconcile. End with max 3 actions. Max 140 words.',
  adi: 'You are Adi, the admin supervisor. Weekly report on the admins: how many stores are on schedule vs late with uploads, name the late stores (max 8), Friends Order projects running. End with max 3 actions. Max 120 words.',
  avi: 'You are Avi, the advertiser supervisor. Report on ads: stores with low ROAS (under 3) or no report, spend vs sales, remaining ad balance worries. End with max 3 actions. Max 110 words.',
  selly: 'You are Selly, the sales supervisor. Report on sales: new leads, deals won and value, invoices requested, overdue follow-ups, per salesman. End with max 3 actions. Max 110 words.',
  don: 'You are Don, the Dream of AI supervisor. Short note on Dream of AI numbers; say clearly when the workspace has no data yet. Max 60 words.',
};

async function digestFor(key: Exclude<AgentKey, 'prof'>, cadence: Cadence, today: string) {
  const days = cadence === 'daily' ? 1 : 7;
  switch (key) {
    case 'acu': return accountingDigest(today);
    case 'adi': return adminDigest(today);
    case 'avi': return advertiserDigest(today, days);
    case 'selly': return salesDigest(today, days);
    case 'don': return doaDigest(today);
  }
}

// ------------------------------------------------------------------ the run

export interface ControlReport { agent: AgentKey; cadence: Cadence; content: string; model: string; tokensIn: number; tokensOut: number; costUsd: number }

/** Weekly reports come on Monday (Jakarta). */
export const isWeeklyDay = (today: string) => new Date(`${today}T12:00:00+07:00`).getUTCDay() === 1;

/**
 * Runs the team for one day: the daily supervisors (Avi, Selly), on Monday also the weekly ones (Acu, Adi, Avi, Selly, Don),
 * then Prof writes the WhatsApp message. Reports already stored for the day are reused unless `force`.
 */
export async function runControlTeam(opts: { force?: boolean; today?: string } = {}): Promise<{ today: string; message: string; reports: ControlReport[]; errors: string[] }> {
  const db = createAdminClient();
  const today = opts.today || jakartaDay(new Date());
  const weekly = isWeeklyDay(today);
  const errors: string[] = [];

  const { data: stored } = await db.from('ai_control_reports').select('agent, cadence, content, model, tokens_in, tokens_out, cost_usd').eq('run_date', today);
  const have = new Map<string, ControlReport>();
  for (const s of stored || []) have.set(`${s.agent}|${s.cadence}`, { agent: s.agent, cadence: s.cadence, content: s.content, model: s.model, tokensIn: s.tokens_in, tokensOut: s.tokens_out, costUsd: Number(s.cost_usd || 0) });

  const jobs: Array<{ key: Exclude<AgentKey, 'prof'>; cadence: Cadence }> = [{ key: 'avi', cadence: 'daily' }, { key: 'selly', cadence: 'daily' }];
  if (weekly) jobs.push({ key: 'acu', cadence: 'weekly' }, { key: 'adi', cadence: 'weekly' }, { key: 'avi', cadence: 'weekly' }, { key: 'selly', cadence: 'weekly' }, { key: 'don', cadence: 'weekly' });

  const reports: ControlReport[] = [];
  await Promise.all(jobs.map(async (j) => {
    const k = `${j.key}|${j.cadence}`;
    if (!opts.force && have.has(k)) { reports.push(have.get(k)!); return; }
    try {
      const agent = agentByKey(j.key);
      const digest = await digestFor(j.key, j.cadence, today);
      const out = await ask(agent, `${SYSTEM[j.key]} This is the ${j.cadence === 'daily' ? 'daily (yesterday and today)' : 'weekly (last 7 days)'} report.`, digest);
      const rep: ControlReport = { agent: j.key, cadence: j.cadence, content: out.text, model: out.model, tokensIn: out.tokensIn, tokensOut: out.tokensOut, costUsd: costUsd(out.model, out.tokensIn, out.tokensOut) };
      reports.push(rep);
      await save(db, today, rep);
    } catch (e: any) {
      errors.push(`${agentByKey(j.key).name}: ${e?.message || 'failed'}`);
    }
  }));

  // Prof: QC, priorities and the WhatsApp message, from the short reports only (plus the headline numbers).
  const bossKey = `prof|${weekly ? 'weekly' : 'daily'}`;
  let message = '';
  if (!opts.force && have.has(bossKey)) message = have.get(bossKey)!.content;
  else {
    try {
      const prof = agentByKey('prof');
      const headline = await buildErpReport().then((r) => ({ today: r.period, total: r.total, yearToDate: { mrr: r.yearTotal.mrr, overhead: r.yearTotal.monthlyOverhead, coverage: r.yearTotal.coverageRatio }, overdue: r.overdueInvoices.count })).catch(() => null);
      const out = await ask(prof,
        'You are Prof, the boss of the AI team. You get the reports of your supervisors (Acu accounting, Adi admin, Avi ads, Selly sales, Don Dream of AI). ' +
        'Do QC: point out anything that contradicts the numbers or looks wrong. Answer in exactly two parts: first the line [QC] and your QC notes (max 80 words, for the owner dashboard only), then the line [PESAN] and then ONE WhatsApp message for the owners (Nico, Herlan, Lucy) with nothing else after it, max 1200 characters: ' +
        `start with "Laporan Pagi ${today}"${weekly ? ' and mark it as the weekly report' : ''}, then the key numbers in 3-4 lines, then "Perlu tindakan hari ini:" with max 5 bullets (who does what), then "Saran Prof:" with max 3 short recommendations. ` +
        'Use "-" for bullets. No markdown.',
        { headline, reports: reports.map((r) => ({ from: agentByKey(r.agent).name, cadence: r.cadence, text: r.content })), problems: errors });
      // Only the part after [PESAN] goes to WhatsApp; the QC notes stay in the dashboard.
      const marker = out.text.search(/\[PESAN\]/i);
      message = (marker >= 0 ? out.text.slice(marker + '[PESAN]'.length) : out.text).replace(/^\s*:?\s*/, '').trim();
      const qc = marker >= 0 ? out.text.slice(0, marker).replace(/\[QC\]/i, '').trim() : '';
      if (qc) await save(db, today, { agent: 'prof', cadence: 'qc', content: qc, model: out.model, tokensIn: 0, tokensOut: 0, costUsd: 0 });
      await save(db, today, { agent: 'prof', cadence: weekly ? 'weekly' : 'daily', content: message, model: out.model, tokensIn: out.tokensIn, tokensOut: out.tokensOut, costUsd: costUsd(out.model, out.tokensIn, out.tokensOut) });
    } catch (e: any) {
      errors.push(`Prof: ${e?.message || 'failed'}`);
    }
  }
  return { today, message, reports, errors };
}

async function save(db: ReturnType<typeof createAdminClient>, day: string, r: ControlReport) {
  await db.from('ai_control_reports').upsert({
    run_date: day, agent: r.agent, cadence: r.cadence, content: r.content, model: r.model,
    tokens_in: r.tokensIn, tokens_out: r.tokensOut, cost_usd: r.costUsd, created_at: new Date().toISOString(),
  }, { onConflict: 'run_date,agent,cadence' });
}
