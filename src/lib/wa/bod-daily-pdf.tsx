import React from 'react';
import { Document, Page, View, Text, Svg, Polyline, Circle, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { dmy, rp } from '@/lib/reports/whatsapp-report';
import { ensureFonts, pdfText, shortRp } from './weekly-pdf';
import { STAGES, ENDING_WINDOW_DAYS, type BodDaily, type EndingClient } from './bod-daily';

/**
 * The daily BOD report as a PDF for Nico and Herlan: Advertising, Admin, Sales (each starts on its own page; a long table continues on the next).
 * Drawn from the data of bod-daily.ts. Charts are shapes plus normal text (never SVG text, which ignores the embedded font).
 */

const GOLD = '#b8901f', INK = '#111827', MUTED = '#6b7280', LINE = '#e5e7eb', GREEN = '#059669', RED = '#dc2626', BLUE = '#2563eb', AMBER = '#d97706';
const STAGE_COLOR: Record<string, string> = { Lead: '#93c5fd', Contacted: '#60a5fa', Negotiation: '#f59e0b', Invoice: '#a78bfa', Deal: '#10b981', 'Cold Case': '#9ca3af' };

const st = StyleSheet.create({
  page: { padding: 28, paddingBottom: 44, fontFamily: 'Roboto', fontSize: 9, color: INK },
  band: { backgroundColor: '#1f2937', borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 7.5, color: '#fcd34d', letterSpacing: 1.4 },
  title: { fontSize: 15, fontFamily: 'Roboto', fontWeight: 700, color: '#ffffff', marginTop: 2 },
  period: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: '#ffffff', textAlign: 'right' },
  sub: { fontSize: 8, color: '#d1d5db', marginTop: 2, textAlign: 'right' },
  h2: { fontSize: 10.5, fontFamily: 'Roboto', fontWeight: 700, color: GOLD, marginTop: 8, marginBottom: 3 },
  hint: { fontSize: 7.5, color: MUTED, marginBottom: 4 },
  kpiRow: { flexDirection: 'row', marginBottom: 6 },
  kpi: { flexGrow: 1, flexBasis: 0, marginRight: 6, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7 },
  kpiLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.6 },
  kpiValue: { fontSize: 12.5, fontFamily: 'Roboto', fontWeight: 700, marginTop: 3 },
  th: { fontSize: 7, color: MUTED, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 0.4 },
  head: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 3 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 3.5, alignItems: 'center' },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, fontSize: 7.5, color: MUTED, flexDirection: 'row', justifyContent: 'space-between' },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8, marginBottom: 6 },
});

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);
const roasTxt = (n: number) => (n > 0 ? `${(Math.round(n * 10) / 10).toString().replace('.', ',')}x` : '-');
const money = (n: number) => (n > 0 ? shortRp(n) : '-');
const pctTxt = (p: number | null) => (p === null ? '' : Math.abs(p) < 0.5 ? '0%' : `${p > 0 ? '+' : '-'}${Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : (Math.round(Math.abs(p) * 10) / 10).toString().replace('.', ',')}%`);

/** A small line of the last days. No text inside: only shapes. */
export function Spark({ values, color, w = 56, h = 16 }: { values: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...values, 0);
  const n = values.length;
  const x = (i: number) => 2 + ((w - 4) * i) / Math.max(1, n - 1);
  const y = (v: number) => (max > 0 ? h - 2 - ((h - 4) * v) / max : h - 2);
  // the days without a number break the line instead of dropping to zero
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];
  values.forEach((v, i) => { if (v > 0) run.push({ x: x(i), y: y(v) }); else if (run.length) { runs.push(run); run = []; } });
  if (run.length) runs.push(run);
  const last = values[n - 1] > 0 ? { x: x(n - 1), y: y(values[n - 1]) } : null;
  return (
    <Svg width={w} height={h}>
      {runs.map((r, i) => r.length > 1 && <Polyline key={i} points={r.map((p) => `${p.x},${p.y}`).join(' ')} stroke={color} strokeWidth={1.2} fill="none" />)}
      {last && <Circle cx={last.x} cy={last.y} r={1.8} fill={color} />}
    </Svg>
  );
}

function Header({ title, kicker, day, right }: { title: string; kicker: string; day: string; right?: string }) {
  return (
    <View style={st.band}>
      <View><Text style={st.kicker}>{kicker}</Text><Text style={st.title}>{title}</Text></View>
      <View><Text style={st.period}>{dmy(day)}</Text>{right ? <Text style={st.sub}>{right}</Text> : null}</View>
    </View>
  );
}

