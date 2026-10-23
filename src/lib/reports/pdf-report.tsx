import React from 'react';
import { Document, Page, View, Text, Svg, Rect, Line, Path, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { loadErpDashboards } from '@/lib/api/erp-report';
import { PT_WORKSPACE_ID } from '@/lib/workspaces/known';
import type { DashboardTelemetry } from '@/lib/data/dashboard';
import { dmy, rp, inRange, type ReportData } from '@/lib/reports/whatsapp-report';
import { MONTH_NAMES_ID, type ReportCompany } from '@/lib/reports/report-files';

const GOLD = '#b8901f';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const GREEN = '#059669';
const RED = '#dc2626';
const BLUE = '#2563eb';
const AMBER = '#d97706';

const short = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000_000) return `${sign}${(a / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',')} jt`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)} rb`;
  return a < 1 ? '0' : `${sign}${Math.round(a)}`;
};
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const st = StyleSheet.create({
  page: { padding: 28, paddingBottom: 40, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  band: { backgroundColor: '#1f2937', color: '#ffffff', borderRadius: 6, padding: 14, marginBottom: 12 },
  bandKicker: { fontSize: 8, color: '#fcd34d', letterSpacing: 1.5 },
  bandTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 3 },
  bandSub: { fontSize: 9, color: '#d1d5db', marginTop: 3 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GOLD, marginBottom: 6, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpi: { width: '23.4%', marginRight: '1.6%', marginBottom: 6, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7 },
  kpiLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.6 },
  kpiValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  card: { width: '49%', marginRight: '1%', marginBottom: 8, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7 },
  cardTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  advice: { borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', borderRadius: 5, padding: 8, marginBottom: 10 },
  adviceTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AMBER, marginBottom: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  th: { fontSize: 7.5, color: MUTED, fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED },
});

// ---------------------------------------------------------------- charts (plain SVG shapes)

type Series = { name: string; color: string; values: number[] };

function axis(min: number, max: number) {
  const hi = max <= 0 ? 1 : max;
  const lo = Math.min(0, min);
  return { lo, hi, span: hi - lo || 1 };
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
      {series.map((s) => (
        <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <View style={{ width: 6, height: 6, backgroundColor: s.color, marginRight: 3 }} />
          <Text style={{ fontSize: 7, color: MUTED }}>{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

function BarChart({ labels, series, w = 232, h = 110 }: { labels: string[]; series: Series[]; w?: number; h?: number }) {
  const left = 34, bottom = 14, top = 4;
  const all = series.flatMap((s) => s.values);
  const { lo, hi, span } = axis(Math.min(...all, 0), Math.max(...all, 0));
  const plotH = h - bottom - top;
  const y = (v: number) => top + plotH - ((v - lo) / span) * plotH;
  const groupW = (w - left - 4) / Math.max(1, labels.length);
  const barW = Math.max(1.5, (groupW * 0.72) / series.length);
  const ticks = [0, 0.5, 1].map((t) => lo + span * t);
  return (
    <View>
      <Legend series={series} />
      <Svg width={w} height={h}>
        {ticks.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={left} x2={w} y1={y(t)} y2={y(t)} stroke={LINE} strokeWidth={0.5} />
            <Text x={left - 3} y={y(t) + 2} style={{ fontSize: 6, fill: MUTED }} textAnchor="end">{short(t)}</Text>
          </React.Fragment>
        ))}
        {labels.map((l, i) => (
          <Text key={l + i} x={left + groupW * i + groupW / 2} y={h - 3} style={{ fontSize: 6, fill: MUTED }} textAnchor="middle">{l}</Text>
        ))}
        {series.map((s, si) => s.values.map((v, i) => {
          const x = left + groupW * i + groupW * 0.14 + si * barW;
          const y0 = y(0), y1 = y(v);
          return <Rect key={`${si}-${i}`} x={x} y={Math.min(y0, y1)} width={barW} height={Math.max(0.4, Math.abs(y0 - y1))} fill={s.color} />;
        }))}
      </Svg>
    </View>
  );
}

function LineChart({ labels, values, color, w = 232, h = 100, fmt = short, mid }: { labels: string[]; values: number[]; color: string; w?: number; h?: number; fmt?: (n: number) => string; mid?: number }) {
  const left = 34, bottom = 14, top = 6;
  let { lo, hi, span } = axis(Math.min(...values, 0), Math.max(...values, 0));
  // With a mid value (break-even = 1.0) the chart is centred on it.
  if (mid !== undefined) { const d = Math.max(0.5, ...values.map((v) => Math.abs(v - mid))); lo = mid - d; hi = mid + d; span = hi - lo; }
  const plotH = h - bottom - top;
  const step = (w - left - 6) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [left + step * i, top + plotH - ((v - lo) / span) * plotH] as const);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${top + plotH} L${pts[0][0].toFixed(1)},${top + plotH} Z`;
  const ticks = [0, 0.5, 1].map((t) => lo + span * t);
  return (
    <Svg width={w} height={h}>
      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={left} x2={w} y1={top + plotH - ((t - lo) / span) * plotH} y2={top + plotH - ((t - lo) / span) * plotH} stroke={LINE} strokeWidth={0.5} />
          <Text x={left - 3} y={top + plotH - ((t - lo) / span) * plotH + 2} style={{ fontSize: 6, fill: MUTED }} textAnchor="end">{fmt(t)}</Text>
        </React.Fragment>
      ))}
      {labels.map((l, i) => (i % 1 === 0 ? <Text key={l + i} x={left + step * i} y={h - 3} style={{ fontSize: 6, fill: MUTED }} textAnchor="middle">{l}</Text> : null))}
      <Path d={area} fill={color} fillOpacity={0.12} />
      <Path d={path} stroke={color} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

