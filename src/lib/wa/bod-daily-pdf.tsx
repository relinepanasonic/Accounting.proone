import React from 'react';
import { Document, Page, View, Text, Svg, Polyline, Circle, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { dmy, rp } from '@/lib/reports/whatsapp-report';
import { ensureFonts, pdfText, shortRp } from './weekly-pdf';
import { STAGES, ENDING_WINDOW_DAYS, type BodDaily, type EndingClient } from './bod-daily';
import type { SalesBod } from './bod-sales';
import { stageLabel } from '@/lib/sales/flow';

/**
 * The daily BOD report as a PDF for Nico and Herlan: Advertising, Admin, Sales (each starts on its own page; a long table continues on the next).
 * Drawn from the data of bod-daily.ts. Charts are shapes plus normal text (never SVG text, which ignores the embedded font).
 */

const GOLD = '#b8901f', INK = '#111827', MUTED = '#6b7280', LINE = '#e5e7eb', GREEN = '#059669', RED = '#dc2626', BLUE = '#2563eb', AMBER = '#d97706';
const STAGE_COLOR: Record<string, string> = { Lead: '#bfdbfe', Contacted: '#93c5fd', Qualified: '#60a5fa', Warm: '#fb923c', 'Meeting Offered': '#c4b5fd', 'Meeting Booked': '#a78bfa', 'Meeting Done': '#8b5cf6', Negotiation: '#f59e0b', 'Invoice Requested': '#7dd3fc', Invoice: '#38bdf8', Deal: '#10b981', 'Cold Case': '#9ca3af' };
// short column titles for the per-sales table (12 stages on one A4 row)
const STAGE_SHORT: Record<string, string> = { Lead: 'NEW', Contacted: 'CONT', Qualified: 'QUAL', Warm: 'WARM', 'Meeting Offered': 'OFFER', 'Meeting Booked': 'BOOK', 'Meeting Done': 'MEET', Negotiation: 'NEGO', 'Invoice Requested': 'REQ', Invoice: 'INV', Deal: 'ACTIVE', 'Cold Case': 'LOST' };

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

const dayShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const idr = (n: number) => n.toLocaleString('id-ID');

/**
 * Page 5: Insight Chat, in the shape of the Product & Inquiry Intelligence report: the executive summary, the key numbers, the packages clients ask about
 * and what worries them (with their own words as evidence), the daily trend, and the recommendations with who does them. All in the one daily file.
 */
function InsightPage({ a, day }: { a: NonNullable<BodDaily['asks']>; day: string }) {
  const sum = a.summary;
  const maxDay = Math.max(1, ...a.daily.map((x) => x.chats));
  const asked = new Set<string>();
  const from = a.daily[0]?.day || day;
  return (
    <Page size="A4" style={st.page}>
      <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title="5. Insight Chat" day={day} right="Apa yang dibutuhkan client" />
      <Text style={st.hint}>Periode data: {dmy(from)} - {dmy(a.daily[a.daily.length - 1]?.day || day)} (7 hari). Sumber: chat calon client di nomor sales. Angka dihitung dari pesan client; ringkasan ditulis {sum?.ai ? `AI (${pdfText(sum.model || 'AI')})` : 'otomatis dari angka'}.</Text>

      <Text style={st.h2}>Ringkasan Eksekutif</Text>
      <Text style={{ fontSize: 9, lineHeight: 1.5 }}>{pdfText(sum?.executive || 'Ringkasan belum bisa dibuat.')}</Text>
      {sum && sum.insights.length > 0 && sum.insights.map((x, i) => <Text key={i} style={{ fontSize: 8.5, lineHeight: 1.4, marginTop: 2 }}>- {pdfText(x)}</Text>)}

      <Text style={st.h2}>Ringkasan Angka Kunci</Text>
      <View style={st.kpiRow}>
        <Kpi label="CHAT CALON CLIENT" value={idr(a.chats)} />
        <Kpi label="PESAN MASUK" value={idr(a.messages)} />
        <Kpi label="PAKET TERATAS" value={a.packages[0] ? cut(pdfText(a.packages[0].label.replace('Paket ', '')), 16) : '-'} note={a.packages[0] ? `${a.packages[0].chats} chat` : undefined} />
        <View style={[st.kpi, { marginRight: 0 }]}><Text style={st.kpiLabel}>KEKHAWATIRAN TERATAS</Text><Text style={[st.kpiValue, { fontSize: 9.5 }]}>{a.concerns[0] ? cut(pdfText(a.concerns[0].label), 24) : '-'}</Text>{a.concerns[0] ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{a.concerns[0].chats} chat</Text> : null}</View>
      </View>

      <Text style={st.h2}>Paket yang paling banyak ditanya</Text>
      <View style={st.head}>
        <Text style={[st.th, { width: '30%' }]}>PAKET / PENAWARAN</Text><Text style={[st.th, { width: '9%', textAlign: 'right' }]}>CHAT</Text><Text style={[st.th, { width: '9%', textAlign: 'right' }]}>PESAN</Text><Text style={[st.th, { width: '52%', paddingLeft: 8 }]}>KUTIPAN CLIENT</Text>
      </View>
      {a.packages.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 5 }}>Belum ada paket yang disebut client.</Text>}
      {a.packages.slice(0, 6).map((r) => (
        <View key={r.key} style={st.row} wrap={false}>
          <Text style={{ width: '30%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{pdfText(r.label)}</Text>
          <Text style={{ width: '9%', fontSize: 8.5, textAlign: 'right' }}>{r.chats}</Text><Text style={{ width: '9%', fontSize: 8.5, textAlign: 'right' }}>{r.mentions}</Text>
          <Text style={{ width: '52%', fontSize: 7.5, color: MUTED, paddingLeft: 8 }}>{r.examples[0] ? `"${cut(pdfText(r.examples[0]), 95)}"` : '-'}</Text>
        </View>
      ))}

      <Text style={st.h2}>Kekhawatiran dan kebutuhan client</Text>
      <View style={st.head}>
        <Text style={[st.th, { width: '30%' }]}>TEMA</Text><Text style={[st.th, { width: '9%', textAlign: 'right' }]}>CHAT</Text><Text style={[st.th, { width: '9%', textAlign: 'right' }]}>PESAN</Text><Text style={[st.th, { width: '52%', paddingLeft: 8 }]}>KUTIPAN CLIENT</Text>
      </View>
      {a.concerns.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 5 }}>Belum ada kekhawatiran yang terbaca.</Text>}
      {a.concerns.slice(0, 7).map((r) => (
        <View key={r.key} style={st.row} wrap={false}>
          <Text style={{ width: '30%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(r.label), 30)}</Text>
          <Text style={{ width: '9%', fontSize: 8.5, textAlign: 'right' }}>{r.chats}</Text><Text style={{ width: '9%', fontSize: 8.5, textAlign: 'right' }}>{r.mentions}</Text>
          <Text style={{ width: '52%', fontSize: 7.5, color: MUTED, paddingLeft: 8 }}>{r.examples[0] ? `"${cut(pdfText(r.examples[0]), 95)}"` : '-'}</Text>
        </View>
      ))}
      {a.needs.length > 0 && <Text style={{ fontSize: 8, marginTop: 5 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700 }}>Kebutuhan yang disebut ke bot: </Text>{a.needs.slice(0, 5).map((n) => `${pdfText(n.need)} (${n.chats})`).join(', ')}</Text>}
      {a.handedOver.length > 0 && <Text style={{ fontSize: 8, marginTop: 3 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700 }}>Pertanyaan yang belum bisa dijawab bot: </Text>{a.handedOver.slice(0, 4).map((h) => `"${cut(pdfText(h.text), 60)}"`).join('; ')}</Text>}

      <View wrap={false}>
        <Text style={st.h2}>Tren harian chat calon client</Text>
        {a.daily.map((x) => (
          <View key={x.day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 }}>
            <Text style={{ width: '10%', fontSize: 8 }}>{dayShort(x.day)}</Text>
            <View style={{ width: '70%', height: 8, backgroundColor: '#f3f4f6', borderRadius: 2 }}>
              <View style={{ width: `${Math.max(x.chats > 0 ? 2 : 0, (x.chats / maxDay) * 100)}%`, height: 8, backgroundColor: BLUE, borderRadius: 2 }} />
            </View>
            <Text style={{ width: '20%', fontSize: 8, textAlign: 'right' }}>{x.chats} chat · {x.messages} pesan</Text>
          </View>
        ))}
      </View>

      <View wrap={false}>
        <Text style={st.h2}>Rekomendasi dan Action Plan</Text>
        <View style={st.head}>
          <Text style={[st.th, { width: '5%' }]}>NO</Text><Text style={[st.th, { width: '45%' }]}>TINDAKAN</Text><Text style={[st.th, { width: '14%' }]}>PIC</Text><Text style={[st.th, { width: '36%' }]}>ALASAN</Text>
        </View>
        {(!sum || sum.actions.length === 0) && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 5 }}>Belum ada rekomendasi: data chat masih terlalu sedikit.</Text>}
        {sum?.actions.map((x, i) => (
          <View key={i} style={st.row} wrap={false}>
            <Text style={{ width: '5%', fontSize: 8.5 }}>{i + 1}</Text>
            <Text style={{ width: '45%', fontSize: 8.5, lineHeight: 1.35 }}>{pdfText(x.action)}</Text>
            <Text style={{ width: '14%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{pdfText(x.pic)}</Text>
            <Text style={{ width: '36%', fontSize: 7.5, color: MUTED, lineHeight: 1.35 }}>{pdfText(x.why)}</Text>
          </View>
        ))}
      </View>
      <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(day)} · Insight Chat</Text></View>
    </Page>
  );
}

