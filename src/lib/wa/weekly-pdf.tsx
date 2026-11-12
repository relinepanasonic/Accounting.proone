import React from 'react';
import { Document, Page, View, Text, Svg, Rect, Line, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { PerfAds } from '@/lib/integrations/performance';
import { analyze } from './analysis';
import { cvrOf, int, periodText, roasOf, roasText, rp, weekLabel, type WeekPoint, type WeeklyPayload } from './weekly';

/**
 * The weekly client report as a PDF: two A4 pages, no cover, drawn from the numbers saved with the draft (server-side, no browser).
 *   Page 1: the key numbers, then Penjualan and Biaya Iklan per week for this week and the 4 before it.
 *   Page 2: the 10 best-selling products, then "Temuan & Langkah Berikutnya" (findings and tips written from the numbers).
 * Same figures and words as the monthly report of Dashboard Prof, in a lighter form.
 */

const GOLD = '#b8901f';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const GREEN = '#059669';
const RED = '#dc2626';
const BLUE = '#2563eb';
const BLUE_LIGHT = '#bfdbfe';
const AMBER = '#d97706';
const AMBER_LIGHT = '#fde68a';

const st = StyleSheet.create({
  page: { padding: 30, paddingBottom: 46, fontFamily: 'Helvetica', fontSize: 9.5, color: INK },
  band: { backgroundColor: '#1f2937', borderRadius: 6, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 7.5, color: '#fcd34d', letterSpacing: 1.4 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 2 },
  bandRight: { alignItems: 'flex-end' },
  period: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  storeName: { fontSize: 8.5, color: '#d1d5db', marginTop: 2 },
  lead: { fontSize: 9, color: '#374151', lineHeight: 1.45, marginBottom: 9 },
  h2: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: GOLD, marginTop: 8, marginBottom: 2 },
  hint: { fontSize: 7.5, color: MUTED, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpi: { width: '31.6%', marginRight: '2%', marginBottom: 6, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7 },
  kpiLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.6 },
  kpiValue: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  kpiChange: { fontSize: 7.5, marginTop: 2 },
  th: { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  head: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8, marginBottom: 6 },
  tag: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, marginBottom: 2 },
  cardTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  cardText: { fontSize: 8.5, color: '#374151', marginTop: 2, lineHeight: 1.4 },
  tipsBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: AMBER_LIGHT, borderRadius: 5, padding: 9, marginTop: 4 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7.5, color: MUTED, flexDirection: 'row', justifyContent: 'space-between' },
});