const Kpi = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <View style={st.kpi}><Text style={st.kpiLabel}>{label}</Text><Text style={st.kpiValue}>{value}</Text>{note ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{note}</Text> : null}</View>
);

// Sales and ROAS: up is good (green), down is bad (red). Ad cost going up or down is neither: amber.
const trendColor = (p: number | null, neutral = false) => (p === null || Math.abs(p) < 0.5 ? MUTED : neutral ? AMBER : p > 0 ? GREEN : RED);

function EndingTable({ title, rows, ago, empty }: { title: string; rows: EndingClient[]; ago?: boolean; empty: string }) {
  return (
    <View>
      <Text style={st.h2}>{title} ({rows.length})</Text>
      {rows.length === 0 ? <Text style={{ fontSize: 8.5, color: MUTED }}>{empty}</Text> : (
        <View>
          <View style={st.head}>
            <Text style={[st.th, { width: '44%' }]}>CLIENT</Text>
            <Text style={[st.th, { width: '20%' }]}>SELESAI</Text>
            <Text style={[st.th, { width: '18%', textAlign: 'right' }]}>{ago ? 'SUDAH' : 'SISA'}</Text>
            <Text style={[st.th, { width: '18%', textAlign: 'right' }]}>SALES</Text>
          </View>
          {rows.map((r) => (
            <View key={`${r.client}|${r.endDate}`} style={st.row} wrap={false}>
              <Text style={{ width: '44%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(r.client), 38)}</Text>
              <Text style={{ width: '20%', fontSize: 8.5 }}>{dmy(r.endDate)}</Text>
              <Text style={{ width: '18%', fontSize: 8.5, textAlign: 'right', color: ago ? RED : AMBER }}>{r.days === 0 ? 'hari ini' : `${r.days} hari`}</Text>
              <Text style={{ width: '18%', fontSize: 8, textAlign: 'right', color: MUTED }}>{cut(pdfText(r.sales) || '-', 14)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function BodDailyDocument({ d }: { d: BodDaily }) {
  const s = d.sessions;
  const maxStage = Math.max(1, ...d.pipeline.stages.map((x) => x.count));
  return (
    <Document title={`Daily BOD Report ${dmy(d.reportDay)}`} author="Professor Online">
      {/* ---------------------------------------------------------------- 1. Advertising */}
      <Page size="A4" style={st.page}>
        <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title="1. Advertising" day={d.reportDay} right={`Sales & Ads Cost: ${dmy(d.dataDay)}`} />

        <Text style={st.h2}>Sesi yang sudah diinput kemarin ({dmy(d.reportDay)})</Text>
        <View style={st.kpiRow}>
          <Kpi label="SESI 1" value={`${s.s1} / ${s.clients}`} note="client" />
          <Kpi label="SESI 2" value={`${s.s2} / ${s.clients}`} note="client" />
          <Kpi label="SESI 3" value={`${s.s3} / ${s.clients}`} note="client" />
          <View style={[st.kpi, { marginRight: 0 }]}>
            <Text style={st.kpiLabel}>PER ADVERTISER (SESI 1 · 2 · 3)</Text>
            {d.advertisers.length === 0 ? <Text style={{ fontSize: 8, marginTop: 3, color: MUTED }}>-</Text> : d.advertisers.map((a) => (
              <Text key={a.name} style={{ fontSize: 8, marginTop: 2 }}>{pdfText(a.name)}: {a.s1}/{a.clients} · {a.s2}/{a.clients} · {a.s3}/{a.clients}</Text>
            ))}
          </View>
        </View>

        <Text style={st.h2}>Sales, Biaya Iklan dan ROAS ({dmy(d.dataDay)})</Text>
        <Text style={st.hint}>Angka hari {dmy(d.dataDay)} dari Sesi 1 yang diinput kemarin. Garis kecil = 7 hari terakhir. Persen = dibanding hari sebelumnya.</Text>
        <View style={st.kpiRow}>
          <Kpi label="TOTAL SALES" value={rp(d.totals.sales)} />
          <Kpi label="TOTAL BIAYA IKLAN" value={rp(d.totals.cost)} />
          <Kpi label="ROAS" value={roasTxt(d.totals.roas)} />
        </View>

        <View style={st.head} fixed>
          <Text style={[st.th, { width: '27%' }]}>CLIENT · TOKO</Text>
          <Text style={[st.th, { width: '14%', textAlign: 'right' }]}>SALES</Text>
          <Text style={[st.th, { width: '11%', textAlign: 'center' }]}>GRAFIK</Text>
          <Text style={[st.th, { width: '14%', textAlign: 'right' }]}>BIAYA IKLAN</Text>
          <Text style={[st.th, { width: '11%', textAlign: 'center' }]}>GRAFIK</Text>
          <Text style={[st.th, { width: '10%', textAlign: 'right' }]}>ROAS</Text>
          <Text style={[st.th, { width: '13%', textAlign: 'center' }]}>GRAFIK</Text>
        </View>
        {d.ads.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 6 }}>Belum ada angka Sales / Biaya Iklan dari input advertiser.</Text>}
        {d.ads.map((r) => (
          <View key={`${r.client}|${r.store}`} style={st.row} wrap={false}>
            <View style={{ width: '27%', paddingRight: 4 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(r.client), 26)}</Text>
              {r.store ? <Text style={{ fontSize: 7, color: MUTED }}>{cut(pdfText(r.store), 30)}</Text> : null}
            </View>
            <View style={{ width: '14%' }}>
              <Text style={{ fontSize: 8, textAlign: 'right' }}>{money(r.sales)}</Text>
              <Text style={{ fontSize: 6.5, textAlign: 'right', color: trendColor(r.salesTrend) }}>{pctTxt(r.salesTrend)}</Text>
            </View>
            <View style={{ width: '11%', alignItems: 'center' }}><Spark values={r.salesSeries} color={BLUE} /></View>
            <View style={{ width: '14%' }}>
              <Text style={{ fontSize: 8, textAlign: 'right' }}>{money(r.cost)}</Text>
              <Text style={{ fontSize: 6.5, textAlign: 'right', color: trendColor(r.costTrend, true) }}>{pctTxt(r.costTrend)}</Text>
            </View>
            <View style={{ width: '11%', alignItems: 'center' }}><Spark values={r.costSeries} color={AMBER} /></View>
            <View style={{ width: '10%' }}>
              <Text style={{ fontSize: 8, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700 }}>{roasTxt(r.roas)}</Text>
              <Text style={{ fontSize: 6.5, textAlign: 'right', color: trendColor(r.roasTrend) }}>{pctTxt(r.roasTrend)}</Text>
            </View>
            <View style={{ width: '13%', alignItems: 'center' }}><Spark values={r.roasSeries} color={GREEN} /></View>
          </View>
        ))}
        <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(d.reportDay)} · ROAS = Sales / Biaya Iklan</Text></View>
      </Page>

      {/* ---------------------------------------------------------------- 2. Admin */}
      <Page size="A4" style={st.page}>
        <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title="2. Admin" day={d.reportDay} right="Upload client dan Friends Order" />
        <Text style={st.h2}>Upload client kemarin ({dmy(d.reportDay)})</Text>
        {d.admin.errors.length > 0 && <Text style={{ fontSize: 7.5, color: AMBER, marginBottom: 4 }}>{d.admin.errors.map(pdfText).join('; ')}</Text>}
        {d.admin.lines.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED }}>Data upload belum bisa dibaca.</Text>}
        {d.admin.lines.map((a) => (
          <View key={a.name} style={st.card} wrap={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 700 }}>{pdfText(a.name)}</Text>
              <Text style={{ fontSize: 9 }}>{a.uploaded} / {a.total} client · {a.files} file</Text>
            </View>
            <Text style={{ fontSize: 7, color: GREEN, marginTop: 5, letterSpacing: 0.5, fontFamily: 'Roboto', fontWeight: 700 }}>SUDAH UPLOAD ({a.uploadedNames.length})</Text>
            <Text style={{ fontSize: 8, marginTop: 1, lineHeight: 1.4 }}>{a.uploadedNames.length ? a.uploadedNames.map(pdfText).join(', ') : '-'}</Text>
            <Text style={{ fontSize: 7, color: RED, marginTop: 5, letterSpacing: 0.5, fontFamily: 'Roboto', fontWeight: 700 }}>BELUM UPLOAD ({a.pendingNames.length})</Text>
            <Text style={{ fontSize: 8, marginTop: 1, lineHeight: 1.4 }}>{a.pendingNames.length ? a.pendingNames.map(pdfText).join(', ') : '-'}</Text>
          </View>
        ))}
        <Text style={st.h2}>Friends Order (FO)</Text>
        <View style={st.kpiRow}>
          <Kpi label="FO DIMULAI KEMARIN" value={String(d.admin.fo.startedOnDay.length)} note={d.admin.fo.startedOnDay.length ? Array.from(new Set(d.admin.fo.startedOnDay)).map(pdfText).join(', ') : undefined} />
          <View style={[st.kpi, { marginRight: 0 }]}><Text style={st.kpiLabel}>FO SEDANG BERJALAN</Text><Text style={st.kpiValue}>{d.admin.fo.ongoing}</Text></View>
        </View>
        <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(d.reportDay)}</Text></View>
      </Page>

      {/* ---------------------------------------------------------------- 3. Sales */}
      <Page size="A4" style={st.page}>
        <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title="3. Sales" day={d.reportDay} right="Pipeline per tahap" />
        <View style={st.kpiRow}>
          <Kpi label="TOTAL DEAL DI PIPELINE" value={String(d.pipeline.total)} />
          <Kpi label="LEAD BARU KEMARIN" value={String(d.pipeline.newOnDay)} />
          <Kpi label="PINDAH TAHAP KEMARIN" value={String(d.pipeline.movedOnDay)} />
        </View>

        <Text style={st.h2}>Jumlah deal per tahap</Text>
        {d.pipeline.stages.map((x) => (
          <View key={x.stage} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }} wrap={false}>
            <Text style={{ width: '16%', fontSize: 8.5 }}>{x.stage}</Text>
            <View style={{ width: '64%', height: 11, backgroundColor: '#f3f4f6', borderRadius: 2 }}>
              <View style={{ width: `${Math.max(x.count > 0 ? 2 : 0, (x.count / maxStage) * 100)}%`, height: 11, backgroundColor: STAGE_COLOR[x.stage] || BLUE, borderRadius: 2 }} />
            </View>
            <Text style={{ width: '8%', fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, textAlign: 'right' }}>{x.count}</Text>
            <Text style={{ width: '12%', fontSize: 7.5, color: MUTED, textAlign: 'right' }}>{x.value > 0 ? shortRp(x.value) : ''}</Text>
          </View>
        ))}

        <Text style={st.h2}>Per sales</Text>
        <View style={st.head}>
          <Text style={[st.th, { width: '22%' }]}>SALES</Text>
          {STAGES.map((g) => <Text key={g} style={[st.th, { width: '10.5%', textAlign: 'right' }]}>{g.toUpperCase()}</Text>)}
          <Text style={[st.th, { width: '8%', textAlign: 'right' }]}>BARU</Text>
          <Text style={[st.th, { width: '7%', textAlign: 'right' }]}>PINDAH</Text>
        </View>
        {d.pipeline.bySales.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 6 }}>Belum ada data pipeline.</Text>}
        {d.pipeline.bySales.map((p) => (
          <View key={p.name} style={st.row} wrap={false}>
            <Text style={{ width: '22%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(p.name), 18)}</Text>
            {STAGES.map((g) => <Text key={g} style={{ width: '10.5%', fontSize: 8.5, textAlign: 'right', color: p.counts[g] ? INK : '#9ca3af' }}>{p.counts[g]}</Text>)}
            <Text style={{ width: '8%', fontSize: 8.5, textAlign: 'right' }}>{p.newOnDay}</Text>
            <Text style={{ width: '7%', fontSize: 8.5, textAlign: 'right' }}>{p.movedOnDay}</Text>
          </View>
        ))}
        <EndingTable title={`Project sudah berakhir (${ENDING_WINDOW_DAYS} hari terakhir)`} rows={d.endings.ended} ago empty="Tidak ada project yang berakhir dalam 2 minggu terakhir." />
        <EndingTable title={`Project berakhir dalam ${ENDING_WINDOW_DAYS} hari ke depan`} rows={d.endings.soon} empty="Tidak ada project yang berakhir dalam 2 minggu ke depan." />
        <Text style={[st.hint, { marginTop: 6 }]}>BARU = deal yang dimasukkan kemarin. PINDAH = deal yang berpindah tahap kemarin. Cold Case = deal yang sudah ditinggalkan.</Text>
        <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(d.reportDay)}</Text></View>
      </Page>
    </Document>
  );
}

export async function renderBodDailyPdf(d: BodDaily): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<BodDailyDocument d={d} />);
}