const MOVE_LABEL: Array<[keyof SalesBod['movement'], string]> = [
  ['newLeads', 'LEAD BARU'], ['meetingsBooked', 'MEETING DIBOOKING'], ['meetingsHeld', 'MEETING TERJADI'], ['noShow', 'TIDAK HADIR'],
  ['proposalsSent', 'PROPOSAL DIKIRIM'], ['invoicesRequested', 'REQUEST INVOICE'], ['invoicesSent', 'INVOICE TERKIRIM'], ['newActive', 'CLIENT AKTIF BARU'],
];
const pct0 = (p: number | null) => (p === null ? '-' : `${Math.round(p * 100)}%`);
const timeWib = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(11, 16);

/** The sales page: today's movement, the funnel now with its conversion, each salesperson, and what needs attention. */
function SalesPage({ sales: s, day }: { sales: SalesBod; day: string }) {
  const max = Math.max(1, ...s.funnel.map((f) => f.count));
  return (
    <Page size="A4" style={st.page}>
      <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title="3. Sales" day={day} right="Dari lead ke meeting ke client aktif" />

      <Text style={st.h2}>Yang terjadi hari ini</Text>
      <View style={st.kpiRow}>{MOVE_LABEL.slice(0, 4).map(([k, label]) => <Kpi key={k} label={label} value={String(s.movement[k])} />)}</View>
      <View style={st.kpiRow}>
        {MOVE_LABEL.slice(4).map(([k, label]) => <Kpi key={k} label={label} value={String(s.movement[k])} />)}
      </View>
      <View style={st.kpiRow}>
        <Kpi label="PEMBAYARAN DITERIMA HARI INI" value={money(s.paymentsToday.amount)} note={`${s.paymentsToday.count} invoice`} />
        <Kpi label="SHOW RATE MEETING (30 HARI)" value={pct0(s.showRate30)} note="meeting yang benar-benar terjadi" />
      </View>

      <Text style={st.h2}>Funnel sekarang dan konversinya</Text>
      {s.funnel.map((f) => (
        <View key={f.stage} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }} wrap={false}>
          <Text style={{ width: '20%', fontSize: 8.5 }}>{f.label}</Text>
          <View style={{ width: '56%', height: 9, backgroundColor: '#f3f4f6', borderRadius: 2 }}>
            <View style={{ width: `${Math.max(f.count > 0 ? 2 : 0, (f.count / max) * 100)}%`, height: 9, backgroundColor: STAGE_COLOR[f.stage] || BLUE, borderRadius: 2 }} />
          </View>
          <Text style={{ width: '8%', fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, textAlign: 'right' }}>{f.count}</Text>
          <Text style={{ width: '16%', fontSize: 7.5, color: MUTED, textAlign: 'right' }}>{f.value > 0 ? shortRp(f.value) : ''}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', marginTop: 5 }}>
        {s.conversions.map((c) => (
          <View key={c.from} style={[st.kpi, { marginRight: 4, padding: 5 }]}>
            <Text style={{ fontSize: 6, color: MUTED }}>{stageLabel(c.from).toUpperCase()} KE {stageLabel(c.to).toUpperCase()}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, marginTop: 2 }}>{pct0(c.pct)}</Text>
            <Text style={{ fontSize: 6.5, color: MUTED }}>{c.toCount} dari {c.fromCount}</Text>
          </View>
        ))}
      </View>

      <Text style={st.h2}>Per sales hari ini</Text>
      <View style={st.head}>
        <Text style={[st.th, { width: '20%' }]}>SALES</Text>
        {['LEAD', 'BOOK', 'MEET', 'ABSEN', 'PROP', 'REQ', 'INV', 'AKTIF'].map((h) => <Text key={h} style={[st.th, { width: '10%', textAlign: 'right' }]}>{h}</Text>)}
      </View>
      {s.bySales.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 5 }}>Belum ada aktivitas sales hari ini.</Text>}
      {s.bySales.map((p) => (
        <View key={p.name} style={st.row} wrap={false}>
          <Text style={{ width: '20%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(p.name), 16)}</Text>
          {([p.newLeads, p.meetingsBooked, p.meetingsHeld, p.noShow, p.proposalsSent, p.invoicesRequested, p.invoicesSent, p.newActive]).map((v, i) => <Text key={i} style={{ width: '10%', fontSize: 8.5, textAlign: 'right', color: v ? INK : '#9ca3af' }}>{v}</Text>)}
        </View>
      ))}
      <Text style={st.hint}>LEAD = lead baru. BOOK = meeting dibooking. MEET = meeting terjadi. ABSEN = tidak hadir. PROP = proposal dikirim. REQ = request invoice. INV = invoice terkirim. AKTIF = client aktif baru.</Text>

      <Text style={st.h2}>Perlu perhatian</Text>
      <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: AMBER }}>Meeting besok yang belum dikonfirmasi ({s.unconfirmed.length})</Text>
      {s.unconfirmed.length === 0 ? <Text style={{ fontSize: 8, color: MUTED, marginBottom: 4 }}>Semua meeting besok sudah dikonfirmasi, atau tidak ada.</Text> : s.unconfirmed.map((u, i) => (
        <Text key={i} style={{ fontSize: 8, marginTop: 1.5 }}>{timeWib(u.at)} WIB  {cut(pdfText(u.name), 30)}  ({cut(pdfText(u.owner), 16)})</Text>
      ))}
      <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: AMBER, marginTop: 5 }}>Deal tertahan terlalu lama ({s.stuck.length})</Text>
      {s.stuck.length === 0 ? <Text style={{ fontSize: 8, color: MUTED, marginBottom: 4 }}>Tidak ada deal yang tertahan.</Text> : s.stuck.map((x) => (
        <Text key={x.id} style={{ fontSize: 8, marginTop: 1.5 }}>{cut(pdfText(x.client), 30)}  di {stageLabel(x.stage)} {x.days} hari  ({cut(pdfText(x.sales), 16)})</Text>
      ))}
      <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: RED, marginTop: 5 }}>Invoice lewat jatuh tempo ({s.overdue.length})</Text>
      {s.overdue.length === 0 ? <Text style={{ fontSize: 8, color: MUTED }}>Tidak ada invoice yang lewat jatuh tempo.</Text> : s.overdue.map((o) => (
        <Text key={o.number} style={{ fontSize: 8, marginTop: 1.5 }}>{cut(pdfText(o.client), 28)}  {o.number}  sisa {shortRp(o.balance)}  telat {o.daysLate} hari</Text>
      ))}
      <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(day)} · Sales</Text></View>
    </Page>
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

        <Text style={st.h2}>Sesi yang sudah diinput hari ini ({dmy(d.reportDay)})</Text>
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
        <Text style={st.hint}>Angka hari {dmy(d.dataDay)} dari Sesi 1 yang diinput hari ini. Garis kecil = 7 hari terakhir. Persen = dibanding hari sebelumnya.</Text>
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
        <Text style={st.h2}>Upload client hari ini ({dmy(d.reportDay)})</Text>
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
          <Kpi label="FO DIMULAI HARI INI" value={String(d.admin.fo.startedOnDay.length)} note={d.admin.fo.startedOnDay.length ? Array.from(new Set(d.admin.fo.startedOnDay)).map(pdfText).join(', ') : undefined} />
          <View style={[st.kpi, { marginRight: 0 }]}><Text style={st.kpiLabel}>FO SEDANG BERJALAN</Text><Text style={st.kpiValue}>{d.admin.fo.ongoing}</Text></View>
        </View>
        <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(d.reportDay)}</Text></View>
      </Page>

      {/* ---------------------------------------------------------------- 3. Sales: what moved today, the funnel, what needs attention */}
      {d.sales && <SalesPage sales={d.sales} day={d.reportDay} />}

      {/* ---------------------------------------------------------------- 4. Pipeline per stage and salesperson */}
      <Page size="A4" style={st.page}>
        <Header kicker="PROFESSOR ONLINE · DAILY BOD REPORT" title={d.sales ? '4. Pipeline' : '3. Sales'} day={d.reportDay} right="Pipeline per tahap" />
        <View style={st.kpiRow}>
          <Kpi label="TOTAL DEAL DI PIPELINE" value={String(d.pipeline.total)} />
          <Kpi label="LEAD BARU HARI INI" value={String(d.pipeline.newOnDay)} />
          <Kpi label="PINDAH TAHAP HARI INI" value={String(d.pipeline.movedOnDay)} />
        </View>

        <Text style={st.h2}>Jumlah deal per tahap</Text>
        {d.pipeline.stages.map((x) => (
          <View key={x.stage} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }} wrap={false}>
            <Text style={{ width: '20%', fontSize: 8.5 }}>{stageLabel(x.stage)}</Text>
            <View style={{ width: '60%', height: 11, backgroundColor: '#f3f4f6', borderRadius: 2 }}>
              <View style={{ width: `${Math.max(x.count > 0 ? 2 : 0, (x.count / maxStage) * 100)}%`, height: 11, backgroundColor: STAGE_COLOR[x.stage] || BLUE, borderRadius: 2 }} />
            </View>
            <Text style={{ width: '8%', fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, textAlign: 'right' }}>{x.count}</Text>
            <Text style={{ width: '12%', fontSize: 7.5, color: MUTED, textAlign: 'right' }}>{x.value > 0 ? shortRp(x.value) : ''}</Text>
          </View>
        ))}

        <Text style={st.h2}>Per sales</Text>
        <View style={st.head}>
          <Text style={[st.th, { width: '16%' }]}>SALES</Text>
          {STAGES.map((g) => <Text key={g} style={[st.th, { width: '6%', textAlign: 'right', fontSize: 6 }]}>{STAGE_SHORT[g] || g.toUpperCase()}</Text>)}
          <Text style={[st.th, { width: '6%', textAlign: 'right', fontSize: 6 }]}>BARU</Text>
          <Text style={[st.th, { width: '6%', textAlign: 'right', fontSize: 6 }]}>PINDAH</Text>
        </View>
        {d.pipeline.bySales.length === 0 && <Text style={{ fontSize: 8.5, color: MUTED, paddingTop: 6 }}>Belum ada data pipeline.</Text>}
        {d.pipeline.bySales.map((p) => (
          <View key={p.name} style={st.row} wrap={false}>
            <Text style={{ width: '16%', fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{cut(pdfText(p.name), 14)}</Text>
            {STAGES.map((g) => <Text key={g} style={{ width: '6%', fontSize: 8.5, textAlign: 'right', color: p.counts[g] ? INK : '#9ca3af' }}>{p.counts[g]}</Text>)}
            <Text style={{ width: '6%', fontSize: 8.5, textAlign: 'right' }}>{p.newOnDay}</Text>
            <Text style={{ width: '6%', fontSize: 8.5, textAlign: 'right' }}>{p.movedOnDay}</Text>
          </View>
        ))}
        <EndingTable title={`Project sudah berakhir (${ENDING_WINDOW_DAYS} hari terakhir)`} rows={d.endings.ended} ago empty="Tidak ada project yang berakhir dalam 2 minggu terakhir." />
        <EndingTable title={`Project berakhir dalam ${ENDING_WINDOW_DAYS} hari ke depan`} rows={d.endings.soon} empty="Tidak ada project yang berakhir dalam 2 minggu ke depan." />
        <Text style={[st.hint, { marginTop: 6 }]}>BARU = deal yang dimasukkan hari ini. PINDAH = deal yang berpindah tahap hari ini. NEW New Lead, CONT Contacted, QUAL Qualified, OFFER Meeting Offered, BOOK Meeting Booked, MEET Meeting Done, NEGO Negotiation, REQ Invoice Requested, INV Invoice Sent, ACTIVE Active Client, LOST Lost.</Text>
        <View style={st.footer} fixed><Text>Professor Online · Daily BOD Report {dmy(d.reportDay)}</Text></View>
      </Page>
      {/* ---------------------------------------------------------------- 5. Insight Chat: what clients ask and need */}
      {d.asks && <InsightPage a={d.asks} day={d.reportDay} />}
    </Document>
  );
}

export async function renderBodDailyPdf(d: BodDaily): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<BodDailyDocument d={d} />);
}
