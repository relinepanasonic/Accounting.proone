import React from 'react';
import { Document, Page, View, Text, Svg, Rect, Line, Polyline, Circle, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { PerfAds } from '@/lib/integrations/performance';
import { analyze } from './analysis';
import { cvrOf, int, periodText, roasOf, roasText, rp, weekLabel, type WeekPoint, type WeeklyPayload } from './weekly';

/**
 * The weekly client report as ONE A4 page (so it also works as an image), no cover, drawn from the numbers saved with the draft (server-side).
 *   Top left: the key numbers and the ad types. Top right: "Temuan & Langkah Berikutnya" (findings and tips written from the numbers).
 *   Below: Penjualan and Biaya Iklan & ROAS per week (this week and the 4 before it), then the 5 best-selling products when the app sends them.
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

/**
 * Text the built-in PDF font can draw. Store, client and product names come from other apps and can hold characters Helvetica has no glyph
 * for (a non-breaking hyphen U+2011, emoji, Chinese...), which would print as a gap or a stray mark. Dashes become "-", odd spaces become
 * a space, invisible characters go, and whatever is outside Latin letters is dropped.
 */
export function pdfText(s: string): string {
  return String(s ?? '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u200B-\u200F\u2028-\u202E\u2060\uFEFF]/g, '')
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const pctOf = (now: number, before: number | null | undefined) => (before && before > 0 ? ((now - before) / before) * 100 : null);
const pctText = (p: number) => `${p > 0 ? '+' : p < 0 ? '-' : ''}${Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : (Math.round(Math.abs(p) * 10) / 10).toString().replace('.', ',')}%`;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);

function Kpi({ label, value, now, before, neutral = false, suffix = 'vs minggu lalu', half = false }: { label: string; value: string; now: number; before: number | null | undefined; neutral?: boolean; suffix?: string; half?: boolean }) {
  const p = pctOf(now, before);
  const color = p === null || Math.abs(p) < 0.5 ? MUTED : neutral ? AMBER : p > 0 ? GREEN : RED;
  return (
    <View style={[st.kpi, half ? { width: '48.5%', marginRight: '1.5%', marginBottom: 5, padding: 6 } : {}]} wrap={false}>
      <Text style={st.kpiLabel}>{label}</Text>
      <Text style={st.kpiValue}>{value}</Text>
      <Text style={[st.kpiChange, { color }]}>{p === null ? '-' : Math.abs(p) < 0.5 ? `0% ${suffix}` : `${pctText(p)} ${suffix}`}</Text>
    </View>
  );
}

const LINE_COLOR = '#1d4ed8';

/** Chart width and the room left of the bars (for the amount labels). Every weekly chart uses these, so their columns line up. */
export const CHART_W = 535;
export const CHART_LEFT = 46;

/**
 * Where the bars of a weekly chart stand: the middle (x) of each week's column and the bar width. It depends only on how many weeks
 * there are, so the Penjualan chart and the Biaya Iklan chart put the same week at the same x: read straight down to compare them.
 */
export function barColumns(count: number) {
  const slot = (CHART_W - CHART_LEFT) / Math.max(1, count);
  return { slot, barWidth: Math.min(46, slot * 0.5), centers: Array.from({ length: count }, (_, i) => CHART_LEFT + slot * i + slot / 2) };
}

/**
 * Bars per week (left axis) with a value label, the week under each bar, and optionally a LINE (ROAS) with a dot and a value label on every
 * week; the line has no axis of its own, its labels are the numbers. The last bar is the report week. A week without a line value (no ad spend) breaks the line instead of dropping to 0.
 */
export function WeekBars({ points, values, fmt, color, light, barName, line, height }: {
  points: WeekPoint[]; values: number[]; fmt: (n: number) => string; color: string; light: string;
  barName?: string; height?: number;
  line?: { values: number[]; fmt: (n: number) => string; name: string };
}) {
  // Both weekly charts use the same width and left margin (and no right-hand axis), so a week's bars sit in the SAME column in both:
  // read straight down to see whether ad cost and sales moved together.
  const W = CHART_W, LEFT = CHART_LEFT, RIGHT = 0, TOP = line ? 26 : 14, BOTTOM = 22;
  const H = height ?? (line ? 150 : 128);
  const plotH = H - TOP - BOTTOM;
  const top = niceMax(Math.max(...values, 0));
  const top2 = line ? niceMax(Math.max(...line.values, 0)) : 1;
  const cols = barColumns(points.length);
  const bw = cols.barWidth;
  const y = (v: number) => TOP + plotH - (plotH * v) / top;
  const y2 = (v: number) => TOP + plotH - (plotH * v) / top2;
  const cx = (i: number) => cols.centers[i];

  // the line, cut into runs of weeks that have a value
  const runs: Array<Array<{ x: number; y: number }>> = [];
  if (line) {
    let run: Array<{ x: number; y: number }> = [];
    line.values.forEach((v, i) => {
      if (v > 0) run.push({ x: cx(i), y: y2(v) });
      else if (run.length) { runs.push(run); run = []; }
    });
    if (run.length) runs.push(run);
  }

  return (
    <Svg width={W} height={H}>
      {line && (
        <>
          <Rect x={LEFT} y={4} width={8} height={8} fill={color} />
          <Text x={LEFT + 12} y={11} fill={MUTED} style={{ fontSize: 7 }}>{barName || 'Biaya'} (batang)</Text>
          <Line x1={LEFT + 140} x2={LEFT + 154} y1={8} y2={8} stroke={LINE_COLOR} strokeWidth={1.8} />
          <Circle cx={LEFT + 147} cy={8} r={2.4} fill={LINE_COLOR} />
          <Text x={LEFT + 158} y={11} fill={MUTED} style={{ fontSize: 7 }}>{line.name} (garis)</Text>
        </>
      )}
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (top * i) / 4;
        return (
          <React.Fragment key={i}>
            <Line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke={LINE} strokeWidth={0.6} />
            <Text x={LEFT - 5} y={y(v) + 2.5} fill={MUTED} style={{ fontSize: 6.5 }} textAnchor="end">{v === 0 ? '0' : shortRp(v)}</Text>
          </React.Fragment>
        );
      })}
      {points.map((p, i) => {
        const v = values[i];
        const x = cx(i) - bw / 2;
        const last = i === points.length - 1;
        const tall = TOP + plotH - y(v) > 16;
        // with a line over the bars, the value goes inside the bar at its base, where the line's labels almost never reach
        const inside = !!line && tall;
        return (
          <React.Fragment key={p.from}>
            <Rect x={x} y={y(v)} width={bw} height={Math.max(0.8, TOP + plotH - y(v))} fill={last ? color : light} />
            <Text x={x + bw / 2} y={inside ? TOP + plotH - 4 : y(v) - 3} fill={inside && last ? '#ffffff' : INK} style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">{v > 0 ? fmt(v) : '-'}</Text>
            <Text x={x + bw / 2} y={H - BOTTOM + 11} fill={last ? INK : MUTED} style={{ fontSize: 7, fontFamily: last ? 'Helvetica-Bold' : 'Helvetica' }} textAnchor="middle">{weekLabel(p.from, p.to)}</Text>
          </React.Fragment>
        );
      })}
      {runs.map((r, i) => r.length > 1 && <Polyline key={`l${i}`} points={r.map((pt) => `${pt.x},${pt.y}`).join(' ')} stroke={LINE_COLOR} strokeWidth={1.8} fill="none" />)}
      {line && line.values.map((v, i) => v > 0 && (
        <React.Fragment key={`d${i}`}>
          <Circle cx={cx(i)} cy={y2(v)} r={3} fill="#ffffff" stroke={LINE_COLOR} strokeWidth={1.6} />
          <Rect x={cx(i) - 15} y={y2(v) - 16} width={30} height={10} fill="#ffffff" fillOpacity={0.85} />
          <Text x={cx(i)} y={y2(v) - 8.5} fill={LINE_COLOR} style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }} textAnchor="middle">{line.fmt(v)}</Text>
        </React.Fragment>
      ))}
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
  const parts = [`Pada ${periodText(p.from, p.to)}, ${pdfText(p.store)} membukukan penjualan ${rp(cur.sales)}`];
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
  const products = p.products && p.products.length ? p.products.map((x) => ({ ...x, name: pdfText(x.name) })).filter((x) => x.name).slice(0, 5) : null;
  const productSum = products ? products.reduce((s, x) => s + x.sales, 0) : 0;
  const analysis = analyze(cur, prev, p.series);
  const findings = analysis.findings.slice(0, 3);
  const tips = analysis.tips.slice(0, 2);
  const who = p.client && p.client.toLowerCase() !== p.store.toLowerCase() ? `${pdfText(p.store)} · ${pdfText(p.client)}` : pdfText(p.store);

  return (
    <Document title={`Weekly Report ${periodText(p.from, p.to)} - ${p.store}`} author="Professor Online">
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

        {/* Top: the numbers on the left, the analysis on the right */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: '54%', paddingRight: 10 }}>
            <View style={st.grid}>
              <Kpi label="TOTAL PENJUALAN" value={rp(cur.sales)} now={cur.sales} before={prev?.sales} half />
              <Kpi label="TRAFFIC" value={int(cur.traffic)} now={cur.traffic} before={prev?.traffic} half />
              <Kpi label="PESANAN" value={int(cur.orders)} now={cur.orders} before={prev?.orders} half />
              <Kpi label="BIAYA IKLAN" value={rp(a.cost)} now={a.cost} before={prev?.ads.total.cost} neutral half />
              <Kpi label="ROAS (PENJUALAN / IKLAN)" value={roasNow > 0 ? roasText(cur.sales, a.cost) : '-'} now={roasNow} before={roasPrev > 0 ? roasPrev : null} half />
              <Kpi label="CONVERSION RATE" value={cvrNow > 0 ? `${(Math.round(cvrNow * 100) / 100).toString().replace('.', ',')}%` : '-'} now={cvrNow} before={cvrPrev > 0 ? cvrPrev : null} half />
            </View>
            {types.length > 0 && typeCost > 0 && (
              <View wrap={false}>
                <Text style={[st.h2, { marginTop: 4 }]}>Efisiensi Iklan Minggu Ini</Text>
                <View style={st.head}>
                  <Text style={[st.th, { width: '34%' }]}>JENIS IKLAN</Text>
                  <Text style={[st.th, { width: '26%', textAlign: 'right' }]}>BIAYA</Text>
                  <Text style={[st.th, { width: '28%', textAlign: 'right' }]}>PENJUALAN</Text>
                  <Text style={[st.th, { width: '12%', textAlign: 'right' }]}>ROAS</Text>
                </View>
                {types.map((t) => (
                  <View key={t.name} style={[st.row, { paddingVertical: 3 }]}>
                    <Text style={{ width: '34%', fontSize: 8 }}>{t.name}</Text>
                    <Text style={{ width: '26%', textAlign: 'right', fontSize: 8 }}>{shortRp(t.ads.cost)}</Text>
                    <Text style={{ width: '28%', textAlign: 'right', fontSize: 8 }}>{shortRp(t.ads.sales)}</Text>
                    <Text style={{ width: '12%', textAlign: 'right', fontSize: 8 }}>{roasText(t.ads.sales, t.ads.cost)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ width: '46%' }}>
            <Text style={[st.h2, { marginTop: 0 }]}>Temuan & Langkah Berikutnya</Text>
            {findings.map((f, i) => (
              <View key={i} style={[st.card, { padding: 6, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: f.tone === 'win' ? GREEN : AMBER }]} wrap={false}>
                <Text style={[st.tag, { color: f.tone === 'win' ? GREEN : AMBER }]}>{f.tone === 'win' ? 'WIN' : 'PERHATIAN'}</Text>
                <Text style={[st.cardTitle, { fontSize: 8.5 }]}>{f.title}</Text>
                <Text style={[st.cardText, { fontSize: 7.5, marginTop: 1 }]}>{f.text}</Text>
              </View>
            ))}
            <View style={[st.tipsBox, { padding: 6, marginTop: 2 }]} wrap={false}>
              <Text style={[st.tag, { color: AMBER }]}>REKOMENDASI MINGGU BERIKUTNYA</Text>
              {tips.map((t, i) => (
                <Text key={i} style={[st.cardText, { fontSize: 7.5, marginTop: 2 }]}>{i + 1}. {t}</Text>
              ))}
            </View>
          </View>
        </View>

        <Text style={st.h2}>Penjualan per Minggu</Text>
        <Text style={st.hint}>Minggu ini dan {Math.max(0, pts.length - 1)} minggu sebelumnya (biru tua = minggu laporan). Tiap minggu sejajar dengan batang biaya iklan di bawahnya.</Text>
        <WeekBars points={pts} values={pts.map((x) => x.sales)} fmt={shortRp} color={BLUE} light={BLUE_LIGHT} height={108} />

        <Text style={st.h2}>Biaya Iklan & ROAS per Minggu</Text>
        <Text style={st.hint}>Batang: biaya iklan per minggu, sejajar dengan batang penjualan di atas. Garis: ROAS minggu itu (penjualan dibagi biaya iklan)</Text>
        <WeekBars
          points={pts}
          values={pts.map((x) => x.adCost)}
          fmt={shortRp}
          color={AMBER}
          light={AMBER_LIGHT}
          barName="Biaya Iklan"
          height={128}
          line={{ values: pts.map((x) => (x.adCost > 0 ? x.sales / x.adCost : 0)), fmt: (n) => roasText(n, 1), name: 'ROAS' }}
        />

        {products && (
          <View wrap={false}>
            <Text style={st.h2}>5 Produk Terlaris</Text>
            {products.map((x, i) => (
              <View key={`${i}-${x.name}`} style={[st.row, { paddingVertical: 2.5 }]}>
                <Text style={{ width: '5%', color: MUTED, fontSize: 8 }}>{i + 1}</Text>
                <Text style={{ width: '65%', fontSize: 8 }}>{cut(x.name, 78)}</Text>
                <Text style={{ width: '18%', textAlign: 'right', fontSize: 8 }}>{rp(x.sales)}</Text>
                <Text style={{ width: '12%', textAlign: 'right', fontSize: 8 }}>{productSum > 0 ? `${((x.sales / productSum) * 100).toFixed(1).replace('.', ',')}%` : '-'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.footer} fixed>
          <Text>Professor Online · Weekly Report {periodText(p.from, p.to)} · ROAS = Penjualan / Biaya Iklan</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderWeeklyPdf(p: WeeklyPayload): Promise<Buffer> {
  return renderToBuffer(<WeeklyDocument p={p} />);
}