/** "2,4 jt", "125 jt", "3,1 M", "850 rb": short money for chart labels. */
export function shortRp(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(a / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',')} jt`;
  if (a >= 1_000) return `${Math.round(a / 1_000)} rb`;
  return a < 1 ? '0' : String(Math.round(a));
}

/** The next "nice" top of an axis (1, 2, 2.5, 5 x 10^k) at or above `max`. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

const pctOf = (now: number, before: number | null | undefined) => (before && before > 0 ? ((now - before) / before) * 100 : null);
const pctText = (p: number) => `${p > 0 ? '+' : p < 0 ? '-' : ''}${Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : (Math.round(Math.abs(p) * 10) / 10).toString().replace('.', ',')}%`;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);

function Kpi({ label, value, now, before, neutral = false, suffix = 'vs minggu lalu' }: { label: string; value: string; now: number; before: number | null | undefined; neutral?: boolean; suffix?: string }) {
  const p = pctOf(now, before);
  const color = p === null || Math.abs(p) < 0.5 ? MUTED : neutral ? AMBER : p > 0 ? GREEN : RED;
  return (
    <View style={st.kpi} wrap={false}>
      <Text style={st.kpiLabel}>{label}</Text>
      <Text style={st.kpiValue}>{value}</Text>
      <Text style={[st.kpiChange, { color }]}>{p === null ? '-' : Math.abs(p) < 0.5 ? `0% ${suffix}` : `${pctText(p)} ${suffix}`}</Text>
    </View>
  );
}

/** Bars per week with a value label on top, the week under it, and optional extra lines (ROAS) under that. The last bar is the report week. */
export function WeekBars({ points, values, fmt, color, light, sub }: { points: WeekPoint[]; values: number[]; fmt: (n: number) => string; color: string; light: string; sub?: string[] }) {
  const W = 535, H = 128, LEFT = 46, TOP = 14, BOTTOM = sub ? 36 : 22;
  const plotH = H - TOP - BOTTOM;
  const top = niceMax(Math.max(...values, 0));
  const slot = (W - LEFT) / points.length;
  const bw = Math.min(46, slot * 0.5);
  const y = (v: number) => TOP + plotH - (plotH * v) / top;
  return (
    <Svg width={W} height={H}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (top * i) / 4;
        return (
          <React.Fragment key={i}>
            <Line x1={LEFT} x2={W} y1={y(v)} y2={y(v)} stroke={LINE} strokeWidth={0.6} />
            <Text x={LEFT - 5} y={y(v) + 2.5} fill={MUTED} style={{ fontSize: 6.5 }} textAnchor="end">{v === 0 ? '0' : shortRp(v)}</Text>
          </React.Fragment>
        );
      })}
      {points.map((p, i) => {
        const v = values[i];
        const x = LEFT + slot * i + (slot - bw) / 2;
        const last = i === points.length - 1;
        return (
          <React.Fragment key={p.from}>
            <Rect x={x} y={y(v)} width={bw} height={Math.max(0.8, TOP + plotH - y(v))} fill={last ? color : light} />
            <Text x={x + bw / 2} y={y(v) - 3} fill={INK} style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">{v > 0 ? fmt(v) : '-'}</Text>
            <Text x={x + bw / 2} y={H - BOTTOM + 11} fill={last ? INK : MUTED} style={{ fontSize: 7, fontFamily: last ? 'Helvetica-Bold' : 'Helvetica' }} textAnchor="middle">{weekLabel(p.from, p.to)}</Text>
            {sub && <Text x={x + bw / 2} y={H - BOTTOM + 22} fill={MUTED} style={{ fontSize: 6.5 }} textAnchor="middle">{sub[i]}</Text>}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** The weeks to draw: the saved series, or (an older draft) this week and the week before. */
function pointsOf(p: WeeklyPayload): WeekPoint[] {
  if (p.series && p.series.length) return p.series;
  const prevFrom = new Date(new Date(`${p.from}T12:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const prevTo = new Date(new Date(`${p.from}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const pt = (from: string, to: string, t: typeof p.cur | null): WeekPoint => ({ from, to, sales: t?.sales || 0, adCost: t?.ads.total.cost || 0, adSales: t?.ads.total.sales || 0, orders: t?.orders || 0, traffic: t?.traffic || 0 });
  return [pt(prevFrom, prevTo, p.prev), pt(p.from, p.to, p.cur)];
}

/** The opening sentence of page 1, like the executive summary of the monthly report. */
export function summaryLine(p: WeeklyPayload): string {
  const { cur } = p;
  const parts = [`Pada ${periodText(p.from, p.to)}, ${p.store} membukukan penjualan ${rp(cur.sales)}`];
  if (cur.traffic > 0) parts[0] += ` dari ${int(cur.traffic)} pengunjung`;
  if (cur.orders > 0) parts[0] += ` dengan ${int(cur.orders)} pesanan`;
  let s = `${parts[0]}.`;
  if (cur.ads.total.cost > 0) s += ` Biaya iklan ${rp(cur.ads.total.cost)} dengan ROAS ${roasText(cur.sales, cur.ads.total.cost)}.`;
  return s;
}

const TYPES: Array<[string, 'gmvMax' | 'group' | 'independent']> = [['GMV Max Auto', 'gmvMax'], ['Iklan Grup', 'group'], ['Iklan Mandiri', 'independent']];

export function WeeklyDocument({ p }: { p: WeeklyPayload }) {
  const { cur, prev } = p;
  const pts = pointsOf(p);
  const roasNow = roasOf(cur);
  const roasPrev = roasOf(prev);
  const cvrNow = cvrOf(cur);
  const cvrPrev = cvrOf(prev);
  const a = cur.ads.total;
  const types = TYPES.map(([name, k]) => ({ name, ads: cur.ads[k] as PerfAds })).filter((t) => t.ads.cost > 0 || t.ads.sales > 0);
  const typeCost = types.reduce((s, t) => s + t.ads.cost, 0);
  const products = p.products && p.products.length ? p.products : null;
  const productSum = products ? products.reduce((s, x) => s + x.sales, 0) : 0;
  const analysis = analyze(cur, prev, p.series);
  const who = p.client && p.client.toLowerCase() !== p.store.toLowerCase() ? `${p.store} · ${p.client}` : p.store;

  const Footer = () => (
    <View style={st.footer} fixed>
      <Text>Professor Online · Weekly Report {periodText(p.from, p.to)} · ROAS = Penjualan / Biaya Iklan</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
    </View>
  );

  return (
    <Document title={`Weekly Report ${periodText(p.from, p.to)} - ${p.store}`} author="Professor Online">
      {/* ---------- Page 1: key numbers + Penjualan and Biaya Iklan per week ---------- */}
      <Page size="A4" style={st.page}>
        <View style={st.band}>
          <View>
            <Text style={st.kicker}>PROFESSOR ONLINE · LAPORAN PERFORMA MINGGUAN</Text>
            <Text style={st.title}>Weekly Report</Text>
          </View>
          <View style={st.bandRight}>
            <Text style={st.period}>{periodText(p.from, p.to)}</Text>
            <Text style={st.storeName}>{who}</Text>
          </View>
        </View>

        <Text style={st.lead}>{summaryLine(p)}</Text>

        <View style={st.grid}>
          <Kpi label="TOTAL PENJUALAN" value={rp(cur.sales)} now={cur.sales} before={prev?.sales} />
          <Kpi label="TRAFFIC" value={int(cur.traffic)} now={cur.traffic} before={prev?.traffic} />
          <Kpi label="PESANAN" value={int(cur.orders)} now={cur.orders} before={prev?.orders} />
          <Kpi label="BIAYA IKLAN" value={rp(a.cost)} now={a.cost} before={prev?.ads.total.cost} neutral />
          <Kpi label="ROAS (PENJUALAN / IKLAN)" value={roasNow > 0 ? roasText(cur.sales, a.cost) : '-'} now={roasNow} before={roasPrev > 0 ? roasPrev : null} />
          <Kpi label="CONVERSION RATE" value={cvrNow > 0 ? `${(Math.round(cvrNow * 100) / 100).toString().replace('.', ',')}%` : '-'} now={cvrNow} before={cvrPrev > 0 ? cvrPrev : null} />
        </View>

        <Text style={st.h2}>Penjualan per Minggu</Text>
        <Text style={st.hint}>Minggu ini dan {Math.max(0, pts.length - 1)} minggu sebelumnya (biru tua = minggu laporan)</Text>
        <WeekBars points={pts} values={pts.map((x) => x.sales)} fmt={shortRp} color={BLUE} light={BLUE_LIGHT} />

        <Text style={st.h2}>Biaya Iklan & ROAS per Minggu</Text>
        <Text style={st.hint}>Biaya iklan per minggu; di bawah tanggal: ROAS minggu itu (penjualan dibagi biaya iklan)</Text>
        <WeekBars points={pts} values={pts.map((x) => x.adCost)} fmt={shortRp} color={AMBER} light={AMBER_LIGHT} sub={pts.map((x) => (x.adCost > 0 ? `ROAS ${roasText(x.sales, x.adCost)}` : 'ROAS -'))} />

        {types.length > 0 && typeCost > 0 && (
          <View wrap={false}>
            <Text style={st.h2}>Efisiensi Iklan Minggu Ini</Text>
            <View style={st.head}>
              <Text style={[st.th, { width: '28%' }]}>JENIS IKLAN</Text>
              <Text style={[st.th, { width: '24%', textAlign: 'right' }]}>BIAYA IKLAN</Text>
              <Text style={[st.th, { width: '24%', textAlign: 'right' }]}>PENJUALAN</Text>
              <Text style={[st.th, { width: '12%', textAlign: 'right' }]}>ROAS</Text>
              <Text style={[st.th, { width: '12%', textAlign: 'right' }]}>PORSI BIAYA</Text>
            </View>
            {types.map((t) => (
              <View key={t.name} style={st.row}>
                <Text style={{ width: '28%' }}>{t.name}</Text>
                <Text style={{ width: '24%', textAlign: 'right' }}>{rp(t.ads.cost)}</Text>
                <Text style={{ width: '24%', textAlign: 'right' }}>{rp(t.ads.sales)}</Text>
                <Text style={{ width: '12%', textAlign: 'right' }}>{roasText(t.ads.sales, t.ads.cost)}</Text>
                <Text style={{ width: '12%', textAlign: 'right' }}>{Math.round((t.ads.cost / typeCost) * 100)}%</Text>
              </View>
            ))}
          </View>
        )}
        <Footer />
      </Page>

      {/* ---------- Page 2: top products + findings ---------- */}
      <Page size="A4" style={st.page}>
        <Text style={[st.h2, { marginTop: 0 }]}>10 Produk Terlaris — {periodText(p.from, p.to)}</Text>
        {products ? (
          <View wrap={false}>
            <View style={st.head}>
              <Text style={[st.th, { width: '6%' }]}>#</Text>
              <Text style={[st.th, { width: '62%' }]}>PRODUK</Text>
              <Text style={[st.th, { width: '20%', textAlign: 'right' }]}>PENJUALAN</Text>
              <Text style={[st.th, { width: '12%', textAlign: 'right' }]}>% TOP 10</Text>
            </View>
            {products.slice(0, 10).map((x, i) => (
              <View key={`${i}-${x.name}`} style={st.row}>
                <Text style={{ width: '6%', color: MUTED }}>{i + 1}</Text>
                <Text style={{ width: '62%' }}>{cut(x.name, 70)}</Text>
                <Text style={{ width: '20%', textAlign: 'right' }}>{rp(x.sales)}</Text>
                <Text style={{ width: '12%', textAlign: 'right' }}>{productSum > 0 ? `${((x.sales / productSum) * 100).toFixed(1).replace('.', ',')}%` : '-'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[st.card, { borderStyle: 'dashed' }]}>
            <Text style={st.cardText}>Data produk minggu ini belum tersedia. Daftar produk terlaris akan tampil di sini setelah data produk dari dashboard toko tersambung.</Text>
          </View>
        )}

        <Text style={[st.h2, { marginTop: 14 }]}>Temuan & Langkah Berikutnya</Text>
        {analysis.findings.map((f, i) => (
          <View key={i} style={[st.card, { borderLeftWidth: 3, borderLeftColor: f.tone === 'win' ? GREEN : AMBER }]} wrap={false}>
            <Text style={[st.tag, { color: f.tone === 'win' ? GREEN : AMBER }]}>{f.tone === 'win' ? 'WIN' : 'PERHATIAN'}</Text>
            <Text style={st.cardTitle}>{f.title}</Text>
            <Text style={st.cardText}>{f.text}</Text>
          </View>
        ))}
        <View style={st.tipsBox} wrap={false}>
          <Text style={[st.tag, { color: AMBER }]}>REKOMENDASI TINDAKAN — MINGGU BERIKUTNYA</Text>
          {analysis.tips.map((t, i) => (
            <Text key={i} style={[st.cardText, { marginTop: 3 }]}>{i + 1}. {t}</Text>
          ))}
        </View>
        <Footer />
      </Page>
    </Document>
  );
}

export async function renderWeeklyPdf(p: WeeklyPayload): Promise<Buffer> {
  return renderToBuffer(<WeeklyDocument p={p} />);
}
