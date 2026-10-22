import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadErpDashboards } from '@/lib/api/erp-report';
import { getDashboardUploadLogRange, getRelineUploadLogRange, jakartaDay } from '@/lib/integrations/dashboard-uploads';
import { normalizeLogs, buildPerformance, type LogRow, type AssignedStore } from '@/lib/integrations/upload-performance';

/**
 * The WhatsApp report for Nico, Herlan and Lucy. By division (Sales, Admin, Advertiser, Accounting), no AI names.
 *  Tuesday to Saturday: Daily report of yesterday (Monday to Friday). Sunday: nothing. Monday: Weekly report, which is the
 *  ongoing month from the 1st to yesterday (Sunday); on the first Monday of a new month it is the Monthly report of the last month.
 * Every number is counted from the data; only "Saran Prof" is written by the model, from those numbers.
 */

export type ReportKind = 'daily' | 'weekly' | 'monthly' | 'none';
export interface ReportPlan { kind: ReportKind; from: string; to: string; prevFrom: string; prevTo: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const addDays = (day: string, n: number) => jakartaDay(new Date(new Date(`${day}T12:00:00+07:00`).getTime() + n * 86400000));
const weekday = (day: string) => new Date(`${day}T12:00:00+07:00`).getUTCDay(); // 0 = Sunday
const dmy = (day: string) => `${day.slice(8, 10)} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(2, 4)}`;
const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
const dayOf = (ts: string | null | undefined) => (ts ? jakartaDay(new Date(ts)) : '');
const inRange = (day: string, from: string, to: string) => !!day && day >= from && day <= to;
const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00+07:00`).getTime() - new Date(`${from}T12:00:00+07:00`).getTime()) / 86400000) + 1;
const lastDayOfMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

export function planReport(today: string): ReportPlan {
  const dow = weekday(today);
  const yesterday = addDays(today, -1);
  if (dow === 0) return { kind: 'none', from: today, to: today, prevFrom: today, prevTo: today };
  if (dow !== 1) return { kind: 'daily', from: yesterday, to: yesterday, prevFrom: addDays(yesterday, -1), prevTo: addDays(yesterday, -1) };

  const dayOfMonth = Number(today.slice(8, 10));
  if (dayOfMonth <= 7) {
    // A new month: the month that just ended, in full.
    const thisMonth = Number(today.slice(5, 7));
    const y = thisMonth === 1 ? Number(today.slice(0, 4)) - 1 : Number(today.slice(0, 4));
    const m = thisMonth === 1 ? 12 : thisMonth - 1;
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`;
    const len = daysBetween(from, to);
    return { kind: 'monthly', from, to, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
  }
  const from = `${today.slice(0, 7)}-01`;
  const len = daysBetween(from, yesterday);
  return { kind: 'weekly', from, to: yesterday, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

const workdays = (from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) { const w = weekday(d); if (w >= 1 && w <= 5) n++; }
  return n;
};

type Db = ReturnType<typeof createAdminClient>;

async function salesSection(db: Db, plan: ReportPlan) {
  const { data: deals } = await db.from('crm_deals').select('salesman_name, created_at, proposal_sent_at, last_followup_at, invoice_generated_at');
  const { data: members } = await db.from('workspace_members').select('user_id').eq('role', 'sales');
  const ids = Array.from(new Set((members || []).map((m: any) => m.user_id)));
  const { data: profs } = ids.length ? await db.from('profiles').select('id, full_name').in('id', ids) : { data: [] as any[] };
  const names = new Set<string>([...(profs || []).map((p: any) => String(p.full_name || '').trim()), ...(deals || []).map((d: any) => String(d.salesman_name || '').trim())].filter(Boolean));
  const count = (name: string, from: string, to: string) => {
    const mine = (deals || []).filter((d: any) => String(d.salesman_name || '').trim() === name);
    return {
      leads: mine.filter((d: any) => inRange(dayOf(d.created_at), from, to)).length,
      contacts: mine.filter((d: any) => inRange(dayOf(d.proposal_sent_at), from, to) || inRange(dayOf(d.last_followup_at), from, to)).length,
      invoices: mine.filter((d: any) => inRange(dayOf(d.invoice_generated_at), from, to)).length,
    };
  };
  return Array.from(names).sort().map((name) => ({ name, now: count(name, plan.from, plan.to), before: count(name, plan.prevFrom, plan.prevTo) }));
}

async function adminSection(db: Db, plan: ReportPlan, today: string) {
  // Late needs a look back of two weeks even for a short period.
  const logFrom = plan.from < addDays(today, -14) ? plan.from : addDays(today, -14);
  const [prof, reline] = await Promise.all([getDashboardUploadLogRange(logFrom, today), getRelineUploadLogRange(logFrom, today)]);
  const { rows, assigned, errors } = normalizeLogs(prof, reline);
  const inPeriod = rows.filter((r: LogRow) => inRange(r.day, plan.from, plan.to));
  const perf = buildPerformance(rows, assigned, new Date(`${today}T12:00:00+07:00`));
  // The admins of this ERP (role admin) are the ones reported. The upload apps may spell the name longer ("Vani" / "Vani Admin"): match on the first name.
  const { data: adminMembers } = await db.from('workspace_members').select('user_id').eq('role', 'admin');
  const adminIds = Array.from(new Set((adminMembers || []).map((m: any) => m.user_id)));
  const { data: adminProfiles } = adminIds.length ? await db.from('profiles').select('id, full_name').in('id', adminIds) : { data: [] as any[] };
  const admins = Array.from(new Set((adminProfiles || []).map((p: any) => String(p.full_name || '').trim()).filter(Boolean))).sort();
  const sameAdmin = (name: string, other: string) => { const a = name.toLowerCase().split(/s+/)[0]; const b = String(other || '').toLowerCase(); return !!a && (b === a || b.startsWith(a + ' ')); };

  const { data: fo } = await db.from('fake_order_projects').select('client_name, start_date');
  const foInPeriod = (fo || []).filter((f: any) => inRange(String(f.start_date || '').slice(0, 10), plan.from, plan.to));

  const lines = admins.map((name) => {
    const mine = inPeriod.filter((r: LogRow) => sameAdmin(name, r.admin));
    const files = mine.reduce((s: number, r: LogRow) => s + Math.max(1, r.files.length), 0);
    const stores = assigned.filter((a: AssignedStore) => sameAdmin(name, a.pic)).map((a: AssignedStore) => a.store.toLowerCase());
    const uploadedStores = new Set(mine.map((r: LogRow) => r.store.toLowerCase()).filter((s: string) => stores.includes(s)));
    const mp = perf.filter((p) => sameAdmin(name, p.pic));
    return { name, files, total: stores.length, uploaded: uploadedStores.size, onSchedule: mp.filter((p) => p.status === 'on_schedule').length, late: mp.filter((p) => p.status === 'late').map((p) => p.store) };
  });
  return { lines, errors, fo: { count: foInPeriod.length, clients: new Set(foInPeriod.map((f: any) => f.client_name)).size } };
}

async function advertiserSection(db: Db, plan: ReportPlan) {
  const { data: asg } = await db.from('client_assignments').select('client_id, user_id').eq('job', 'advertising');
  const userIds = Array.from(new Set((asg || []).map((a: any) => a.user_id)));
  const { data: profs } = userIds.length ? await db.from('profiles').select('id, full_name').in('id', userIds) : { data: [] as any[] };
  const { data: reps } = await db.from('advertiser_reports').select('client_id, session, report_date').gte('report_date', plan.from).lte('report_date', plan.to).limit(5000);
  const days = workdays(plan.from, plan.to) || 1;
  return userIds.map((uid) => {
    const clients = new Set((asg || []).filter((a: any) => a.user_id === uid).map((a: any) => a.client_id));
    const mine = (reps || []).filter((r: any) => clients.has(r.client_id));
    const done = (session: number) => (plan.kind === 'daily'
      ? new Set(mine.filter((r: any) => Number(r.session) === session).map((r: any) => r.client_id)).size
      : new Set(mine.filter((r: any) => Number(r.session) === session).map((r: any) => `${r.client_id}|${String(r.report_date).slice(0, 10)}`)).size);
    const total = plan.kind === 'daily' ? clients.size : clients.size * days;
    return { name: String((profs || []).find((p: any) => p.id === uid)?.full_name || 'Advertiser'), s1: done(1), s2: done(2), total };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function todoSection(db: Db, today: string) {
  const { data: neg } = await db.from('crm_deals').select('title, lead_name, clients(name)').eq('neg_acc_status', 'requested');
  const { data: visits } = await db.from('lead_visits').select('client_name, salesman_name, agenda, visit_at').gte('visit_at', `${today}T00:00:00+07:00`).lte('visit_at', `${addDays(today, 3)}T23:59:59+07:00`).order('visit_at', { ascending: true }).limit(8);
  const { data: tasks } = await db.from('staff_tasks').select('title, assigned_to, due_date, status').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(8);
  const uids = Array.from(new Set((tasks || []).map((t: any) => t.assigned_to).filter(Boolean)));
  const { data: profs } = uids.length ? await db.from('profiles').select('id, full_name').in('id', uids) : { data: [] as any[] };
  return {
    accNego: (neg || []).map((d: any) => String(d.clients?.name || d.lead_name || d.title || 'Client')),
    schedule: (visits || []).map((v: any) => `${dmy(dayOf(v.visit_at))} ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v.visit_at)).replace('.', ':')} ${v.client_name || ''}${v.agenda ? ` (${v.agenda})` : ''}`.trim()),
    tasks: (tasks || []).map((t: any) => `${t.title}${t.due_date ? ` (due ${dmy(String(t.due_date).slice(0, 10))})` : ''}${t.assigned_to ? ` - ${String((profs || []).find((p: any) => p.id === t.assigned_to)?.full_name || '')}` : ''}`),
  };
}

async function accountingSection(db: Db, plan: ReportPlan) {
  const year = Number(plan.to.slice(0, 4));
  const month = Number(plan.to.slice(5, 7)) - 1;
  const { total } = await loadErpDashboards({ year, month, onlyTotal: true });
  const t = total!;
  const base = { cash: t.totalCashFlow, ar: t.totalAR, overhead: t.totalCost, mrr: t.avgMonthlyRevenue, coverage: t.coverageRatio, revenue: t.totalRevenue, monthlyOverhead: t.monthlyCost };
  if (plan.kind === 'daily') return { ...base, newCustomers: 0, recurringCustomers: 0 };

  const { data: inv } = await db.from('invoices').select('issue_date, status, is_quotation, clients(name)').eq('is_quotation', false).lte('issue_date', plan.to);
  const valid = (inv || []).filter((i: any) => !['draft', 'cancelled', 'canceled', 'void'].includes(String(i.status || '').toLowerCase()));
  const nameOf = (i: any) => String(i.clients?.name || '').trim().toLowerCase();
  const before = new Set(valid.filter((i: any) => String(i.issue_date || '').slice(0, 10) < plan.from).map(nameOf).filter(Boolean));
  const inPeriod = new Set(valid.filter((i: any) => inRange(String(i.issue_date || '').slice(0, 10), plan.from, plan.to)).map(nameOf).filter(Boolean));
  let newCustomers = 0; let recurringCustomers = 0;
  for (const n of inPeriod) before.has(n) ? recurringCustomers++ : newCustomers++;
  return { ...base, newCustomers, recurringCustomers };
}

async function profAdvice(kind: ReportKind, facts: unknown): Promise<string> {
  try {
    const res: any = await new Anthropic().messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 900,
      system: 'Kamu Prof, penasihat bisnis Profesor Online group (Prof Toko Online, PT Pintu Langit, New Wave, Dream of AI). Tulis 2 sampai 4 saran singkat dalam Bahasa Indonesia untuk pemilik, dari data laporan. ' +
        'Format: satu baris per saran, diawali "- ", teks biasa untuk WhatsApp, tanpa markdown. Pakai hanya angka yang ada di data, jangan mengarang. Sebut nama divisi atau orangnya bila perlu. Setiap saran maksimal 200 karakter, tanpa istilah teknis seperti s1/s2 (tulis sesi 1 / sesi 2). Jangan menyebut AI.',
      messages: [{ role: 'user', content: `Jenis laporan: ${kind}\nDATA:\n${JSON.stringify(facts)}` }],
    });
    let text = '';
    for (const b of res.content) if (b.type === 'text') text += b.text;
    return text.trim();
  } catch {
    return '';
  }
}

export async function buildWhatsAppReport(todayOverride?: string) {
  const today = todayOverride && /^\d{4}-\d{2}-\d{2}$/.test(todayOverride) ? todayOverride : jakartaDay(new Date());
  const plan = planReport(today);
  if (plan.kind === 'none') return { send: false, kind: plan.kind, date: today, text: '' };

  const db = createAdminClient();
  const [sales, admin, advertisers, todo, acc] = await Promise.all([
    salesSection(db, plan).catch(() => null),
    adminSection(db, plan, today).catch(() => null),
    advertiserSection(db, plan).catch(() => null),
    todoSection(db, today).catch(() => null),
    accountingSection(db, plan).catch(() => null),
  ]);

  const daily = plan.kind === 'daily';
  const title = daily
    ? `*Daily Yesterday (${dmy(plan.from)}) Report*`
    : `*${plan.kind === 'monthly' ? 'Monthly' : 'Weekly'} (${dmy(plan.from)} - ${dmy(plan.to)}) Report*`;
  const out: string[] = [title, ''];

  out.push(daily ? '*Sales*' : '*Sales Weekly*');
  if (!sales) out.push('  data sales belum bisa dibaca');
  else if (sales.length === 0) out.push('  belum ada data pipeline');
  for (const s of sales || []) {
    out.push(`  ${s.name}: ${s.now.leads} New Leads | ${s.now.contacts} New Contacts | ${s.now.invoices} New Invoice`);
    if (!daily) out.push(`      sebelumnya: ${s.before.leads} | ${s.before.contacts} | ${s.before.invoices}`);
  }
  out.push('');

  out.push(daily ? '*Admin*' : '*Admin weekly*');
  if (!admin) out.push('  data upload belum bisa dibaca');
  else {
    if (admin.errors.length) out.push(`  (${admin.errors.join('; ')})`);
    for (const a of admin.lines) {
      out.push(daily
        ? `  ${a.name}: ${a.files} file upload | ${a.uploaded}/${a.total} Clients | ${a.uploaded} uploaded | ${Math.max(0, a.total - a.uploaded)} Ongoing`
        : `  ${a.name}: ${a.files} file upload | ${a.uploaded}/${a.total} Clients | ${a.onSchedule} on schedule | ${a.late.length} late`);
      if (!daily && a.late.length) out.push(`      Late upload: ${a.late.slice(0, 12).join(', ')}${a.late.length > 12 ? ` +${a.late.length - 12}` : ''}`);
    }
    if (!daily) out.push(`  FO: ${admin.fo.count} FO | ${admin.fo.clients} clients`);
  }
  out.push('');

  out.push('*Advertiser*');
  if (!advertisers) out.push('  data advertiser belum bisa dibaca');
  for (const a of advertisers || []) out.push(`  ${a.name}: ${a.s1} / ${a.total} (total) client sesi 1 | ${a.s2} / ${a.total} client sesi 2`);
  if (!daily) out.push('  GMV Client dan Budget Ads per advertiser: menunggu koneksi Dashboard Prof dan Reline');
  out.push('');

  out.push('*To Do:*');
  out.push('');
  if (!todo) out.push('  data to do belum bisa dibaca');
  else {
    out.push(`1. Need acc nego: ${todo.accNego.length} client${todo.accNego.length ? ` (${todo.accNego.slice(0, 5).join(', ')})` : ''}`);
    out.push(`2. Schedule: ${todo.schedule.length ? '' : '-'}`.trimEnd());
    for (const s of todo.schedule) out.push(`   - ${s}`);
    out.push(`3. To Do list: ${todo.tasks.length ? '' : '-'}`.trimEnd());
    for (const t of todo.tasks.slice(0, 6)) out.push(`   - ${t}`);
  }
  out.push('');

  out.push('*Accounting*');
  if (!acc) out.push('  data accounting belum bisa dibaca');
  else if (daily) out.push(`  Cash Total: ${rp(acc.cash)}`);
  else {
    out.push(`  Cash Total          : ${rp(acc.cash)}`);
    out.push(`  New Customer        : ${acc.newCustomers}`);
    out.push(`  Recurring Customer  : ${acc.recurringCustomers}`);
    out.push(`  Revenue             : ${rp(acc.revenue)}`);
    out.push(`  A/R Total           : ${rp(acc.ar)}`);
    out.push(`  Overhead            : ${rp(acc.overhead)}`);
    out.push(`  MRR                 : ${rp(acc.mrr)}`);
    out.push(`  Coverage Ratio      : ${acc.monthlyOverhead > 0 ? `${acc.coverage.toFixed(2)}x` : '-'}`);
  }

  const advice = await profAdvice(plan.kind, { periode: `${plan.from} s/d ${plan.to}`, sales, admin, advertisers, todo, accounting: acc });
  if (advice) { out.push(''); out.push('*Saran Prof*'); out.push(advice); }

  return { send: true, kind: plan.kind, date: today, from: plan.from, to: plan.to, text: out.join('\n') };
}