function HBarChart({ items, color, w = 232, fmt = short }: { items: Array<{ label: string; value: number }>; color: string; w?: number; fmt?: (n: number) => string }) {
  if (items.length === 0) return <Text style={st.muted}>No data in this period.</Text>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const rowH = 14, labelW = 88, valueW = 38;
  const barMax = w - labelW - valueW;
  return (
    <Svg width={w} height={items.length * rowH + 2}>
      {items.map((it, i) => (
        <React.Fragment key={it.label + i}>
          <Text x={0} y={i * rowH + 9} style={{ fontSize: 7, fill: INK }}>{cut(it.label, 20)}</Text>
          <Rect x={labelW} y={i * rowH + 2} width={Math.max(1, (it.value / max) * barMax)} height={9} fill={color} />
          <Text x={w} y={i * rowH + 9} style={{ fontSize: 7, fill: MUTED }} textAnchor="end">{fmt(it.value)}</Text>
        </React.Fragment>
      ))}
    </Svg>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={st.card} wrap={false}>
    <Text style={st.cardTitle}>{title}</Text>
    {children}
  </View>
);

// ---------------------------------------------------------------- data

export interface CompanyReport {
  code: ReportCompany;
  year: number;
  month: number; // 1-12, the month of the period
  month$: ReturnType<typeof numbers>;
  tel: DashboardTelemetry; // the whole year: monthly series
  newCustomers: number;
  recurringCustomers: number;
}

function numbers(t: DashboardTelemetry) {
  return {
    cash: t.totalCashFlow, ar: t.totalAR, revenue: t.totalRevenue, paid: t.paidRevenue, overhead: t.totalCost,
    mrr: t.avgMonthlyRevenue, coverage: t.coverageRatio, monthlyOverhead: t.monthlyCost, cogs: t.totalCogs, expenses: t.totalExpenses,
  };
}

/** The company's own numbers and charts. ProOne = Prof Toko Online (own books + what PLIG holds for it), PLIG = PT Pintu Langit. */
export async function gatherCompanyReport(code: ReportCompany, data: ReportData): Promise<CompanyReport> {
  const year = Number(data.plan.to.slice(0, 4));
  const month = Number(data.plan.to.slice(5, 7));
  const [yearRes, monthRes] = await Promise.all([
    loadErpDashboards({ year, month: null, company: code }),
    loadErpDashboards({ year, month: month - 1, company: code }),
  ]);
  const tel = yearRes.companies[0]?.telemetry;
  const mt = monthRes.companies[0]?.telemetry;
  if (!tel || !mt) throw new Error(`No dashboard numbers for ${code}.`);

  // New customer = first invoice of that customer falls in the period; recurring = bought before and again in the period.
  const db = createAdminClient();
  const { data: ws } = await db.from('workspaces').select('id, name');
  const wsId = (ws || []).find((w: any) => (code === 'PLIG' ? w.id === PT_WORKSPACE_ID : /prof toko/i.test(w.name)))?.id as string | undefined;
  const { data: inv } = await db.from('invoices').select('issue_date, status, workspace_id, assigned_workspace_id, clients(name)').eq('is_quotation', false).lte('issue_date', data.plan.to);
  const mine = (inv || []).filter((i: any) => {
    if (['draft', 'cancelled', 'canceled', 'void'].includes(String(i.status || '').toLowerCase())) return false;
    if (!wsId) return true;
    return code === 'PLIG' ? i.workspace_id === wsId : i.workspace_id === wsId || (i.workspace_id === PT_WORKSPACE_ID && i.assigned_workspace_id === wsId);
  });
  const nameOf = (i: any) => String((Array.isArray(i.clients) ? i.clients[0]?.name : i.clients?.name) || '').trim().toLowerCase();
  const before = new Set(mine.filter((i: any) => String(i.issue_date || '').slice(0, 10) < data.plan.from).map(nameOf).filter(Boolean));
  const inPeriod = new Set(mine.filter((i: any) => inRange(String(i.issue_date || '').slice(0, 10), data.plan.from, data.plan.to)).map(nameOf).filter(Boolean));
  let newCustomers = 0; let recurringCustomers = 0;
  for (const n of inPeriod) before.has(n) ? recurringCustomers++ : newCustomers++;

  return { code, year, month, month$: numbers(mt), tel, newCustomers, recurringCustomers };
}

// ---------------------------------------------------------------- document

const Kpi = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <View style={st.kpi}>
    <Text style={st.kpiLabel}>{label.toUpperCase()}</Text>
    <Text style={[st.kpiValue, tone ? { color: tone } : {}]}>{value}</Text>
  </View>
);

