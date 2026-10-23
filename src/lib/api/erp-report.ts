import crypto from 'crypto';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getDashboardTelemetry, type DashboardTelemetry } from '@/lib/data/dashboard';
import { workspaceCode } from '@/lib/workspaces/known';
import { founderEmails } from '@/lib/auth/founders';
import { getDashboardUploadLog, getRelineUploadLog, jakartaDay, type DashboardUploadLogResult } from '@/lib/integrations/dashboard-uploads';

/** Machine-to-machine key (Make.com, an AI agent...). Header: Authorization: Bearer <ERP_API_KEY>. Unset key = always refused. */
export function authorizeErpApi(request: Request): boolean {
  const expected = process.env.ERP_API_KEY;
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/.exec((request.headers.get('authorization') || '').trim());
  if (!m) return false;
  const h = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest();
  return crypto.timingSafeEqual(h(m[1]), h(expected));
}

const jt = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000_000) return `${sign}Rp ${(a / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (a >= 1_000_000) return `${sign}Rp ${(a / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  return `${sign}Rp ${Math.round(a).toLocaleString('id-ID')}`;
};
const dayLabel = (day: string) => new Date(`${day}T12:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });

export function dashboardNumbers(t: DashboardTelemetry) {
  return {
    revenue: Math.round(t.totalRevenue),
    paidRevenue: Math.round(t.paidRevenue),
    mrr: Math.round(t.avgMonthlyRevenue),
    avgOrderValue: Math.round(t.avgOrderValue),
    cogs: Math.round(t.totalCogs),
    expenses: Math.round(t.totalExpenses),
    overhead: Math.round(t.totalCost),
    monthlyOverhead: Math.round(t.monthlyCost),
    coverageRatio: Number(t.coverageRatio.toFixed(2)),
    salary: Math.round(t.totalSalary),
    cash: Math.round(t.totalCashFlow),
    receivable: Math.round(t.totalAR),
    activeClients: t.activeClientCount,
    newClients: t.newClientCount,
  };
}

/** The same numbers as the dashboard pages, read with the service role (no login). */
export async function loadErpDashboards(opts: { year: number; month: number | null; company?: string | null; onlyTotal?: boolean }) {
  const db = createAdminClient();
  const { data: ws } = await db.from('workspaces').select('id, name');
  const workspaces = (ws || []) as Array<{ id: string; name: string }>;
  const ctxFor = (id: string) => ({ activeWorkspaceId: id, activeWorkspaceName: workspaces.find((w) => w.id === id)?.name || '', userEmail: founderEmails()[0], availableWorkspaces: workspaces } as any);

  const wanted = opts.company && opts.company.toLowerCase() !== 'all'
    ? workspaces.filter((w) => workspaceCode(w.id, w.name).toLowerCase() === opts.company!.toLowerCase())
    : workspaces;

  const companies = opts.onlyTotal ? [] : await Promise.all(wanted.map(async (w) => {
    const t = await getDashboardTelemetry({ db, monthFilter: opts.month, year: opts.year, ctx: ctxFor(w.id) });
    return { code: workspaceCode(w.id, w.name), name: w.name, ...dashboardNumbers(t), telemetry: t };
  }));
  const total = !opts.company || opts.company.toLowerCase() === 'all'
    ? await getDashboardTelemetry({ db, monthFilter: opts.month, year: opts.year, workspaceIds: workspaces.map((w) => w.id), ctx: ctxFor(workspaces[0]?.id) })
    : null;
  return { companies, total };
}

function missingAdmins(log: DashboardUploadLogResult, day: string): string[] {
  if (!log.ok) return [];
  const uploaded = new Set(log.uploads.filter((u) => jakartaDay(new Date(u.uploadedAt)) === day).map((u) => u.admin));
  return log.admins.map((a) => a.name).filter((n) => !uploaded.has(n));
}

/** The morning report: numbers per company, money to chase, and who did not upload yesterday. */
export async function buildErpReport() {
  const now = new Date();
  const today = jakartaDay(now);
  const yesterday = jakartaDay(new Date(now.getTime() - 86400000));
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;

  const [{ companies, total }, { total: yearTotal }, profLog, relineLog] = await Promise.all([
    loadErpDashboards({ year, month }),
    loadErpDashboards({ year, month: null, onlyTotal: true }),
    getDashboardUploadLog(3),
    getRelineUploadLog(3),
  ]);

  const overdue = (total?.details?.ar || [])
    .filter((a) => a.due && String(a.due).slice(0, 10) < today)
    .sort((a, b) => b.balance - a.balance);
  const overdueTotal = overdue.reduce((s, a) => s + a.balance, 0);

  type Source = { ok: boolean; notUploaded: string[]; error?: string };
  const source = (log: DashboardUploadLogResult): Source => (log.ok ? { ok: true, notUploaded: missingAdmins(log, yesterday) } : { ok: false, notUploaded: [], error: log.error });
  const uploads = { day: yesterday, profesorToko: source(profLog), reline: source(relineLog) };

  const t = total!;
  const y = yearTotal!;
  const cov = y.monthlyCost <= 0 ? '' : y.coverageRatio >= 1.5 ? 'aman' : y.coverageRatio >= 1 ? 'tipis, di atas BEP' : 'di bawah BEP';
  const missing = [
    ...(uploads.profesorToko.ok ? uploads.profesorToko.notUploaded.map((n) => `- ${n} (Profesor Toko)`) : ['- Log Profesor Toko tidak bisa dibaca']),
    ...(uploads.reline.ok ? uploads.reline.notUploaded.map((n) => `- ${n} (Reline)`) : ['- Log Reline tidak bisa dibaca']),
  ];
  const lines = [
    `Pagi ${dayLabel(today)}`,
    '',
    `MRR ${jt(y.avgMonthlyRevenue)} | Overhead ${jt(y.monthlyCost)}`,
    y.monthlyCost > 0 ? `BEP Ratio ${y.coverageRatio.toFixed(2)}x (${cov})` : 'BEP Ratio: belum ada biaya tercatat',
    `Kas ${jt(t.totalCashFlow)} | Piutang ${jt(t.totalAR)}`,
    '',
    overdue.length ? `Perlu ditagih (${overdue.length} lewat jatuh tempo, ${jt(overdueTotal)})` : 'Tidak ada invoice lewat jatuh tempo',
    ...overdue.slice(0, 3).map((a) => `- ${a.number || 'Invoice'} ${a.client}: ${jt(a.balance)}`),
    '',
    missing.length ? `Belum upload kemarin` : 'Semua admin sudah upload kemarin',
    ...missing,
  ];

  return {
    generatedAt: now.toISOString(),
    timezone: 'Asia/Jakarta',
    period: { year, month: month + 1 },
    total: dashboardNumbers(t),
    yearTotal: dashboardNumbers(y),
    companies: companies.map(({ telemetry: _t, ...c }) => c),
    overdueInvoices: { count: overdue.length, total: Math.round(overdueTotal), top: overdue.slice(0, 10).map((a) => ({ number: a.number, client: a.client, balance: Math.round(a.balance), due: a.due })) },
    uploads,
    /** Ready to send as the WhatsApp text. */
    text: lines.join('\n'),
  };
}