function Table({ head, rows, widths }: { head: string[]; rows: string[][]; widths: number[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={[st.row, { borderBottomColor: '#9ca3af' }]}>{head.map((h, i) => <Text key={h} style={[st.th, { width: `${widths[i]}%`, textAlign: i === 0 ? 'left' : 'right' }]}>{h}</Text>)}</View>
      {rows.length === 0 && <Text style={[st.muted, { paddingVertical: 4 }]}>No data.</Text>}
      {rows.map((r, ri) => (
        <View key={ri} style={st.row} wrap={false}>
          {r.map((c, i) => <Text key={i} style={{ width: `${widths[i]}%`, textAlign: i === 0 ? 'left' : 'right' }}>{c}</Text>)}
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ data, company }: { data: ReportData; company: CompanyReport }) {
  const { plan } = data;
  const kind = plan.kind === 'monthly' ? 'Monthly' : 'Weekly';
  const monthName = MONTH_NAMES_ID[company.month - 1];
  const t = company.tel;
  const n = company.month$;
  const labels = t.revenueVsCost.labels;
  const currentIdx = company.month - 1;
  const upto = (arr: number[]) => arr.map((v, i) => (i <= currentIdx ? v : 0));
  const sales = data.sales || [];
  const admin = data.admin?.lines || [];
  const adv = data.advertisers || [];
  const todo = data.todo;
  const foot = (
    <View style={st.footer} fixed>
      <Text>{company.code} · {kind} report · {dmy(plan.from)} - {dmy(plan.to)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`${company.code} ${kind} report ${plan.from}`} author="Profesor Online">
      <Page size="A4" style={st.page}>
        <View style={st.band}>
          <Text style={st.bandKicker}>PROFESOR ONLINE · {kind.toUpperCase()} REPORT</Text>
          <Text style={st.bandTitle}>{company.code}</Text>
          <Text style={st.bandSub}>{dmy(plan.from)} - {dmy(plan.to)} · {monthName} {company.year}</Text>
        </View>

        <Text style={st.h2}>Accounting</Text>
        <View style={st.grid}>
          <Kpi label="Cash Total" value={rp(n.cash)} tone={n.cash < 0 ? RED : INK} />
          <Kpi label="Revenue" value={rp(n.revenue)} />
          <Kpi label="A/R Total" value={rp(n.ar)} tone={AMBER} />
          <Kpi label="Overhead" value={rp(n.overhead)} />
          <Kpi label="MRR" value={rp(n.mrr)} />
          <Kpi label="BEP Ratio" value={n.monthlyOverhead > 0 ? `${n.coverage.toFixed(2)}x` : '-'} tone={n.monthlyOverhead > 0 ? (n.coverage >= 1 ? GREEN : RED) : MUTED} />
          <Kpi label="New Customer" value={String(company.newCustomers)} />
          <Kpi label="Recurring Customer" value={String(company.recurringCustomers)} />
        </View>

        {data.advice ? (
          <View style={st.advice} wrap={false}>
            <Text style={st.adviceTitle}>Saran Prof</Text>
            {data.advice.split('\n').filter(Boolean).map((l, i) => <Text key={i} style={{ marginBottom: 2 }}>{l}</Text>)}
          </View>
        ) : null}

        <Text style={st.h2}>Charts {company.year}</Text>
        <View style={st.grid}>
          <Card title="Revenue vs Overhead (per month)">
            <BarChart labels={labels} series={[{ name: 'Revenue', color: GOLD, values: upto(t.revenueVsCost.revenue) }, { name: 'Overhead', color: RED, values: upto(t.revenueVsCost.cost) }]} />
          </Card>
          <Card title="Profit (per month)">
            <BarChart labels={t.pnl.labels} series={[{ name: 'Profit', color: GREEN, values: upto(t.pnl.profit) }]} />
          </Card>
          <Card title="Cash balance">
            <LineChart labels={t.liveCash.labels} values={upto(t.liveCash.balance)} color={BLUE} />
          </Card>
          <Card title="A/R (per month)">
            <BarChart labels={labels} series={[{ name: 'A/R', color: AMBER, values: upto(t.cards?.ar.series || []) }]} />
          </Card>
          <Card title="BEP ratio (MRR / overhead) - dashed line = 1.0">
            <LineChart labels={labels} values={upto(t.cards?.coverage.series || [])} color={GREEN} fmt={(v) => `${v.toFixed(1)}x`} mid={1} />
          </Card>
          <Card title="Top expenses">
            <HBarChart items={t.topExpenses.slice(0, 6).map((e) => ({ label: e.name, value: e.amount }))} color={RED} />
          </Card>
          <Card title="Top clients (revenue)">
            <HBarChart items={t.topClients.slice(0, 6).map((c) => ({ label: c.name, value: c.revenue }))} color={GOLD} />
          </Card>
          <Card title="Top products (revenue)">
            <HBarChart items={t.topProducts.slice(0, 6).map((p) => ({ label: p.name, value: p.revenue }))} color={BLUE} />
          </Card>
        </View>

        <View style={[st.band, { marginTop: 8 }]} wrap={false}>
          <Text style={st.bandKicker}>GROUP DIVISIONS</Text>
          <Text style={st.bandTitle}>{kind} by division</Text>
          <Text style={st.bandSub}>{dmy(plan.from)} - {dmy(plan.to)} · compared with {dmy(plan.prevFrom)} - {dmy(plan.prevTo)}</Text>
        </View>

        <Text style={st.h2}>Sales</Text>
        <Table head={['Salesman', 'New Leads', 'New Contacts', 'New Invoice', 'Before (L | C | I)']} widths={[28, 15, 17, 17, 23]}
          rows={sales.map((s) => [s.name, String(s.now.leads), String(s.now.contacts), String(s.now.invoices), `${s.before.leads} | ${s.before.contacts} | ${s.before.invoices}`])} />
        {sales.length > 0 && (
          <View style={[st.card, { width: '100%', marginRight: 0 }]} wrap={false}>
            <Text style={st.cardTitle}>New Leads / Contacts / Invoice</Text>
            <BarChart w={490} h={90} labels={sales.map((s) => cut(s.name, 12))} series={[
              { name: 'Leads', color: BLUE, values: sales.map((s) => s.now.leads) },
              { name: 'Contacts', color: GOLD, values: sales.map((s) => s.now.contacts) },
              { name: 'Invoice', color: GREEN, values: sales.map((s) => s.now.invoices) },
            ]} />
          </View>
        )}

        <Text style={st.h2}>Admin</Text>
        <Table head={['Admin', 'File upload', 'Clients', 'On schedule', 'Late']} widths={[28, 17, 17, 19, 19]}
          rows={admin.map((a) => [a.name, String(a.files), `${a.uploaded}/${a.total}`, String(a.onSchedule), String(a.late.length)])} />
        {admin.filter((a) => a.late.length).map((a) => (
          <Text key={a.name} style={{ marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Late upload ({a.name}): </Text>{a.late.slice(0, 20).join(', ')}{a.late.length > 20 ? ` +${a.late.length - 20}` : ''}</Text>
        ))}
        {data.admin ? <Text style={[st.muted, { marginBottom: 8 }]}>FO: {data.admin.fo.count} FO · {data.admin.fo.clients} clients</Text> : null}

        <Text style={st.h2}>Advertiser</Text>
        <Table head={['Advertiser', 'Sesi 1', 'Sesi 2', 'Total']} widths={[34, 22, 22, 22]}
          rows={adv.map((a) => [a.name, `${a.s1} / ${a.total}`, `${a.s2} / ${a.total}`, String(a.total)])} />
        <Text style={[st.muted, { marginBottom: 8 }]}>GMV Client and Budget Ads per advertiser: waiting for the Dashboard Prof and Reline connection.</Text>

        <Text style={st.h2}>To Do</Text>
        <Text style={{ marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>1. Need acc nego: </Text>{todo ? `${todo.accNego.length} client${todo.accNego.length ? ` (${todo.accNego.slice(0, 6).join(', ')})` : ''}` : '-'}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>2. Schedule</Text>
        {todo?.schedule.length ? todo.schedule.map((s, i) => <Text key={i} style={{ marginLeft: 10, marginBottom: 1 }}>- {s}</Text>) : <Text style={{ marginLeft: 10 }}>-</Text>}
        <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 2 }}>3. To Do list</Text>
        {todo?.tasks.length ? todo.tasks.map((s, i) => <Text key={i} style={{ marginLeft: 10, marginBottom: 1 }}>- {s}</Text>) : <Text style={{ marginLeft: 10 }}>-</Text>}
        {foot}
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportData, code: ReportCompany): Promise<Buffer> {
  const company = await gatherCompanyReport(code, data);
  return renderToBuffer(<ReportDocument data={data} company={company} />);
}
